import { Env, User, DayTimelineData, DaySegment } from './types';
import { chatCompletion, buildSystemPrompt } from './ai-client';
import { getSkillFile, getFeatureConfig } from './skill-service';
import { getMemory } from './memory-service';
import { getNatalChartSection } from './natal-calculator';

export async function getCachedDayTimeline(env: Env, lineUserId: string): Promise<DayTimelineData | null> {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
  const row = await env.DB.prepare(
    "SELECT content FROM daily_cache WHERE line_user_id = ? AND cache_type = 'day-timeline' AND DATE(datetime(created_at, '+7 hours')) = ? ORDER BY created_at DESC LIMIT 1"
  ).bind(lineUserId, today).first();
  if (!row) return null;
  try { return JSON.parse((row as any).content); } catch { return null; }
}

export async function setCachedDayTimeline(env: Env, lineUserId: string, data: DayTimelineData): Promise<void> {
  await env.DB.prepare(
    "INSERT OR REPLACE INTO daily_cache (line_user_id, cache_type, content, created_at) VALUES (?, 'day-timeline', ?, datetime('now'))"
  ).bind(lineUserId, JSON.stringify(data)).run();
}

export async function generateDayTimeline(
  env: Env,
  user: User,
  todayChips?: { color: string; colorHex: string; number: string; goldenTime: string }
): Promise<DayTimelineData> {
  const cached = await getCachedDayTimeline(env, user.line_user_id);
  if (cached) return cached;

  if (!user.birth_date) return { segments: [], peakStart: '', peakEnd: '' };

  const config = await getFeatureConfig(env, 'day-timeline');
  const skillMd = await getSkillFile(env, 'day-timeline', 'skill.md');
  const referenceMd = await getSkillFile(env, 'day-timeline', 'reference.md');
  const memoryMd = await getMemory(env, user.line_user_id);
  const model = config?.ai_model || env.AI_MODEL;

  const now = new Date(Date.now() + 7 * 3600 * 1000);
  const dateStr = now.toLocaleDateString('th-TH', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Bangkok',
  });

  let chipsContext = '';
  if (todayChips?.goldenTime) {
    chipsContext = `\n\n[TODAY CARD ที่แสดงให้ผู้ใช้แล้ว — ต้องสอดคล้องกัน]\nเวลามงคล (goldenTime): ${todayChips.goldenTime}\nช่วงนี้ต้องเป็น peak หรือ good ใน segments ห้ามขัดแย้ง`;
  }

  const userPrompt = `วิเคราะห์พลังงานตลอด 24 ชั่วโมงสำหรับวันนี้ (${dateStr})
สำหรับคนเกิดวันที่ ${user.birth_date} เวลา ${user.birth_time || 'ไม่ระบุ'}${chipsContext}`;

  let systemPart = buildSystemPrompt(skillMd, referenceMd, memoryMd, [], 'day-timeline');
  if (config?.natal_source_systems) {
    try {
      const systems: string[] = JSON.parse(config.natal_source_systems);
      const natalSection = getNatalChartSection(user, systems);
      if (natalSection) systemPart += '\n\n' + natalSection;
    } catch {}
  }

  try {
    const raw = await chatCompletion(env, [
      { role: 'system', content: systemPart },
      { role: 'user', content: userPrompt },
    ], model, config?.max_tokens || undefined);

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const validLevels = ['peak', 'good', 'moderate', 'low', 'caution'];
      const segments: DaySegment[] = (parsed.segments || [])
        .filter((s: any) => s.start && s.end && validLevels.includes(s.level))
        .map((s: any) => ({ start: s.start, end: s.end, level: s.level as DaySegment['level'] }));

      if (segments.length > 0) {
        const data: DayTimelineData = {
          segments,
          peakStart: parsed.peakStart || '',
          peakEnd: parsed.peakEnd || '',
        };
        await setCachedDayTimeline(env, user.line_user_id, data);
        return data;
      }
    }
  } catch (err) {
    console.error('generateDayTimeline error:', err);
  }

  return { segments: [], peakStart: '', peakEnd: '' };
}
