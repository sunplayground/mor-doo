import { Env } from './types';

export async function logMessage(
  env: Env,
  lineUserId: string,
  direction: 'inbound' | 'outbound',
  content: string | null,
  feature: string | null = null,
  messageType: string = 'text'
) {
  await env.DB.prepare(
    'INSERT INTO messages (line_user_id, direction, message_type, content, feature) VALUES (?, ?, ?, ?, ?)'
  )
    .bind(lineUserId, direction, messageType, content, feature)
    .run();
}

export async function logEvent(env: Env, lineUserId: string, eventType: string, payload: any = null) {
  await env.DB.prepare('INSERT INTO events (line_user_id, event_type, payload) VALUES (?, ?, ?)')
    .bind(lineUserId, eventType, payload ? JSON.stringify(payload) : null)
    .run();
}

export async function getMessageHistory(env: Env, lineUserId: string, limit: number = 20): Promise<any[]> {
  const results = await env.DB.prepare(
    'SELECT * FROM messages WHERE line_user_id = ? ORDER BY created_at DESC LIMIT ?'
  )
    .bind(lineUserId, limit)
    .all();
  return results.results;
}

export async function getAllUserMessages(env: Env, lineUserId: string): Promise<any[]> {
  const results = await env.DB.prepare(
    'SELECT direction, message_type, content, feature, created_at FROM messages WHERE line_user_id = ? ORDER BY created_at ASC'
  )
    .bind(lineUserId)
    .all();
  return results.results;
}

export async function getAllUserEvents(env: Env, lineUserId: string): Promise<any[]> {
  const results = await env.DB.prepare(
    'SELECT event_type, payload, created_at FROM events WHERE line_user_id = ? ORDER BY created_at ASC'
  )
    .bind(lineUserId)
    .all();
  return results.results;
}

export async function getMessageStats(env: Env): Promise<any> {
  const totalUsers = await env.DB.prepare('SELECT COUNT(*) as count FROM users').first();
  const totalMessages = await env.DB.prepare('SELECT COUNT(*) as count FROM messages').first();
  const totalEvents = await env.DB.prepare('SELECT COUNT(*) as count FROM events').first();
  const activeToday = await env.DB.prepare(
    "SELECT COUNT(DISTINCT line_user_id) as count FROM messages WHERE created_at > datetime('now', '-1 day')"
  ).first();

  return {
    totalUsers: (totalUsers as any)?.count || 0,
    totalMessages: (totalMessages as any)?.count || 0,
    totalEvents: (totalEvents as any)?.count || 0,
    activeToday: (activeToday as any)?.count || 0,
  };
}
