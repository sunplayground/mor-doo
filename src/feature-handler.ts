import { Env, FeatureName, User, SkillContext } from './types';
import { chatCompletion, buildSystemPrompt } from './ai-client';
import { getSkillFile, getFeatureConfig } from './skill-service';
import { getMemory } from './memory-service';
import { logMessage } from './log-service';
import { getNatalChartSection } from './natal-calculator';

async function buildSkillContext(
  env: Env,
  user: User,
  feature: FeatureName,
  userMessage?: string
): Promise<SkillContext> {
  const config = await getFeatureConfig(env, feature);
  const skillMd = await getSkillFile(env, feature, 'skill.md');
  const referenceMd = await getSkillFile(env, feature, 'reference.md');
  const memoryMd = await getMemory(env, user.line_user_id);

  let extraSkills: string[] = [];
  if (config?.extra_skill_paths) {
    try {
      const paths = JSON.parse(config.extra_skill_paths) as string[];
      for (const p of paths) {
        const obj = await env.R2.get(p);
        if (obj) extraSkills.push(await obj.text());
      }
    } catch {}
  }

  return { skillMd, referenceMd, extraSkills, memoryMd, user, userMessage };
}

async function runFeature(
  env: Env,
  user: User,
  feature: FeatureName,
  userMessage: string
): Promise<string> {
  const config = await getFeatureConfig(env, feature);
  if (!config?.enabled) {
    return 'ขออภัยค่ะ ฟีเจอร์นี้ยังไม่เปิดให้ใช้งานในตอนนี้';
  }

  const ctx = await buildSkillContext(env, user, feature, userMessage);
  let systemPrompt = buildSystemPrompt(ctx.skillMd, ctx.referenceMd, ctx.memoryMd, ctx.extraSkills, feature);

  if (config.natal_source_systems) {
    try {
      const systems: string[] = JSON.parse(config.natal_source_systems);
      const natalSection = getNatalChartSection(user, systems);
      if (natalSection) systemPrompt += '\n\n' + natalSection;
    } catch {}
  }

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    { role: 'user' as const, content: userMessage },
  ];

  const model = config.ai_model || env.AI_MODEL;
  const response = await chatCompletion(env, messages, model, config.max_tokens || undefined);

  return response;
}

export async function handleChat(env: Env, user: User, message: string): Promise<string> {
  await logMessage(env, user.line_user_id, 'inbound', message, 'chat');
  const response = await runFeature(env, user, 'chat', message);
  await logMessage(env, user.line_user_id, 'outbound', response, 'chat');
  return response;
}

export async function handleDailyReading(
  env: Env,
  user: User,
  todayChips?: { color: string; colorHex: string; number: string; goldenTime: string }
): Promise<string> {
  if (!user.birth_date) {
    return 'กรุณาลงทะเบียนและใส่วันเกิดก่อนนะคะ พี่ดาวจะได้ดูดวงให้ถูกต้อง';
  }

  const today = new Date().toLocaleDateString('th-TH', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Bangkok',
  });

  let chipsContext = '';
  if (todayChips?.color) {
    chipsContext = `\n\n[TODAY CARD ที่แสดงให้ผู้ใช้แล้ว — ต้องใช้ค่าเหล่านี้ให้ตรงกัน]\nสีมงคล: ${todayChips.color}\nเลขมงคล: ${todayChips.number}\nเวลามงคล: ${todayChips.goldenTime}`;
  }

  const prompt = `ทำนายดวงประจำวันสำหรับวันนี้ (${today}) ของคนเกิดวันที่ ${user.birth_date} เวลา ${user.birth_time || 'ไม่ระบุ'}\n\nให้ทำนาย: สีมงคล, เลขนำโชค, ช่วงเวลาดี, ช่วงเวลาระวัง, ข้อความสั้นๆ ให้กำลังใจ${chipsContext}`;

  await logMessage(env, user.line_user_id, 'inbound', `[auto] daily reading request`, 'daily-reading');
  const response = await runFeature(env, user, 'daily-reading', prompt);
  await logMessage(env, user.line_user_id, 'outbound', response, 'daily-reading');
  return response;
}

export async function handleWeeklyReading(
  env: Env,
  user: User,
  compassContext?: { monthTheme: string; yearTheme: string }
): Promise<string> {
  if (!user.birth_date) {
    return 'กรุณาลงทะเบียนและใส่วันเกิดก่อนนะคะ';
  }

  const now = new Date();
  let compassSection = '';
  if (compassContext?.monthTheme) {
    compassSection = `\n\n[COMPASS ที่แสดงให้ผู้ใช้แล้ว — ต้องสอดคล้องกัน]\nธีมเดือนนี้: ${compassContext.monthTheme}${compassContext.yearTheme ? `\nธีมปีนี้: ${compassContext.yearTheme}` : ''}\nใช้ธีมเหล่านี้เป็นกรอบหลักในการทำนายสัปดาห์ ห้ามขัดแย้ง`;
  }

  const prompt = `ทำนายดวงประจำสัปดาห์หน้า (สัปดาห์ของวันที่ ${now.toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' })}) สำหรับคนเกิดวันที่ ${user.birth_date} เวลา ${user.birth_time || 'ไม่ระบุ'}\n\nให้ทำนาย: ธีมประจำสัปดาห์, 3 ด้านสำคัญ (ความรัก/การเงิน/การงาน), วันสำคัญ, 3 สิ่งที่ควรทำ${compassSection}`;

  await logMessage(env, user.line_user_id, 'inbound', `[auto] weekly reading request`, 'weekly-reading');
  const response = await runFeature(env, user, 'weekly-reading', prompt);
  await logMessage(env, user.line_user_id, 'outbound', response, 'weekly-reading');
  return response;
}

export async function handleBirthChart(env: Env, user: User): Promise<string> {
  if (!user.birth_date) {
    return 'กรุณาลงทะเบียนและใส่วันเกิดก่อนนะคะ';
  }

  const prompt = `วิเคราะห์แผนภูมิดวงชะตา (ผูกดวง) สำหรับคนเกิดวันที่ ${user.birth_date} เวลา ${user.birth_time || 'ไม่ระบุ'} ชื่อ ${user.name || 'ไม่ระบุ'}\n\nให้วิเคราะห์: ลัคนา, ดาวประจำตัว, 5 ลักษณะเด่น, ภาพรวมดวงชะตา`;

  await logMessage(env, user.line_user_id, 'inbound', `[auto] birth chart request`, 'birth-chart');
  const response = await runFeature(env, user, 'birth-chart', prompt);
  await logMessage(env, user.line_user_id, 'outbound', response, 'birth-chart');
  return response;
}

export async function handleTarot(env: Env, user: User, question?: string): Promise<string> {
  const prompt = question
    ? `จัดไพ่ทาโร่ 3 ใบ (อดีต/ปัจจุบัน/อนาคต) สำหรับคำถาม: "${question}"\nข้อมูลผู้ถาม: เกิด ${user.birth_date || 'ไม่ระบุ'} เวลา ${user.birth_time || 'ไม่ระบุ'}`
    : `จัดไพ่ทาโร่ 3 ใบ (อดีต/ปัจจุบัน/อนาคต) ทั่วไป\nข้อมูลผู้ถาม: เกิด ${user.birth_date || 'ไม่ระบุ'} เวลา ${user.birth_time || 'ไม่ระบุ'}`;

  await logMessage(env, user.line_user_id, 'inbound', question || '[tarot reading]', 'tarot');
  const response = await runFeature(env, user, 'tarot', prompt);
  await logMessage(env, user.line_user_id, 'outbound', response, 'tarot');
  return response;
}

export async function handleDream(env: Env, user: User, dreamText: string): Promise<string> {
  const prompt = `ทำนายฝัน: "${dreamText}"\nข้อมูลผู้ฝัน: เกิด ${user.birth_date || 'ไม่ระบุ'} เวลา ${user.birth_time || 'ไม่ระบุ'}\n\nให้ทำนาย: ความหมายของฝัน, เลขนำโชค, ข้อควรระวัง, สิ่งที่ควรทำ`;

  await logMessage(env, user.line_user_id, 'inbound', dreamText, 'dream');
  const response = await runFeature(env, user, 'dream', prompt);
  await logMessage(env, user.line_user_id, 'outbound', response, 'dream');
  return response;
}

export async function handlePhoneNumber(env: Env, user: User, phoneNumber: string): Promise<string> {
  const prompt = `วิเคราะห์เบอร์มงคล: "${phoneNumber}"\nข้อมูลเจ้าของ: เกิด ${user.birth_date || 'ไม่ระบุ'} เวลา ${user.birth_time || 'ไม่ระบุ'}\n\nให้วิเคราะห์: ค่าพลังเบอร์, ความหมายแต่ละหลัก, เหมาะกับการงาน/ความรัก/การเงิน หรือไม่, คะแนนรวม`;

  await logMessage(env, user.line_user_id, 'inbound', phoneNumber, 'phone-number');
  const response = await runFeature(env, user, 'phone-number', prompt);
  await logMessage(env, user.line_user_id, 'outbound', response, 'phone-number');
  return response;
}

export async function handleNameAnalysis(env: Env, user: User, name: string): Promise<string> {
  const prompt = `วิเคราะห์ชื่อมงคล: "${name}"\nข้อมูลเจ้าของ: เกิด ${user.birth_date || 'ไม่ระบุ'} เวลา ${user.birth_time || 'ไม่ระบุ'}\n\nให้วิเคราะห์: จำนวนขีดของแต่ละตัวอักษร, พลังของชื่อ, เหมาะกับเจ้าของหรือไม่, ข้อเสนอแนะ`;

  await logMessage(env, user.line_user_id, 'inbound', name, 'name-analysis');
  const response = await runFeature(env, user, 'name-analysis', prompt);
  await logMessage(env, user.line_user_id, 'outbound', response, 'name-analysis');
  return response;
}

export async function handleBadYear(env: Env, user: User): Promise<string> {
  if (!user.birth_date) {
    return 'กรุณาลงทะเบียนและใส่วันเกิดก่อนนะคะ';
  }

  const prompt = `ตรวจสอบปีชง ปีนี้ (พ.ศ. ${new Date(Date.now() + 7 * 3600 * 1000).getUTCFullYear() + 543}) สำหรับคนเกิดวันที่ ${user.birth_date}\n\nให้วิเคราะห์: ปีนี้ชงหรือไม่, ด้านที่ต้องระวัง, วิธีแก้ปีชง, สิ่งที่ควรทำเพิ่มเติม`;

  await logMessage(env, user.line_user_id, 'inbound', '[bad year check]', 'bad-year');
  const response = await runFeature(env, user, 'bad-year', prompt);
  await logMessage(env, user.line_user_id, 'outbound', response, 'bad-year');
  return response;
}

export async function handleAuspiciousTime(env: Env, user: User): Promise<string> {
  if (!user.birth_date) {
    return 'กรุณาลงทะเบียนและใส่วันเกิดก่อนนะคะ';
  }

  const prompt = `หาฤกษ์สำหรับสัปดาห์นี้ สำหรับคนเกิดวันที่ ${user.birth_date} เวลา ${user.birth_time || 'ไม่ระบุ'}\n\nให้ระบุ: วัน-เวลาดีสำหรับการงาน, วัน-เวลาดีสำหรับความรัก, วัน-เวลาที่ควรหลีกเลี่ยง, ช่วงเวลาพิเศษ`;

  await logMessage(env, user.line_user_id, 'inbound', '[auspicious time request]', 'auspicious-time');
  const response = await runFeature(env, user, 'auspicious-time', prompt);
  await logMessage(env, user.line_user_id, 'outbound', response, 'auspicious-time');
  return response;
}

export function detectFeature(message: string): FeatureName | null {
  const lower = message.toLowerCase();
  if (/ฝัน|dream/i.test(lower)) return 'dream';
  if (/ทาโร่|tarot|ไพ่/i.test(lower)) return 'tarot';
  if (/เบอร์|phone/i.test(lower) && /\d{3}/.test(lower)) return 'phone-number';
  if (/ชื่อ|name/i.test(lower) && !/ชื่ออะไร/.test(lower)) return 'name-analysis';
  if (/ปีชง|ชง/i.test(lower)) return 'bad-year';
  if (/ฤกษ์|เวลาดี/i.test(lower)) return 'auspicious-time';
  if (/ผูกดวง|ดวงชะตา|แผนภูมิ/i.test(lower)) return 'birth-chart';
  if (/ดวงวันนี้|ดูดวง/i.test(lower)) return 'daily-reading';
  if (/ดวงสัปดาห์/i.test(lower)) return 'weekly-reading';
  return null;
}
