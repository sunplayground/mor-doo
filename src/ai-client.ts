import { AIMessage, Env } from './types';

export async function chatCompletion(
  env: Env,
  messages: AIMessage[],
  model?: string,
  maxTokens?: number
): Promise<string> {
  const usedModel = model || env.AI_MODEL;
  const baseUrl = (env.AI_API_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.AI_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://mor-doo.sunx-prod.workers.dev',
      'X-Title': 'Mor Doo',
    },
    body: JSON.stringify({
      model: usedModel,
      messages,
      temperature: 0.8,
      max_tokens: maxTokens || 8000,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('AI API error:', err);
    throw new Error(`AI API error: ${res.status}`);
  }

  const data = (await res.json()) as any;
  return data.choices?.[0]?.message?.content || '';
}

export function buildSystemPrompt(
  skillMd: string,
  referenceMd: string,
  memoryMd: string,
  extraSkills: string[],
  featureName: string
): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long', timeZone: 'Asia/Bangkok' });
  const timeStr = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' });

  let prompt = `# บทบาท: พี่ดาว — หมอดู AI\n\n${skillMd}\n\n`;

  if (referenceMd) {
    prompt += `# ข้อมูลอ้างอิง\n\n${referenceMd}\n\n`;
  }

  for (const extra of extraSkills) {
    if (extra) prompt += `# ข้อมูลเพิ่มเติม\n\n${extra}\n\n`;
  }

  if (memoryMd) {
    prompt += `# ข้อมูลผู้ใช้ (memory)\n\n${memoryMd}\n\n`;
  }

  prompt += `# ข้อกำหนดการตอบ\n`;
  prompt += `- ตอบเป็นภาษาไทยเท่านั้น\n`;
  prompt += `- ใช้น้ำเสียง "พี่ดาว" ที่อบอุ่น เป็นกันเอง เหมือนพี่สาวคนโต\n`;
  prompt += `- ตอบสั้น กระชับ เข้าใจง่าย (ไม่เกิน 4 ย่อหน้า)\n`;
  prompt += `- ใช้ข้อมูลดวงชะตาของผู้ใช้ในการทำนาย\n`;
  prompt += `- ห้ามขอข้อมูลเพิ่มเติม ถ้ามีข้อมูลไม่พอให้ทำนายจากสิ่งที่มี\n`;
  prompt += `- ฟีเจอร์ปัจจุบัน: ${featureName}\n`;
  prompt += `- ห้ามแสดงกระบวนการคิด (thinking) ออกมาในคำตอบ\n`;
  prompt += `\n# วันเวลาปัจจุบัน\nวัน${dateStr} เวลา ${timeStr} น. (เขตเวลากรุงเทพฯ)\n`;

  return prompt;
}
