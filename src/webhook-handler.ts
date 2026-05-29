import { Env, LINEWebhookBody } from './types';
import { replyMessage, textMessage, buttonMessage, getProfile } from './line-client';
import { getUserByLineId, createUser, updateUserOnboarding } from './user-service';
import { logEvent } from './log-service';
import {
  handleChat, handleDailyReading, handleBirthChart,
  handleTarot, handleDream, handlePhoneNumber,
  handleNameAnalysis, handleBadYear, handleAuspiciousTime,
  handleWeeklyReading, detectFeature,
} from './feature-handler';
import { updateMemoryFromConversation } from './memory-service';

export async function handleWebhook(env: Env, body: LINEWebhookBody): Promise<Response> {
  if (!body.events || body.events.length === 0) {
    return new Response('OK', { status: 200 });
  }

  for (const event of body.events) {
    const lineUserId = event.source?.userId;
    if (!lineUserId) continue;

    try {
      switch (event.type) {
        case 'follow':
          await handleFollow(env, lineUserId, event.replyToken!);
          break;
        case 'message':
          await handleMessage(env, lineUserId, event);
          break;
        case 'postback':
          await handlePostback(env, lineUserId, event);
          break;
        case 'unfollow':
          await logEvent(env, lineUserId, 'unfollow');
          break;
      }
    } catch (err) {
      console.error('Webhook event error:', err);
    }
  }

  return new Response('OK', { status: 200 });
}

async function handleFollow(env: Env, lineUserId: string, replyToken: string) {
  await logEvent(env, lineUserId, 'follow');

  let profile;
  try {
    profile = await getProfile(env, lineUserId);
  } catch {
    profile = { displayName: 'User' };
  }

  let user = await getUserByLineId(env, lineUserId);
  if (!user) {
    user = await createUser(env, lineUserId, profile.displayName, profile.pictureUrl);
  }

  if (!user.onboarding_complete) {
    const welcomeMsg = `สวัสดีค่ะ ${profile.displayName}! 🌟\n\nยินดีต้อนรับสู่พี่ดาว — หมอดู AI ส่วนตัวของคุณ\n\nก่อนอื่น พี่ดาวต้องรู้จักคุณนิดหน่อยนะคะ\n\nคุณชื่ออะไรคะ?`;
    await replyMessage(env, replyToken, [textMessage(welcomeMsg)]);
  } else {
    const welcomeBack = `สวัสดีค่ะ ${user.name || profile.displayName}! กลับมาแล้วนะคะ 🌟\n\nวันนี้อยากรู้อะไรพี่ดาวไหมคะ?`;
    await replyMessage(env, replyToken, [textMessage(welcomeBack)]);
  }
}

const ONBOARDING_STATES: Record<string, string> = {
  'awaiting_name': 'name',
  'awaiting_birthdate': 'birthdate',
  'awaiting_birthtime': 'birthtime',
  'awaiting_phone': 'phone',
};

async function handleMessage(env: Env, lineUserId: string, event: any) {
  if (!event.replyToken) return;
  const text = event.message?.text?.trim();
  if (!text) return;

  let user = await getUserByLineId(env, lineUserId);
  if (!user) {
    let profile;
    try { profile = await getProfile(env, lineUserId); } catch { profile = { displayName: 'User' }; }
    user = await createUser(env, lineUserId, profile.displayName, profile.pictureUrl);
  }

  if (!user.onboarding_complete) {
    await handleOnboarding(env, user, text, event.replyToken);
    return;
  }

  let response: string;
  const detectedFeature = detectFeature(text);

  if (detectedFeature === 'dream') {
    response = await handleDream(env, user, text);
  } else if (detectedFeature === 'tarot') {
    response = await handleTarot(env, user, text);
  } else if (detectedFeature === 'phone-number') {
    response = await handlePhoneNumber(env, user, text);
  } else if (detectedFeature === 'name-analysis') {
    response = await handleNameAnalysis(env, user, text);
  } else if (detectedFeature === 'bad-year') {
    response = await handleBadYear(env, user);
  } else if (detectedFeature === 'auspicious-time') {
    response = await handleAuspiciousTime(env, user);
  } else if (detectedFeature === 'birth-chart') {
    response = await handleBirthChart(env, user);
  } else if (detectedFeature === 'daily-reading') {
    response = await handleDailyReading(env, user);
  } else if (detectedFeature === 'weekly-reading') {
    response = await handleWeeklyReading(env, user);
  } else {
    response = await handleChat(env, user, text);
  }

  const chunks = splitMessage(response);
  await replyMessage(env, event.replyToken, chunks.map(textMessage));

  updateMemoryFromConversation(env, user.line_user_id, text, response, detectedFeature || 'chat').catch(() => {});
}

async function handleOnboarding(env: Env, user: any, text: string, replyToken: string) {
  const state = await getOnboardingState(env, user.line_user_id);

  if (!state || state === 'start') {
    await setOnboardingState(env, user.line_user_id, 'awaiting_name');
    await replyMessage(env, replyToken, [textMessage('คุณชื่ออะไรคะ? 🌸')]);
    return;
  }

  if (state === 'awaiting_name') {
    await env.DB.prepare('UPDATE users SET name = ? WHERE line_user_id = ?')
      .bind(text, user.line_user_id)
      .run();
    await setOnboardingState(env, user.line_user_id, 'awaiting_birthdate');
    await replyMessage(env, replyToken, [textMessage(`ยินดีที่ได้รู้จักค่ะ ${text}! 🌸\n\nวันเกิดของคุณคือวันที่เท่าไหร่คะ? (เช่น 15/03/1998)`)]);
    return;
  }

  if (state === 'awaiting_birthdate') {
    const dateRegex = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/;
    const match = text.match(dateRegex);
    if (!match) {
      await replyMessage(env, replyToken, [textMessage('รูปแบบวันที่ไม่ถูกต้องค่ะ กรุณาใส่เป็น วัน/เดือน/ปี (เช่น 15/03/1998) 📅')]);
      return;
    }
    const [, day, month, year] = match;
    const birthDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    await env.DB.prepare('UPDATE users SET birth_date = ? WHERE line_user_id = ?')
      .bind(birthDate, user.line_user_id)
      .run();
    await setOnboardingState(env, user.line_user_id, 'awaiting_birthtime');
    await replyMessage(env, replyToken, [textMessage(`เกิดวันที่ ${day}/${month}/${year} ค่ะ! 📅\n\nเกิดเวลากี่โมงคะ? (เช่น 14:30 หรือ บ่ายโมงครึ่ง)\n\nถ้าจำไม่ได้ พิมพ์ "ไม่ระบุ" ได้เลยค่ะ`)]);
    return;
  }

  if (state === 'awaiting_birthtime') {
    const birthTime = text === 'ไม่ระบุ' ? null : text;
    await env.DB.prepare('UPDATE users SET birth_time = ? WHERE line_user_id = ?')
      .bind(birthTime, user.line_user_id)
      .run();
    await setOnboardingState(env, user.line_user_id, 'awaiting_phone');
    await replyMessage(env, replyToken, [textMessage(`ขอบคุณค่ะ! 🕐\n\nเบอร์โทรศัพท์ของคุณคือเบอร์อะไรคะ? (สำหรับการติดต่อและบริการพิเศษ)`)]);
    return;
  }

  if (state === 'awaiting_phone') {
    await updateUserOnboarding(env, user.line_user_id, {
      name: user.name || text,
      phone: text,
      birthDate: user.birth_date!,
      birthTime: user.birth_time || 'ไม่ระบุ',
    });

    await clearOnboardingState(env, user.line_user_id);

    const memoryContent = `# User Memory\n\n## Profile\n- Name: ${user.name}\n- Birth Date: ${user.birth_date}\n- Birth Time: ${user.birth_time || 'ไม่ระบุ'}\n- Phone: ${text}\n- Onboarded: ${new Date().toISOString()}\n`;
    const { setMemory } = await import('./memory-service');
    await setMemory(env, user.line_user_id, memoryContent);

    const completeMsg = `เรียบร้อยแล้วค่ะ! ${user.name} 🎉\n\nพี่ดาวรู้จักคุณแล้ว พร้อมทำนายดวงให้แล้วค่ะ!\n\nลองถามพี่ดาวได้เลยนะคะ เช่น:\n• "ดูดวงวันนี้"\n• "ผูกดวงให้หน่อย"\n• "ทำนายฝัน..."\n• "เบอร์นี้มงคลไหม 081-234-5678"\n• "จัดไพ่ทาโร่"\n• "ปีนี้ชงไหม"`;

    await replyMessage(env, replyToken, [textMessage(completeMsg)]);
    return;
  }
}

async function handlePostback(env: Env, lineUserId: string, event: any) {
  const data = event.postback?.data;
  if (!data || !event.replyToken) return;

  const user = await getUserByLineId(env, lineUserId);
  if (!user || !user.onboarding_complete) return;

  let response: string = '';

  switch (data) {
    case 'daily_reading':
      response = await handleDailyReading(env, user);
      break;
    case 'weekly_reading':
      response = await handleWeeklyReading(env, user);
      break;
    case 'birth_chart':
      response = await handleBirthChart(env, user);
      break;
    case 'tarot':
      response = await handleTarot(env, user);
      break;
    case 'bad_year':
      response = await handleBadYear(env, user);
      break;
    case 'auspicious_time':
      response = await handleAuspiciousTime(env, user);
      break;
    case 'reaction_accurate':
      await logEvent(env, lineUserId, 'reaction', { reaction: 'accurate' });
      response = 'ดีใจด้วยค่ะที่ทำนายตรง! 🌟 มีอะไรสงสัยถามพี่ดาวได้เลยนะคะ';
      break;
    case 'reaction_inaccurate':
      await logEvent(env, lineUserId, 'reaction', { reaction: 'inaccurate' });
      response = 'ขอบคุณที่บอกค่ะ พี่ดาวจะพยายามทำนายให้แม่นขึ้นนะคะ 💪 ลองถามใหม่ได้เลย';
      break;
    case 'reaction_confused':
      await logEvent(env, lineUserId, 'reaction', { reaction: 'confused' });
      response = 'ถ้างงตรงไหน ถามพี่ดาวได้เลยค่ะ พี่ดาวยินดีอธิบายให้! 🤗';
      break;
    default:
      response = '';
  }

  if (response) {
    const chunks = splitMessage(response);
    await replyMessage(env, event.replyToken, chunks.map(textMessage));
  }
}

async function getOnboardingState(env: Env, lineUserId: string): Promise<string | null> {
  const result = await env.DB.prepare(
    "SELECT value FROM admin_settings WHERE key = ?"
  ).bind(`onboarding_${lineUserId}`).first();
  return (result as any)?.value || null;
}

async function setOnboardingState(env: Env, lineUserId: string, state: string): Promise<void> {
  await env.DB.prepare(
    "INSERT OR REPLACE INTO admin_settings (key, value) VALUES (?, ?)"
  ).bind(`onboarding_${lineUserId}`, state).run();
}

async function clearOnboardingState(env: Env, lineUserId: string): Promise<void> {
  await env.DB.prepare("DELETE FROM admin_settings WHERE key = ?")
    .bind(`onboarding_${lineUserId}`).run();
}

function splitMessage(text: string, maxLen: number = 2000): string[] {
  if (text.length <= maxLen) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining);
      break;
    }
    let splitAt = remaining.lastIndexOf('\n', maxLen);
    if (splitAt === -1 || splitAt < maxLen * 0.5) splitAt = maxLen;
    chunks.push(remaining.substring(0, splitAt));
    remaining = remaining.substring(splitAt).trim();
  }
  return chunks;
}
