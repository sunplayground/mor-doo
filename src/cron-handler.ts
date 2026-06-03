import { Env, User } from './types';
import { getAllUsers } from './user-service';
import { handleDailyReading, handleWeeklyReading } from './feature-handler';
import { pushMessage, templateButtonMessage } from './line-client';
import { logMessage, logEvent } from './log-service';
import { processMemoryBatch, regenerateMemoryFromLogs } from './memory-service';
import { generateToday, generateTak, getCachedToday } from './today-service';
import { generateWeekEnergy } from './week-energy-service';
import { generateTodayActions } from './today-actions-service';
import { generateDayTimeline } from './day-timeline-service';
import { resetDailyQuotas } from './quota-service';
import { getFeatureConfig, getSkillFile } from './skill-service';
import { chatCompletion, buildSystemPrompt } from './ai-client';
import { getMemory } from './memory-service';
import { getNatalChartSection } from './natal-calculator';

export async function handleCron(env: Env, cron: string): Promise<void> {
  const now = new Date();
  const utcHour = now.getUTCHours();
  const thHour = (utcHour + 7) % 24;

  if (cron === '0 0 * * *') {
    // 7am Bangkok — send morning push, process memory, reset quotas
    await handleDailyCron(env, thHour);
    await handleMemoryBatchCron(env);
    await resetDailyQuotas(env);
  }

  if (cron === '0 13 * * 0') {
    await handleWeeklyCron(env);
  }

  if (cron === '0 17 * * *') {
    // Midnight Bangkok — pre-compute today data for all users
    await handlePrecomputeCron(env);
    await handleMemoryRegenerateCron(env);
  }
}

async function handleDailyCron(env: Env, thHour: number): Promise<void> {
  if (thHour !== 7) return;

  const liffUrl = env.LIFF_ID ? `https://liff.line.me/${env.LIFF_ID}` : 'https://mor-doo.sunx-prod.workers.dev';
  const users = await getAllUsers(env);
  const onboarded = users.filter((u) => u.onboarding_complete && u.birth_date);

  for (const user of onboarded) {
    try {
      const todayData = await getCachedToday(env, user.line_user_id);
      const chips = todayData?.chips ?? undefined;
      const messages = await generateMorningPush(env, user, liffUrl, chips);
      await pushMessage(env, user.line_user_id, messages);
      await logEvent(env, user.line_user_id, 'daily_push', { hour: thHour });
    } catch (err) {
      console.error(`Daily push failed for ${user.line_user_id}:`, err);
    }
  }
}

export async function generateMorningPush(env: Env, user: User, liffUrl?: string, chips?: { color: string; colorHex: string; number: string; goldenTime: string }): Promise<any[]> {
  const url = liffUrl || (env.LIFF_ID ? `https://liff.line.me/${env.LIFF_ID}` : 'https://mor-doo.sunx-prod.workers.dev');

  if (!user.birth_date) {
    return [{ type: 'text', text: 'สวัสดีตอนเช้าค่ะ วันนี้พี่ดาวมีอะไรจะบอก ถามมาได้เลยนะคะ 🌟' }];
  }

  const config = await getFeatureConfig(env, 'morning-push');
  const skillMd = config?.enabled ? await getSkillFile(env, 'morning-push', 'skill.md') : '';
  const memoryMd = await getMemory(env, user.line_user_id);
  const model = config?.ai_model || env.AI_MODEL;

  const now = new Date();
  const dateStr = now.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long', timeZone: 'Asia/Bangkok' });
  const timeStr = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' });
  const dayRulers = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัส', 'ศุกร์', 'เสาร์'];
  const dayRuler = dayRulers[new Date(Date.now() + 7 * 3600 * 1000).getUTCDay()];

  const baseSkill = skillMd || 'คุณคือพี่ดาว หมอดู AI ที่ส่งข้อความทักตอนเช้าให้ผู้ใช้ ใช้น้ำเสียงอบอุ่น เป็นกันเอง วิเคราะห์จากโหราศาสตร์ไทย ทักษา และ Bazi';

  let natalSection = '';
  if (config?.natal_source_systems) {
    try {
      const systems: string[] = JSON.parse(config.natal_source_systems);
      natalSection = getNatalChartSection(user, systems);
    } catch {}
  }

  const chipsSection = chips?.color
    ? `# TODAY CARD — ค่าที่แสดงในแอปแล้ว ต้องใช้ค่าเหล่านี้ให้ตรงกันทุกตัว\nสีมงคล: ${chips.color}\nเลขมงคล: ${chips.number}\nเวลามงคล (เวลาทอง): ${chips.goldenTime}`
    : '';

  const systemPrompt = [
    baseSkill,
    memoryMd ? `# ข้อมูลผู้ใช้\n${memoryMd}` : '',
    natalSection || '',
    chipsSection,
    `# วันเวลาปัจจุบัน\nวัน${dateStr} เวลา ${timeStr} น. (เขตเวลากรุงเทพฯ)`,
    `# กฎสำคัญ — ตอบเป็น JSON เท่านั้น
ห้าม markdown ห้าม text อื่น ตอบเฉพาะ JSON object:
{"contents":[...]}

แต่ละ item ใน contents คือ LINE Flex text component รูปแบบ:
{"type":"text","text":"ข้อความ","wrap":true,"weight":"regular","size":"sm","flex":0}
`,
  ].filter(Boolean).join('\n\n');

  const userPrompt = `สร้างข้อความทักตอนเช้าสำหรับ ${user.name || 'คุณ'} เกิดวันที่ ${user.birth_date} เวลา ${user.birth_time || 'ไม่ระบุ'} วันนี้เป็นวัน${dayRuler}`;

  try {
    const raw = await chatCompletion(env, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ], model, config?.max_tokens || undefined);

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const contents = Array.isArray(parsed.contents) ? parsed.contents : [];
      if (contents.length > 0) {
        return [{
          type: 'flex',
          altText: `ดวงวันนี้ของ ${user.name || 'คุณ'} จากพี่ดาว`,
          contents: buildMorningFlexBubble(contents, url),
        }];
      }
    }
    return [{ type: 'text', text: raw.substring(0, 5000) }];
  } catch (err) {
    console.error('generateMorningPush error, falling back:', err);
    const fallback = await handleDailyReading(env, user);
    return [{ type: 'text', text: fallback }];
  }
}

function buildMorningFlexBubble(contents: any[], liffUrl: string): any {
  return {
    type: 'bubble',
    header: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '0px',
      contents: [{
        type: 'box',
        layout: 'horizontal',
        height: '90px',
        contents: [
          {
            type: 'image',
            url: 'https://pub-0fede2131f624312ba4ad9dddbb028a0.r2.dev/New%20Project%20(1).jpg',
            size: 'full',
            aspectMode: 'fit',
            gravity: 'center',
            flex: 0,
            aspectRatio: '3.31:1',
          },
          {
            type: 'box',
            layout: 'horizontal',
            position: 'absolute',
            offsetStart: '18px',
            offsetTop: '18px',
            paddingAll: '2px',
            paddingStart: '4px',
            paddingEnd: '4px',
            flex: 0,
            cornerRadius: '100px',
            height: '25px',
            contents: [{
              type: 'text',
              text: 'ดวงวันนี้',
              size: 'lg',
              color: '#000000',
              align: 'center',
              gravity: 'center',
              weight: 'bold',
            }],
          },
        ],
      }],
    },
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      contents: [{
        type: 'box',
        layout: 'vertical',
        contents,
      }],
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      contents: [{
        type: 'button',
        style: 'primary',
        color: '#000000',
        action: { type: 'uri', label: 'ดูต่อ', uri: liffUrl },
      }],
    },
  };
}

async function handleWeeklyCron(env: Env): Promise<void> {
  const liffId = env.LIFF_ID;
  const liffUrl = liffId ? `https://liff.line.me/${liffId}` : 'https://mor-doo.sunx-prod.workers.dev';

  const users = await getAllUsers(env);
  const onboarded = users.filter((u) => u.onboarding_complete && u.birth_date);

  for (const user of onboarded) {
    try {
      const reading = await handleWeeklyReading(env, user);

      const msg = templateButtonMessage(
        'ดวงประจำสัปดาห์จากพี่ดาว 🌙',
        [{ label: 'ดูต่อ', uri: liffUrl }]
      );

      await pushMessage(env, user.line_user_id, [
        { type: 'text', text: reading },
        msg,
      ]);

      await logEvent(env, user.line_user_id, 'weekly_push');
    } catch (err) {
      console.error(`Weekly push failed for ${user.line_user_id}:`, err);
    }
  }
}

async function handleMemoryBatchCron(env: Env): Promise<void> {
  const users = await getAllUsers(env);
  for (const user of users) {
    try {
      await processMemoryBatch(env, user.line_user_id);
    } catch (err) {
      console.error(`Memory batch failed for ${user.line_user_id}:`, err);
    }
  }
}

export async function handlePrecomputeCron(env: Env): Promise<void> {
  const users = await getAllUsers(env);
  const onboarded = users.filter(u => u.onboarding_complete && u.birth_date);
  for (const user of onboarded) {
    let todayChips: { color: string; colorHex: string; number: string; goldenTime: string } | undefined;
    try {
      const todayData = await generateToday(env, user);
      todayChips = todayData.chips ?? undefined;
    } catch (err) {
      console.error(`Precompute today failed for ${user.line_user_id}:`, err);
    }
    try {
      await generateTak(env, user);
    } catch (err) {
      console.error(`Precompute tak failed for ${user.line_user_id}:`, err);
    }
    try {
      await generateWeekEnergy(env, user);
    } catch (err) {
      console.error(`Precompute week-energy failed for ${user.line_user_id}:`, err);
    }
    try {
      await generateTodayActions(env, user);
    } catch (err) {
      console.error(`Precompute today-actions failed for ${user.line_user_id}:`, err);
    }
    try {
      await generateDayTimeline(env, user, todayChips);
    } catch (err) {
      console.error(`Precompute day-timeline failed for ${user.line_user_id}:`, err);
    }
  }
}

async function handleMemoryRegenerateCron(env: Env): Promise<void> {
  const users = await getAllUsers(env);
  const onboarded = users.filter(u => u.onboarding_complete && u.birth_date);
  for (const user of onboarded) {
    try {
      await regenerateMemoryFromLogs(env, user.line_user_id);
      await logEvent(env, user.line_user_id, 'memory_regenerate', {});
    } catch (err) {
      console.error(`Memory regenerate failed for ${user.line_user_id}:`, err);
    }
  }
}