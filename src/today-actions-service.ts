import { Env, User, TodayAction, TodayActionsData } from './types';
import { chatCompletion, buildSystemPrompt } from './ai-client';
import { getSkillFile, getFeatureConfig } from './skill-service';
import { getMemory } from './memory-service';
import { getNatalChartSection } from './natal-calculator';

const ACTIONS = [
  { id: 'call',    name: 'โทรหาลูกค้า / ติดต่อ',       icon: 'phone' },
  { id: 'present', name: 'นำเสนอ / พรีเซนต์',           icon: 'presentation' },
  { id: 'sign',    name: 'เซ็นสัญญา / ตัดสินใจใหญ่',    icon: 'file-pen' },
  { id: 'text',    name: 'ส่งข้อความสำคัญ',              icon: 'send' },
  { id: 'buy',     name: 'ซื้อของใหญ่ / ลงทุน',         icon: 'credit-card' },
  { id: 'reject',  name: 'ปฏิเสธ / ตัดความสัมพันธ์',    icon: 'x-circle' },
];

export async function getCachedTodayActions(env: Env, lineUserId: string): Promise<TodayActionsData | null> {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
  const row = await env.DB.prepare(
    "SELECT content FROM daily_cache WHERE line_user_id = ? AND cache_type = 'today-actions' AND DATE(datetime(created_at, '+7 hours')) = ? ORDER BY created_at DESC LIMIT 1"
  ).bind(lineUserId, today).first();
  if (!row) return null;
  try {
    return JSON.parse((row as any).content);
  } catch {
    return null;
  }
}

export async function setCachedTodayActions(env: Env, lineUserId: string, data: TodayActionsData): Promise<void> {
  await env.DB.prepare(
    "INSERT OR REPLACE INTO daily_cache (line_user_id, cache_type, content, created_at) VALUES (?, 'today-actions', ?, datetime('now'))"
  ).bind(lineUserId, JSON.stringify(data)).run();
}

export async function generateTodayActions(env: Env, user: User): Promise<TodayActionsData> {
  const cached = await getCachedTodayActions(env, user.line_user_id);
  if (cached) return cached;

  if (!user.birth_date) {
    return { actions: [], updatedAt: '' };
  }

  const config = await getFeatureConfig(env, 'today-actions');
  const skillMd = await getSkillFile(env, 'today-actions', 'skill.md');
  const referenceMd = await getSkillFile(env, 'today-actions', 'reference.md');
  const memoryMd = await getMemory(env, user.line_user_id);
  const model = config?.ai_model || env.AI_MODEL;

  const now = new Date(Date.now() + 7 * 3600 * 1000);
  const dateStr = now.toLocaleDateString('th-TH', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Bangkok',
  });
  const updatedAt = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' });

  const actionList = ACTIONS.map(a => `- ${a.id}: ${a.name}`).join('\n');

  const userPrompt = `วิเคราะห์ความเหมาะสมของกิจกรรมต่อไปนี้สำหรับวันนี้ (${dateStr})
สำหรับคนเกิดวันที่ ${user.birth_date} เวลา ${user.birth_time || 'ไม่ระบุ'}

กิจกรรมที่ต้องวิเคราะห์:
${actionList}`;

  let systemPart = buildSystemPrompt(skillMd, referenceMd, memoryMd, [], 'today-actions');
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
      const validEnergies = ['good', 'moderate', 'bad'];
      const actions: TodayAction[] = (parsed.actions || [])
        .filter((a: any) => a.id && validEnergies.includes(a.energy))
        .map((a: any) => ({
          id: a.id,
          name: ACTIONS.find(x => x.id === a.id)?.name || a.id,
          desc: a.desc || '',
          energy: a.energy as TodayAction['energy'],
          time: a.time || '',
          icon: ACTIONS.find(x => x.id === a.id)?.icon || 'circle',
        }));

      if (actions.length > 0) {
        const data: TodayActionsData = { actions, updatedAt };
        await setCachedTodayActions(env, user.line_user_id, data);
        return data;
      }
    }
  } catch (err) {
    console.error('generateTodayActions error:', err);
  }

  return { actions: [], updatedAt };
}
