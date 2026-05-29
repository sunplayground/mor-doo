import { Env } from './types';

export async function createPendingResult(env: Env, lineUserId: string, feature: string, params?: string): Promise<string> {
  const id = `${lineUserId}-${feature}`;
  const existing = await env.DB.prepare(
    'SELECT id, status FROM pending_results WHERE id = ?'
  ).bind(id).first();
  if (existing) {
    if ((existing as any).status === 'pending') {
      return id;
    }
    await env.DB.prepare(
      'DELETE FROM pending_results WHERE id = ?'
    ).bind(id).run();
  }
  await env.DB.prepare(
    'INSERT INTO pending_results (id, line_user_id, feature, params, status) VALUES (?, ?, ?, ?, ?)'
  ).bind(id, lineUserId, feature, params || null, 'pending').run();
  return id;
}

export async function getResult(env: Env, resultId: string): Promise<{
  id: string;
  lineUserId: string;
  feature: string;
  status: string;
  result: string | null;
  error: string | null;
  createdAt: string;
} | null> {
  const row = await env.DB.prepare(
    'SELECT id, line_user_id, feature, status, result, error, created_at FROM pending_results WHERE id = ?'
  ).bind(resultId).first();
  if (!row) return null;
  return {
    id: (row as any).id,
    lineUserId: (row as any).line_user_id,
    feature: (row as any).feature,
    status: (row as any).status,
    result: (row as any).result,
    error: (row as any).error,
    createdAt: (row as any).created_at,
  };
}

export async function updateResult(env: Env, resultId: string, status: string, result?: string, error?: string): Promise<void> {
  await env.DB.prepare(
    'UPDATE pending_results SET status = ?, result = ?, error = ?, updated_at = datetime(\'now\') WHERE id = ?'
  ).bind(status, result || null, error || null, resultId).run();
}

export async function getRecentResults(env: Env, lineUserId: string, limit: number = 20): Promise<any[]> {
  const results = await env.DB.prepare(
    'SELECT id, feature, status, created_at FROM pending_results WHERE line_user_id = ? ORDER BY created_at DESC LIMIT ?'
  ).bind(lineUserId, limit).all();
  return results.results;
}

export async function getCachedFeature(env: Env, lineUserId: string, feature: string): Promise<string | null> {
  const today = new Date().toISOString().split('T')[0];
  const row = await env.DB.prepare(
    "SELECT content FROM daily_cache WHERE line_user_id = ? AND cache_type = ? AND DATE(created_at) = ?"
  ).bind(lineUserId, feature, today).first();
  if (!row) return null;
  return (row as any).content;
}

export async function setCachedFeature(env: Env, lineUserId: string, feature: string, content: string): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  await env.DB.prepare(
    "INSERT OR REPLACE INTO daily_cache (line_user_id, cache_type, content, created_at) VALUES (?, ?, ?, datetime('now'))"
  ).bind(lineUserId, feature, content).run();
}