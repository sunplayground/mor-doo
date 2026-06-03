import { Env, User, WeekEnergyData, WeekEnergyDay } from './types';
import { chatCompletion, buildSystemPrompt } from './ai-client';
import { getSkillFile, getFeatureConfig } from './skill-service';
import { getMemory } from './memory-service';
import { getNatalChartSection } from './natal-calculator';

function currentWeekMonday(): string {
  const now = new Date(Date.now() + 7 * 3600 * 1000);
  const day = now.getUTCDay();
  const daysBack = day === 0 ? 6 : day - 1;
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() - daysBack);
  return monday.toISOString().split('T')[0]; // already in Bangkok-shifted UTC
}

export async function getCachedWeekEnergy(env: Env, lineUserId: string): Promise<WeekEnergyData | null> {
  const monday = currentWeekMonday();
  const row = await env.DB.prepare(
    "SELECT content FROM daily_cache WHERE line_user_id = ? AND cache_type = 'week-energy' AND DATE(datetime(created_at, '+7 hours')) >= ? ORDER BY created_at DESC LIMIT 1"
  ).bind(lineUserId, monday).first();
  if (!row) return null;
  try {
    return JSON.parse((row as any).content);
  } catch {
    return null;
  }
}

export async function setCachedWeekEnergy(env: Env, lineUserId: string, data: WeekEnergyData): Promise<void> {
  await env.DB.prepare(
    "INSERT OR REPLACE INTO daily_cache (line_user_id, cache_type, content, created_at) VALUES (?, 'week-energy', ?, datetime('now'))"
  ).bind(lineUserId, JSON.stringify(data)).run();
}

export async function generateWeekEnergy(env: Env, user: User): Promise<WeekEnergyData> {
  const cached = await getCachedWeekEnergy(env, user.line_user_id);
  if (cached) return cached;

  if (!user.birth_date) {
    return { week: [] };
  }

  const config = await getFeatureConfig(env, 'week-energy');
  const skillMd = await getSkillFile(env, 'week-energy', 'skill.md');
  const referenceMd = await getSkillFile(env, 'week-energy', 'reference.md');
  const memoryMd = await getMemory(env, user.line_user_id);
  const model = config?.ai_model || env.AI_MODEL;

  // Build 7 days starting from today
  const days: string[] = [];
  const thaiDayNames = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
  const now = new Date(Date.now() + 7 * 3600 * 1000);
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setUTCDate(now.getUTCDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    const dayName = thaiDayNames[d.getUTCDay()];
    days.push(`${dateStr} (${dayName})`);
  }

  const userPrompt = `วิเคราะห์พลังงานประจำวันสำหรับ 7 วันข้างหน้า สำหรับคนเกิดวันที่ ${user.birth_date} เวลา ${user.birth_time || 'ไม่ระบุ'}

วันที่ต้องวิเคราะห์:
${days.join('\n')}`;

  let systemPart = buildSystemPrompt(skillMd, referenceMd, memoryMd, [], 'week-energy');
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
      const validEnergies = ['good', 'moderate', 'challenging'];
      const week: WeekEnergyDay[] = (parsed.week || [])
        .filter((d: any) => d.date && validEnergies.includes(d.energy))
        .map((d: any) => ({ date: d.date, energy: d.energy as WeekEnergyDay['energy'] }));
      if (week.length > 0) {
        const data: WeekEnergyData = { week };
        await setCachedWeekEnergy(env, user.line_user_id, data);
        return data;
      }
    }
  } catch (err) {
    console.error('generateWeekEnergy error:', err);
  }

  return { week: [] };
}
