import { Env, LINEWebhookBody, FeatureName, FeatureTask, User } from './types';
import { handleWebhook } from './webhook-handler';
import { getWebAppHtml } from './web-app';
import { getAdminHtml } from './admin-panel';
import { handleCron } from './cron-handler';
import { getUserByLineId, createUser, updateUserOnboarding, getAllUsers } from './user-service';
import { verifyIdToken, getProfile, pushMessage, templateButtonMessage } from './line-client';
import { setMemory, getMemory, regenerateMemoryFromLogs } from './memory-service';
import { logEvent, logMessage, getMessageStats, getMessageHistory } from './log-service';
import { initializeFeatureConfigs, getFeatureConfig, getAllFeatureConfigs, upsertFeatureConfig, setSkillFile, getSkillFile } from './skill-service';
import {
  handleChat, handleDailyReading, handleWeeklyReading, handleBirthChart,
  handleTarot, handleDream, handlePhoneNumber, handleNameAnalysis,
  handleBadYear, handleAuspiciousTime,
} from './feature-handler';
import { generateToday, generateTak, generateRightNow, generateCompatibility } from './today-service';
import { generateWeekEnergy } from './week-energy-service';
import { generateTodayActions } from './today-actions-service';
import { generateDayTimeline } from './day-timeline-service';
import { getQuota, incrementQuota } from './quota-service';
import { createPendingResult, getResult, getRecentResults, getCachedFeature, setCachedFeature } from './result-service';
import { handleQueueBatch } from './queue-handler';
import { calculateNatalChart } from './natal-calculator';
import { generateMorningPush } from './cron-handler';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === 'OPTIONS') {
      return cors(new Response(null, { status: 204 }));
    }

    try {
      if (path === '/api/webhook' && request.method === 'POST') {
        const body = await request.json() as LINEWebhookBody;
        ctx.waitUntil(handleWebhook(env, body));
        return new Response('OK', { status: 200 });
      }

      if (path === '/' || path === '/app' || path === '/liff') {
        return html(getWebAppHtml(env));
      }

      if (path === '/admin') {
        return html(getAdminHtml());
      }

      if (path.startsWith('/api/auth/')) {
        return await handleAuthRoutes(path, request, env);
      }

      if (path === '/api/natal-chart' && request.method === 'GET') {
        return await handleNatalChartRoute(request, env, url);
      }

      if (path.startsWith('/api/feature/')) {
        return await handleFeatureRoutes(path, request, env);
      }

      if (path.startsWith('/api/admin/')) {
        return await handleAdminRoutes(path, request, env);
      }

      return new Response('Not Found', { status: 404 });
    } catch (err: any) {
      console.error('Unhandled error:', err);
      return cors(Response.json({ error: err.message }, { status: 500 }));
    }
  },

  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(handleCron(env, controller.cron));
  },

  async queue(batch: MessageBatch<FeatureTask>, env: Env): Promise<void> {
    await handleQueueBatch(batch, env);
  },
} satisfies ExportedHandler<Env, FeatureTask>;

async function requireUser(request: Request, env: Env): Promise<{ user: User; response?: Response }> {
  const userId = request.headers.get('X-User-Id');
  if (!userId) {
    return { user: null as any, response: cors(Response.json({ error: 'Missing X-User-Id header' }, { status: 401 })) };
  }
  const user = await getUserByLineId(env, userId);
  if (!user) {
    return { user: null as any, response: cors(Response.json({ error: 'User not found' }, { status: 404 })) };
  }
  return { user };
}

async function handleFeatureRoutes(path: string, request: Request, env: Env): Promise<Response> {
  const { user, response } = await requireUser(request, env);
  if (response) return response;

  // GET endpoints (cached/quick - no queue needed)
  if (request.method === 'GET') {
    if (path === '/api/feature/natal-chart') {
      if (!user.birth_date) {
        return cors(Response.json({ error: 'Birth date not set. Please complete onboarding.' }, { status: 422 }));
      }
      const result = calculateNatalChart({
        birthDate: user.birth_date,
        birthTime: user.birth_time || undefined,
        lat: user.birth_location ? parseFloat(user.birth_location.split(',')[0]) : undefined,
        lng: user.birth_location ? parseFloat(user.birth_location.split(',')[1]) : undefined,
      });
      return cors(Response.json(result));
    }

    if (path === '/api/feature/today') {
      const data = await generateToday(env, user);
      return cors(Response.json(data));
    }
    if (path === '/api/feature/week-energy') {
      const data = await generateWeekEnergy(env, user);
      return cors(Response.json(data));
    }
    if (path === '/api/feature/today-actions') {
      const data = await generateTodayActions(env, user);
      return cors(Response.json(data));
    }
    if (path === '/api/feature/tak') {
      const cached = await getCachedFeature(env, user.line_user_id, 'tak');
      if (cached) {
        return cors(Response.json({ result: cached, cached: true }));
      }
      const tak = await generateTak(env, user);
      await setCachedFeature(env, user.line_user_id, 'tak', tak);
      return cors(Response.json({ result: tak }));
    }
    if (path === '/api/feature/quota') {
      const quota = await getQuota(env, user.line_user_id);
      return cors(Response.json(quota));
    }
    if (path.startsWith('/api/feature/result/')) {
      const resultId = path.replace('/api/feature/result/', '');
      const result = await getResult(env, resultId);
      if (!result) return cors(Response.json({ error: 'Not found' }, { status: 404 }));
      if (result.lineUserId !== user.line_user_id) return cors(Response.json({ error: 'Forbidden' }, { status: 403 }));
      return cors(Response.json(result));
    }
    if (path === '/api/feature/results') {
      const results = await getRecentResults(env, user.line_user_id, 20);
      return cors(Response.json({ results }));
    }
    if (path === '/api/feature/chat-history') {
      const messages = await getMessageHistory(env, user.line_user_id, 50);
      const chatMsgs = messages
        .filter((m: any) => m.feature === 'chat' || m.feature === 'ask')
        .reverse()
        .map((m: any) => ({ role: m.direction === 'inbound' ? 'user' : 'ai', content: m.content, feature: m.feature, createdAt: m.created_at }));
      return cors(Response.json({ messages: chatMsgs }));
    }
  }

  if (request.method !== 'POST') {
    return cors(Response.json({ error: 'Method not allowed' }, { status: 405 }));
  }

  const body: any = await request.json().catch(() => ({}));
  const message = body.message || body.question || '';

  // Quick sync endpoints (no queue needed)
  if (path === '/api/feature/chat') {
    const quota = await getQuota(env, user.line_user_id);
    if (quota.used >= quota.limit) {
      return cors(Response.json({ result: 'ขออภัยค่ะ ข้อความวันนี้ใช้ครดแล้ว (3 ข้อความ/วัน) — กลับมาใหม่พรุ่งนี้นะคะ', quotaLimit: true }));
    }
    await incrementQuota(env, user.line_user_id);
    await logMessage(env, user.line_user_id, 'inbound', message, 'chat');
    const result = await handleChat(env, user, message);
    await logMessage(env, user.line_user_id, 'outbound', result, 'chat');
    return cors(Response.json({ result }));
  }

  if (path === '/api/feature/timing/right-now') {
    const action = body.action || 'call';
    const cacheKey = 'timing-right-now-' + action;
    const noCache = body._regenerate === true;
    if (noCache) {
      await env.DB.prepare('DELETE FROM daily_cache WHERE line_user_id = ? AND cache_type = ?').bind(user.line_user_id, cacheKey).run();
    }
    if (!noCache) {
      const cached = await getCachedFeature(env, user.line_user_id, cacheKey);
      if (cached) {
        return cors(Response.json({ result: cached, cached: true }));
      }
    }
    const result = await generateRightNow(env, user, action);
    await setCachedFeature(env, user.line_user_id, cacheKey, result);
    return cors(Response.json({ result }));
  }

  if (path === '/api/feature/compatibility') {
    const otherBirthDate = body.otherBirthDate || body.message || '';
    const noCache = body._regenerate === true;
    if (noCache) {
      await env.DB.prepare('DELETE FROM daily_cache WHERE line_user_id = ? AND cache_type = ?').bind(user.line_user_id, 'compatibility').run();
    }
    if (!noCache) {
      const cached = await getCachedFeature(env, user.line_user_id, 'compatibility');
      if (cached) {
        return cors(Response.json({ result: cached, cached: true }));
      }
    }
    const result = await generateCompatibility(env, user, otherBirthDate);
    await setCachedFeature(env, user.line_user_id, 'compatibility', result);
    return cors(Response.json({ result }));
  }

  if (path === '/api/feature/day-timeline') {
    const data = await generateDayTimeline(env, user, body.today_chips);
    return cors(Response.json(data));
  }

  // All other features: check cache first, then async via queue
  const feature = path.replace('/api/feature/', '');

  const noCache = body._regenerate === true;

  // For cacheable features without user-specific input, check daily cache first
  const cacheableFeatures = ['daily-reading', 'weekly-reading', 'birth-chart', 'bad-year', 'auspicious-time', 'timing-right-now', 'compatibility', 'tak'];
  if (noCache) {
    // Delete old cached result so a refresh won't show stale data
    await env.DB.prepare('DELETE FROM daily_cache WHERE line_user_id = ? AND cache_type = ?').bind(user.line_user_id, feature).run();
  }
  if (cacheableFeatures.includes(feature) && !noCache) {
    const cached = await getCachedFeature(env, user.line_user_id, feature);
    if (cached) {
      return cors(Response.json({ result: cached, cached: true }));
    }
  }

  // Features with user input (tarot, dream, etc.) are never cached per-input
  // but we still check if there's a recent completed result for same params
  const resultId = await createPendingResult(env, user.line_user_id, feature, JSON.stringify(body));

  const task: FeatureTask = {
    resultId,
    lineUserId: user.line_user_id,
    feature,
    message,
    otherBirthDate: body.otherBirthDate,
    action: body.action,
    todayChips: body.today_chips,
    compassContext: body.compass_context,
  };

  try {
    await env.FEATURE_QUEUE.send(task);
  } catch (err: any) {
    // Queue unavailable — fall back to sync
    console.error('Queue send failed, falling back to sync:', err);
    let result: string;
    switch (feature) {
      case 'daily-reading': result = await handleDailyReading(env, user, body.today_chips); break;
      case 'weekly-reading': result = await handleWeeklyReading(env, user, body.compass_context); break;
      case 'birth-chart': result = await handleBirthChart(env, user); break;
      case 'tarot': result = await handleTarot(env, user, message || undefined); break;
      case 'dream': result = await handleDream(env, user, message); break;
      case 'phone-number': result = await handlePhoneNumber(env, user, message); break;
      case 'name-analysis': result = await handleNameAnalysis(env, user, message); break;
      case 'bad-year': result = await handleBadYear(env, user); break;
      case 'friend-chart': result = await handleFriendChart(env, user, body); break;
      case 'auspicious-time': result = await handleAuspiciousTime(env, user); break;
      case 'timing-right-now': result = await generateRightNow(env, user, body.action || 'call'); break;
      case 'compatibility': result = await generateCompatibility(env, user, body.otherBirthDate || ''); break;
      case 'today': result = JSON.stringify(await generateToday(env, user)); break;
      case 'tak': result = await generateTak(env, user); break;
      default: return cors(Response.json({ error: 'Unknown feature' }, { status: 404 }));
    }
    await logMessage(env, user.line_user_id, 'outbound', result, feature);
    if (cacheableFeatures.includes(feature)) {
      await setCachedFeature(env, user.line_user_id, feature, result);
    }
    return cors(Response.json({ result, resultId }));
  }

  return cors(Response.json({ resultId, status: 'pending' }));
}

async function handleFriendChart(env: Env, user: User, body: any): Promise<string> {
  const { chatCompletion, buildSystemPrompt } = await import('./ai-client');
  const { getFeatureConfig } = await import('./skill-service');
  const { getMemory } = await import('./memory-service');
  const { getSkillFile } = await import('./skill-service');

  const config = await getFeatureConfig(env, 'friend-chart');
  const skillMd = await getSkillFile(env, 'friend-chart', 'skill.md');
  const referenceMd = await getSkillFile(env, 'friend-chart', 'reference.md');
  const memoryMd = await getMemory(env, user.line_user_id);
  const model = config?.ai_model || env.AI_MODEL;

  const systemPrompt = buildSystemPrompt(skillMd, referenceMd, memoryMd, [], 'friend-chart');
  const prompt = body.message || `เปรียบเทียบดวงชะตาของฉัน (เกิด ${user.birth_date} เวลา ${user.birth_time || 'ไม่ระบุ'}) กับคนที่เกิดวันที่ ${body.otherBirthDate || 'ไม่ระบุ'}`;

  return chatCompletion(env, [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: prompt },
  ], model);
}

async function handleAuthRoutes(path: string, request: Request, env: Env): Promise<Response> {
  if (path === '/api/auth/line-login' && request.method === 'POST') {
    const { lineUserId, displayName, pictureUrl } = await request.json() as {
      lineUserId: string; displayName?: string; pictureUrl?: string;
    };

    if (!lineUserId) {
      return cors(Response.json({ error: 'Missing lineUserId' }, { status: 400 }));
    }

    let user = await getUserByLineId(env, lineUserId);
    if (!user) {
      user = await createUser(env, lineUserId, displayName || 'User', pictureUrl);
    }

    return cors(Response.json({
      onboarded: user.onboarding_complete === 1,
      userId: user.line_user_id,
      tier: user.tier,
      subscriptionExpiresAt: user.subscription_expires_at,
      user: { name: user.name, birthDate: user.birth_date, birthTime: user.birth_time, phone: user.phone, pictureUrl: user.picture_url },
    }));
  }

  if (path === '/api/auth/verify' && request.method === 'POST') {
    const { idToken } = await request.json() as { idToken: string };
    const verified = await verifyIdToken(env, idToken);

    if (verified.error || !verified.sub) {
      return cors(Response.json({ error: 'Invalid token' }, { status: 401 }));
    }

    let user = await getUserByLineId(env, verified.sub);
    if (!user) {
      let profile;
      try { profile = await getProfile(env, verified.sub); } catch { profile = { displayName: verified.name || 'User' }; }
      user = await createUser(env, verified.sub, profile.displayName, profile.pictureUrl);
    }

    return cors(Response.json({
      onboarded: user.onboarding_complete === 1,
      userId: user.line_user_id,
      tier: user.tier,
      subscriptionExpiresAt: user.subscription_expires_at,
      user: { name: user.name, birthDate: user.birth_date, birthTime: user.birth_time, phone: user.phone, pictureUrl: user.picture_url },
    }));
  }

  if (path === '/api/auth/onboard' && request.method === 'POST') {
    const body = await request.json() as {
      userId?: string; name: string; birthdate: string; birthtime: string; phone: string;
    };

    let lineUserId: string;

    if (body.userId) {
      const user = await getUserByLineId(env, body.userId);
      if (!user) {
        return cors(Response.json({ error: 'User not found' }, { status: 404 }));
      }
      lineUserId = body.userId;
    } else {
      lineUserId = 'web-' + crypto.randomUUID().replace(/-/g, '').substring(0, 16);
      const existing = await getUserByLineId(env, lineUserId);
      if (!existing) {
        await createUser(env, lineUserId, body.name);
      }
    }

    await updateUserOnboarding(env, lineUserId, {
      name: body.name, phone: body.phone, birthDate: body.birthdate, birthTime: body.birthtime,
    });

    const memoryContent = `# User Memory\n\n## Profile\n- Name: ${body.name}\n- Birth Date: ${body.birthdate}\n- Birth Time: ${body.birthtime}\n- Phone: ${body.phone}\n- Onboarded: ${new Date().toISOString()}\n`;
    await setMemory(env, lineUserId, memoryContent);
    await logEvent(env, lineUserId, 'onboarded', { name: body.name });

    return cors(Response.json({ success: true, userId: lineUserId }));
  }

  if (path === '/api/auth/me' && request.method === 'GET') {
    const { user, response } = await requireUser(request, env);
    if (response) return response;
    const memory = await getMemory(env, user.line_user_id);
    return cors(Response.json({
      ...user,
      memory,
    }));
  }

  return cors(Response.json({ error: 'Not found' }, { status: 404 }));
}

async function handleAdminRoutes(path: string, request: Request, env: Env): Promise<Response> {
  if (path === '/api/admin/login' && request.method === 'POST') {
    const { password } = await request.json() as { password: string };
    if (password === env.ADMIN_PASSWORD) {
      return cors(Response.json({ success: true, token: env.ADMIN_PASSWORD }));
    }
    return cors(Response.json({ success: false }, { status: 401 }));
  }

  const auth = request.headers.get('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) {
    return cors(Response.json({ error: 'Unauthorized' }, { status: 401 }));
  }

  const token = auth.substring(7);
  if (token !== env.ADMIN_PASSWORD && token.length < 10) {
    return cors(Response.json({ error: 'Unauthorized' }, { status: 401 }));
  }

  await initializeFeatureConfigs(env);

  if (path === '/api/admin/stats') {
    return cors(Response.json(await getMessageStats(env)));
  }

  if (path === '/api/admin/features') {
    return cors(Response.json(await getAllFeatureConfigs(env)));
  }

  const featureMatch = path.match(/^\/api\/admin\/features\/(.+)$/);
  if (featureMatch) {
    const feature = featureMatch[1];

    if (request.method === 'GET') {
      const config = await getFeatureConfig(env, feature);
      const skillMd = await getSkillFile(env, feature as any, 'skill.md');
      const referenceMd = await getSkillFile(env, feature as any, 'reference.md');
      const parsedNatal = config?.natal_source_systems ? (() => { try { return JSON.parse(config.natal_source_systems!); } catch { return []; } })() : [];
      return cors(Response.json({ ...config, skillMd, referenceMd, natalSourceSystems: parsedNatal }));
    }

    if (request.method === 'PUT') {
      const body = await request.json() as { ai_model?: string; enabled?: number; max_tokens?: number; natal_source_systems?: string[]; skill_md?: string; reference_md?: string; };
      const natalVal = body.natal_source_systems !== undefined ? JSON.stringify(body.natal_source_systems) : undefined;
      await upsertFeatureConfig(env, feature, { ai_model: body.ai_model, enabled: body.enabled, max_tokens: body.max_tokens, natal_source_systems: natalVal });
      if (body.skill_md !== undefined) await setSkillFile(env, feature as any, 'skill.md', body.skill_md);
      if (body.reference_md !== undefined) await setSkillFile(env, feature as any, 'reference.md', body.reference_md);
      return cors(Response.json({ success: true }));
    }
  }

  if (path === '/api/admin/users') {
    return cors(Response.json(await getAllUsers(env)));
  }

  if (path === '/api/admin/logs') {
    return cors(Response.json(await getMessageHistory(env, '', 100)));
  }

  if (path.startsWith('/api/admin/users/') && path.endsWith('/memory')) {
    const userId = path.replace('/api/admin/users/', '').replace('/memory', '');
    const user = await getUserByLineId(env, userId);
    if (!user) return cors(Response.json({ error: 'User not found' }, { status: 404 }));
    const memory = await getMemory(env, userId);
    return cors(Response.json({ memory }));
  }

  if (path.startsWith('/api/admin/users/') && path.endsWith('/regenerate-memory') && request.method === 'POST') {
    const userId = path.replace('/api/admin/users/', '').replace('/regenerate-memory', '');
    const user = await getUserByLineId(env, userId);
    if (!user) return cors(Response.json({ error: 'User not found' }, { status: 404 }));
    try {
      const memory = await regenerateMemoryFromLogs(env, userId);
      return cors(Response.json({ success: true, memory }));
    } catch (err: any) {
      return cors(Response.json({ error: err.message }, { status: 500 }));
    }
  }

  if (path === '/api/admin/trigger-precompute' && request.method === 'POST') {
    try {
      const { handlePrecomputeCron } = await import('./cron-handler');
      await handlePrecomputeCron(env);
      return cors(Response.json({ success: true, message: 'Pre-compute completed' }));
    } catch (err: any) {
      return cors(Response.json({ error: err.message }, { status: 500 }));
    }
  }

  if (path === '/api/admin/test-push' && request.method === 'POST') {
    const { lineUserId, pushType } = await request.json() as { lineUserId: string; pushType?: string };
    const user = await getUserByLineId(env, lineUserId);
    if (!user) return cors(Response.json({ error: 'User not found' }, { status: 404 }));
    if (!user.birth_date) return cors(Response.json({ error: 'User has no birth date' }, { status: 400 }));
    try {
      const liffUrl = env.LIFF_ID ? `https://liff.line.me/${env.LIFF_ID}` : 'https://mor-doo.sunx-prod.workers.dev';
      let messages: any[];
      if (pushType === 'weekly') {
        const text = await handleWeeklyReading(env, user);
        messages = [
          { type: 'text', text },
          templateButtonMessage('ดวงประจำสัปดาห์จากพี่ดาว 🌙', [{ label: 'ดูต่อ', uri: liffUrl }]),
        ];
      } else {
        messages = await generateMorningPush(env, user, liffUrl);
      }
      await pushMessage(env, user.line_user_id, messages);
      const preview = messages[0]?.altText || messages[0]?.text || 'sent';
      return cors(Response.json({ success: true, preview: preview.substring(0, 200) }));
    } catch (err: any) {
      return cors(Response.json({ error: err.message }, { status: 500 }));
    }
  }

  return cors(Response.json({ error: 'Not found' }, { status: 404 }));
}

async function handleNatalChartRoute(request: Request, env: Env, url: URL): Promise<Response> {
  const userId = request.headers.get('X-User-Id');

  // Try auth path first
  if (userId) {
    const user = await getUserByLineId(env, userId);
    if (user?.birth_date) {
      const result = calculateNatalChart({
        birthDate: user.birth_date,
        birthTime: user.birth_time || undefined,
        lat: user.birth_location ? parseFloat(user.birth_location.split(',')[0]) : undefined,
        lng: user.birth_location ? parseFloat(user.birth_location.split(',')[1]) : undefined,
      });
      return cors(Response.json(result));
    }
  }

  // Fallback: query string params (useful for testing)
  const birthDate = url.searchParams.get('date');
  if (!birthDate) {
    return cors(Response.json({
      error: 'Provide X-User-Id header (authenticated) or ?date=YYYY-MM-DD query param.',
      example: '/api/natal-chart?date=1990-07-26&time=13:35&lat=13.7563&lng=100.5018',
    }, { status: 400 }));
  }

  const result = calculateNatalChart({
    birthDate,
    birthTime: url.searchParams.get('time') || undefined,
    lat: url.searchParams.get('lat') ? parseFloat(url.searchParams.get('lat')!) : undefined,
    lng: url.searchParams.get('lng') ? parseFloat(url.searchParams.get('lng')!) : undefined,
  });
  return cors(Response.json(result));
}

function cors(response: Response): Response {
  const h = new Headers(response.headers);
  h.set('Access-Control-Allow-Origin', '*');
  h.set('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  h.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-User-Id');
  return new Response(response.body, { status: response.status, headers: h });
}

function html(content: string): Response {
  return new Response(content, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
