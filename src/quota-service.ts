import { Env } from './types';

const FREE_MESSAGES_PER_DAY = 999;

export async function getQuota(env: Env, lineUserId: string): Promise<{ used: number; limit: number }> {
  const today = new Date().toISOString().split('T')[0];
  const row = await env.DB.prepare(
    'SELECT messages_used FROM message_quotas WHERE line_user_id = ? AND quota_date = ?'
  ).bind(lineUserId, today).first();

  return {
    used: (row as any)?.messages_used || 0,
    limit: FREE_MESSAGES_PER_DAY,
  };
}

export async function incrementQuota(env: Env, lineUserId: string): Promise<boolean> {
  const today = new Date().toISOString().split('T')[0];
  const quota = await getQuota(env, lineUserId);

  await env.DB.prepare(
    'INSERT OR REPLACE INTO message_quotas (line_user_id, quota_date, messages_used) VALUES (?, ?, ?)'
  ).bind(lineUserId, today, quota.used + 1).run();

  return true;
}

export async function resetDailyQuotas(env: Env): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  await env.DB.prepare(
    "DELETE FROM message_quotas WHERE quota_date < ?"
  ).bind(today).run();
}