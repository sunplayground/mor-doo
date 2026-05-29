import { Env } from './types';
import { chatCompletion } from './ai-client';
import { getAllUserMessages, getAllUserEvents } from './log-service';

const MEMORY_PREFIX = 'memories';
const UPDATE_QUEUE_PREFIX = 'memory-updates';

export function memoryPath(lineUserId: string): string {
  return `${MEMORY_PREFIX}/${lineUserId}/memory.md`;
}

export function memoryUpdateQueuePath(lineUserId: string): string {
  return `${UPDATE_QUEUE_PREFIX}/${lineUserId}/${Date.now()}.md`;
}

export async function getMemory(env: Env, lineUserId: string): Promise<string> {
  const obj = await env.R2.get(memoryPath(lineUserId));
  if (!obj) return '';
  return obj.text();
}

export async function setMemory(env: Env, lineUserId: string, content: string): Promise<void> {
  await env.R2.put(memoryPath(lineUserId), content, {
    httpMetadata: { contentType: 'text/markdown' },
  });
}

export async function queueMemoryUpdate(env: Env, lineUserId: string, updateData: string): Promise<void> {
  await env.R2.put(memoryUpdateQueuePath(lineUserId), updateData, {
    httpMetadata: { contentType: 'application/json' },
  });
}

export async function getPendingMemoryUpdates(env: Env, lineUserId: string): Promise<string[]> {
  const listed = await env.R2.list({
    prefix: `${UPDATE_QUEUE_PREFIX}/${lineUserId}/`,
    limit: 50,
  });
  const updates: string[] = [];
  for (const obj of listed.objects) {
    const body = await env.R2.get(obj.key);
    if (body) updates.push(await body.text());
  }
  return updates;
}

export async function clearPendingMemoryUpdates(env: Env, lineUserId: string): Promise<void> {
  const listed = await env.R2.list({
    prefix: `${UPDATE_QUEUE_PREFIX}/${lineUserId}/`,
    limit: 100,
  });
  for (const obj of listed.objects) {
    await env.R2.delete(obj.key);
  }
}

export async function updateMemoryFromConversation(
  env: Env,
  lineUserId: string,
  userMessage: string,
  aiResponse: string,
  feature: string
): Promise<void> {
  const existing = await getMemory(env, lineUserId);
  const now = new Date().toISOString();

  const update = `\n## [${now}] ${feature}\n- User: ${userMessage.substring(0, 200)}\n- Response summary: ${aiResponse.substring(0, 200)}\n`;

  if (!existing) {
    await setMemory(env, lineUserId, `# User Memory\n${update}`);
  } else {
    await queueMemoryUpdate(env, lineUserId, JSON.stringify({ update, timestamp: now }));
  }
}

export async function processMemoryBatch(env: Env, lineUserId: string): Promise<void> {
  const pending = await getPendingMemoryUpdates(env, lineUserId);
  if (pending.length === 0) return;

  let existing = await getMemory(env, lineUserId);
  for (const updateJson of pending) {
    try {
      const { update } = JSON.parse(updateJson);
      existing += update;
    } catch {}
  }

  if (existing.length > 10000) {
    existing = existing.substring(existing.length - 8000);
  }

  await setMemory(env, lineUserId, existing);
  await clearPendingMemoryUpdates(env, lineUserId);
}

export async function regenerateMemoryFromLogs(env: Env, lineUserId: string): Promise<string> {
  const messages = await getAllUserMessages(env, lineUserId);
  const events = await getAllUserEvents(env, lineUserId);

  const logLines: string[] = [];
  for (const m of messages) {
    const dir = m.direction === 'inbound' ? 'User' : 'AI';
    const feature = m.feature ? ` [${m.feature}]` : '';
    const content = (m.content || '').substring(0, 300);
    logLines.push(`[${m.created_at}]${feature} ${dir}: ${content}`);
  }
  for (const e of events) {
    const payload = e.payload ? ` — ${e.payload}` : '';
    logLines.push(`[${e.created_at}] Event(${e.event_type})${payload}`);
  }

  let logsText = logLines.join('\n');
  if (logsText.length > 30000) {
    logsText = logsText.substring(logsText.length - 30000);
  }

  const systemPrompt = `You are a memory compiler for a Thai fortune-telling AI assistant named "พี่ดาว". 
Given all conversation logs and events for a user, produce a concise memory file in Markdown format.

The memory file should:
- Be in Thai language
- Start with "# User Memory" heading
- Include a "## Profile" section with any personal details mentioned (name, birth date, birth time, phone, etc.)
- Include a "## Interests & Topics" section about what the user typically asks about
- Include a "## Conversation Summary" section with key patterns, preferences, and recurring themes
- Include a "## Fortune Telling History" section noting which features they've used and any reactions
- Keep the total content under 8000 characters
- Focus on facts and patterns, not exact conversation transcripts
- Be structured and scannable, using bullet points`;

  const userPrompt = `Here are all the logs for user ${lineUserId}:

${logsText}

Based on these logs, generate a comprehensive memory.md file for this user. Focus on extracting personal details, preferences, recurring topics, and important patterns. Write in Thai.`;

  const newMemory = await chatCompletion(env, [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ], env.AI_MODEL);

  await setMemory(env, lineUserId, newMemory);
  await clearPendingMemoryUpdates(env, lineUserId);

  return newMemory;
}
