import { Env, User } from './types';

export async function getUserByLineId(env: Env, lineUserId: string): Promise<User | null> {
  const result = await env.DB.prepare('SELECT * FROM users WHERE line_user_id = ?')
    .bind(lineUserId)
    .first();
  return result as User | null;
}

export async function createUser(env: Env, lineUserId: string, displayName?: string, pictureUrl?: string): Promise<User> {
  await env.DB.prepare(
    'INSERT INTO users (line_user_id, display_name, picture_url) VALUES (?, ?, ?)'
  )
    .bind(lineUserId, displayName || null, pictureUrl || null)
    .run();

  const user = await getUserByLineId(env, lineUserId);
  return user!;
}

export async function updateUserOnboarding(
  env: Env,
  lineUserId: string,
  data: { name: string; phone: string; birthDate: string; birthTime: string; birthLocation?: string }
) {
  await env.DB.prepare(
    `UPDATE users SET name = ?, phone = ?, birth_date = ?, birth_time = ?, birth_location = ?, 
     onboarding_complete = 1, updated_at = datetime('now') WHERE line_user_id = ?`
  )
    .bind(data.name, data.phone, data.birthDate, data.birthTime, data.birthLocation || null, lineUserId)
    .run();
}

export async function updateUserTier(env: Env, lineUserId: string, tier: string, expiresAt?: string) {
  await env.DB.prepare(
    `UPDATE users SET tier = ?, subscription_expires_at = ?, updated_at = datetime('now') WHERE line_user_id = ?`
  )
    .bind(tier, expiresAt || null, lineUserId)
    .run();
}

export async function getActiveUsers(env: Env): Promise<User[]> {
  const results = await env.DB.prepare(
    `SELECT u.* FROM users u 
     WHERE u.onboarding_complete = 1 
     AND u.id IN (SELECT DISTINCT id FROM users)
     ORDER BY u.created_at DESC`
  ).all();
  return results.results as unknown as User[];
}

export async function getAllUsers(env: Env): Promise<User[]> {
  const results = await env.DB.prepare('SELECT * FROM users ORDER BY created_at DESC').all();
  return results.results as unknown as User[];
}
