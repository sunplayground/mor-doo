import { Env, TodayData, CycleItem } from './types';
import { chatCompletion, buildSystemPrompt } from './ai-client';
import { getSkillFile, getFeatureConfig } from './skill-service';
import { getMemory } from './memory-service';
import { User } from './types';
import { getNatalChartSection } from './natal-calculator';

function bangkokDate(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
}

export async function getCachedToday(env: Env, lineUserId: string): Promise<TodayData | null> {
  const today = bangkokDate();
  const row = await env.DB.prepare(
    "SELECT content FROM daily_cache WHERE line_user_id = ? AND cache_type = 'today' AND DATE(datetime(created_at, '+7 hours')) = ? ORDER BY created_at DESC LIMIT 1"
  ).bind(lineUserId, today).first();
  if (!row) return null;
  try {
    return JSON.parse((row as any).content);
  } catch {
    return null;
  }
}

export async function setCachedToday(env: Env, lineUserId: string, data: TodayData): Promise<void> {
  await env.DB.prepare(
    "INSERT OR REPLACE INTO daily_cache (line_user_id, cache_type, content, created_at) VALUES (?, 'today', ?, datetime('now'))"
  ).bind(lineUserId, JSON.stringify(data)).run();
}

export async function getCachedTak(env: Env, lineUserId: string): Promise<string | null> {
  const today = bangkokDate();
  const row = await env.DB.prepare(
    "SELECT content FROM daily_cache WHERE line_user_id = ? AND cache_type = 'tak' AND DATE(datetime(created_at, '+7 hours')) = ? ORDER BY created_at DESC LIMIT 1"
  ).bind(lineUserId, today).first();
  if (!row) return null;
  return (row as any).content;
}

export async function setCachedTak(env: Env, lineUserId: string, content: string): Promise<void> {
  await env.DB.prepare(
    "INSERT OR REPLACE INTO daily_cache (line_user_id, cache_type, content, created_at) VALUES (?, 'tak', ?, datetime('now'))"
  ).bind(lineUserId, content).run();
}

function colorNameToHex(name: string): string {
  const map: Record<string, string> = {
    'ส้ม': '#FF8C00', 'แดง': '#E74C3C', 'ขาว': '#F5F5F5', 'เงิน': '#BDC3C7',
    'ชมพูเข้ม': '#E91E63', 'ชมพู': '#F06292', 'เขียวมรกต': '#1ABC9C',
    'เขียว': '#27AE60', 'เหลือง': '#F39C12', 'ทอง': '#D4AC0D',
    'ฟ้าอมเขียว': '#5DADE2', 'ฟ้า': '#3498DB', 'น้ำเงิน': '#2980B9',
    'ม่วง': '#8E44AD', 'ดำ': '#2C3E50',
  };
  for (const [key, hex] of Object.entries(map)) {
    if (name.includes(key)) return hex;
  }
  return '#888888';
}

export async function generateToday(env: Env, user: User): Promise<TodayData> {
  const cached = await getCachedToday(env, user.line_user_id);
  if (cached) return cached;

  if (!user.birth_date) {
    return {
      headline: 'กรุณาลงทะเบียนและใส่วันเกิดก่อนนะคะ พี่ดาวจะได้ดูดวงให้ถูกต้อง',
      chips: null,
      monthTheme: '',
      yearTheme: '',
      cycles: [],
      insight: null,
      raw: { daily: '', weekly: '', birthChart: '' },
    };
  }

  const config = await getFeatureConfig(env, 'today');
  const skillMd = await getSkillFile(env, 'today', 'skill.md');
  const referenceMd = await getSkillFile(env, 'today', 'reference.md');
  const insightSkillMd = await getSkillFile(env, 'ai-insight', 'skill.md');
  const memoryMd = await getMemory(env, user.line_user_id);
  const model = config?.ai_model || env.AI_MODEL;

  const today = new Date();
  const dateStr = today.toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Bangkok' });

  const insightSchema = insightSkillMd
    ? insightSkillMd
    : `"insight": {
    "must": "One specific thing to do today in Thai",
    "watch": "One specific thing to watch out for in Thai",
    "hidden": "One hidden opportunity in Thai"
  }`;

  const fallbackPrompt = `You are a Thai fortune-telling AI named "พี่ดาว". You analyze using Thai sidereal astrology, Vedic astrology, Bazi, and ทักษา.

CRITICAL: You MUST respond in EXACTLY this JSON format, nothing else:
{
  "headline": "Short 1-2 sentence therapist-voice headline in Thai describing today's energy for this person. NOT generic horoscope. Reference specific placements.",
  "chips": {
    "color": "สีมงคล in Thai (e.g. ม่วง, เขียว, ส้ม)",
    "colorHex": "#hex color code matching the lucky color (e.g. #9B59B6)",
    "number": "เลขมงคล as digits only (e.g. 7 or 13)",
    "goldenTime": "เวลามงคล as HH:MM - HH:MM (e.g. 10:45 - 12:15)"
  },
  "monthTheme": "One-line month compass theme in Thai",
  "yearTheme": "One-line year compass theme in Thai",
  "insight": { ... see AI INSIGHT SKILL section ... }
}`;

  const userPrompt = `Based on the birth data and today's transits, generate today's reading. Use therapist-voice, not calculator-voice. The headline should feel like someone who truly understands you, not a generic horoscope. Be specific to these birth details.`;

  let systemPart = skillMd || fallbackPrompt;
  systemPart += `\n\nBirth data: ${user.birth_date}, time: ${user.birth_time || 'ไม่ระบุ'}, name: ${user.name || 'User'}\nToday: ${dateStr}`;
  systemPart += `\n\n# AI INSIGHT SKILL\n${insightSchema}`;
  if (referenceMd) systemPart += `\n\n# ข้อมูลอ้างอิง\n\n${referenceMd}`;
  if (memoryMd) systemPart += `\n\n# ข้อมูลผู้ใช้ (memory)\n\n${memoryMd}`;
  if (config?.natal_source_systems) {
    try {
      const systems: string[] = JSON.parse(config.natal_source_systems);
      const natalSection = getNatalChartSection(user, systems);
      if (natalSection) systemPart += '\n\n' + natalSection;
    } catch {}
  }
  const messages = [
    { role: 'system' as const, content: systemPart },
    { role: 'user' as const, content: userPrompt },
  ];

  try {
    const raw = await chatCompletion(env, messages, model, config?.max_tokens || undefined);
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const data: TodayData = {
        headline: parsed.headline || '',
        chips: parsed.chips ? {
          color: parsed.chips.color || '',
          colorHex: (parsed.chips.colorHex && parsed.chips.colorHex !== '#888888') ? parsed.chips.colorHex : colorNameToHex(parsed.chips.color || ''),
          number: parsed.chips.number || '',
          goldenTime: parsed.chips.goldenTime || '',
        } : null,
        monthTheme: parsed.monthTheme || '',
        yearTheme: parsed.yearTheme || '',
        cycles: (parsed.cycles || []).map((c: any) => ({
          name: c.name || '',
          dates: c.dates || '',
          status: ['active', 'upcoming', 'winding'].includes(c.status) ? c.status : 'upcoming',
        })),
        insight: parsed.insight || null,
        raw: { daily: '', weekly: '', birthChart: '' },
      };
      await setCachedToday(env, user.line_user_id, data);
      // Invalidate dependent caches so they regenerate with the new chips/compass context
      await env.DB.prepare("DELETE FROM daily_cache WHERE line_user_id = ? AND cache_type IN ('daily-reading','day-timeline','weekly-reading')")
        .bind(user.line_user_id).run();
      return data;
    }
  } catch (err) {
    console.error('generateToday JSON parse error:', err);
  }

  const dailyText = await import('./feature-handler').then(m => m.handleDailyReading(env, user));
  return {
    headline: dailyText.substring(0, 100),
    chips: null,
    monthTheme: '',
    yearTheme: '',
    cycles: [],
    insight: null,
    raw: { daily: dailyText, weekly: '', birthChart: '' },
  };
}

export async function generateTak(env: Env, user: User): Promise<string> {
  const cached = await getCachedTak(env, user.line_user_id);
  if (cached) return cached;

  if (!user.birth_date) {
    return 'สวัสดีค่ะ วันนี้อยากรู้อะไร ถามพี่ดาวได้เลยค่ะ';
  }

  const config = await getFeatureConfig(env, 'tak');
  const skillMd = await getSkillFile(env, 'tak', 'skill.md');
  const referenceMd = await getSkillFile(env, 'tak', 'reference.md');
  const memoryMd = await getMemory(env, user.line_user_id);
  const model = config?.ai_model || env.AI_MODEL;

  const dayRulers = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัส', 'ศุกร์', 'เสาร์'];
  const dayIndex = new Date(Date.now() + 7 * 3600 * 1000).getUTCDay();
  const dayRuler = dayRulers[dayIndex];

  let systemPrompt = buildSystemPrompt(
    skillMd || '# พี่ดาว\nเป็นหมอดู AI ที่ตอบเป็นภาษาไทย ใช้น้ำเสียงอบอุ่นเหมือนพี่สาว ตอบสั้นไม่เกิน 3 ย่อหน้า',
    referenceMd,
    memoryMd,
    [],
    'tak'
  );
  if (config?.natal_source_systems) {
    try {
      const systems: string[] = JSON.parse(config.natal_source_systems);
      const natalSection = getNatalChartSection(user, systems);
      if (natalSection) systemPrompt += '\n\n' + natalSection;
    } catch {}
  }

  const userPrompt = `สร้างข้อความ "ทัก" สำหรับผู้ใช้ชื่อ ${user.name || 'คุณ'} เกิดวันที่ ${user.birth_date} เวลา ${user.birth_time || 'ไม่ระบุ'} วันนี้เป็นวัน${dayRuler}

กฎ: ทักจะต้องมี 3 ย่อหน้าเท่านั้น:
1. ทักทาย + บอกดาวประจำวันนี้ (วัน${dayRuler})
2. ข้อสังเกตจากดวงชะตาที่เฉพาะเจาะจงกับคนนี้ (ไม่ใช่คำทั่วไป)
3. คำถามปิดท้ายที่ชวนตอบ

ตอบเป็นภาษาไทยเท่านั้น ห้ามแสดงกระบวนการคิด`;

  const result = await chatCompletion(env, [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ], model);

  await setCachedTak(env, user.line_user_id, result);
  return result;
}

export async function generateCompatibility(
  env: Env,
  user: User,
  otherBirthDate: string
): Promise<string> {
  if (!user.birth_date) {
    return 'กรุณาลงทะเบียนและใส่วันเกิดก่อนนะคะ';
  }

  const config = await getFeatureConfig(env, 'compatibility');
  const skillMd = await getSkillFile(env, 'compatibility', 'skill.md');
  const referenceMd = await getSkillFile(env, 'compatibility', 'reference.md');
  const memoryMd = await getMemory(env, user.line_user_id);
  const model = config?.ai_model || env.AI_MODEL;

  const prompt = `วิเคราะห์ความเข้ากันระหว่างคนเกิดวันที่ ${user.birth_date} เวลา ${user.birth_time || 'ไม่ระบุ'} กับคนเกิดวันที่ ${otherBirthDate}

ให้วิเคราะห์:
1. คะแนนรวม (0-100)
2. ความเข้ากันแต่ละด้าน: เคมีรัก, ระยะยาว, การงานด้วยกัน, การสนทนา
3. จุดที่ต้องระวัง (friction zone) ที่น่าสนใจที่สุด — เล่าเป็นประโยคสั้นๆ ที่Screenshottable
4. พาราด็อกซ์: ถ้าด้านหนึ่งบอกร้าบ อีกด้านบอกดี ให้เล่าออกมา

ตอบเป็นภาษาไทย ใช้น้ำเสียงอบอุ่น ไม่ใช้คำว่า "คะแนน" หรือ "เปอร์เซ็นต์" นำหน้าคำอธิบาย ห้ามแสดงกระบวนการคิด`;

  let systemPrompt = buildSystemPrompt(skillMd, referenceMd, memoryMd, [], 'compatibility');
  if (config?.natal_source_systems) {
    try {
      const systems: string[] = JSON.parse(config.natal_source_systems);
      const natalSection = getNatalChartSection(user, systems);
      if (natalSection) systemPrompt += '\n\n' + natalSection;
    } catch {}
  }
  const result = await chatCompletion(env, [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: prompt },
  ], model);

  return result;
}

export async function generateRightNow(env: Env, user: User, action: string): Promise<string> {
  if (!user.birth_date) {
    return 'กรุณาลงทะเบียนและใส่วันเกิดก่อนนะคะ';
  }

  const config = await getFeatureConfig(env, 'chat');
  const skillMd = await getSkillFile(env, 'chat' as any, 'skill.md');
  const memoryMd = await getMemory(env, user.line_user_id);
  const model = config?.ai_model || env.AI_MODEL;

  const now = new Date();
  const timeStr = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' });
  const dayRulers = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัส', 'ศุกร์', 'เสาร์'];
  const dayRuler = dayRulers[new Date(Date.now() + 7 * 3600 * 1000).getUTCDay()];

  const actionMap: Record<string, string> = {
    call: 'โทรหาคนสำคัญ',
    text: 'ส่งข้อความสำคัญ',
    sign: 'เซ็นสัญญา',
    present: 'พรีเซนต์/ประชุมใหญ่',
    buy: 'ตัดสินใจซื้อของใหญ่',
    reject: 'ปฏิเสธคน',
  };

  const actionName = actionMap[action] || action;

  const prompt = `เกิดวันที่ ${user.birth_date} เวลา ${user.birth_time || 'ไม่ระบุ'} วันนี้เป็นวัน${dayRuler} เวลา ${timeStr} น.

สำหรับการ "${actionName}" — เวลานี้เหมาะไหม?

ตอบเป็นภาษาไทย สั้นๆ 3-4 บรรทัด:
- บรรทัดแรก: เหมาะ/ไม่เหมาะ + เหตุผลสั้นจากดวงชะตา
- บรรทัดที่2: ช่วงเวลาที่ดีกว่า (ถ้าไม่เหมาะ) หรือ ยืนยันช่วงเวลา
- บรรทัดที่3: สิ่งที่ควรระวัง

ห้ามแสดงกระบวนการคิด`;

  let systemPrompt = buildSystemPrompt(skillMd, '', memoryMd, [], 'chat');
  if (config?.natal_source_systems) {
    try {
      const systems: string[] = JSON.parse(config.natal_source_systems);
      const natalSection = getNatalChartSection(user, systems);
      if (natalSection) systemPrompt += '\n\n' + natalSection;
    } catch {}
  }
  return chatCompletion(env, [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: prompt },
  ], model);
}