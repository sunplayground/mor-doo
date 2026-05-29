import { Env } from './types';

export async function replyMessage(env: Env, replyToken: string, messages: any[]) {
  await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ replyToken, messages }),
  });
}

export async function pushMessage(env: Env, to: string, messages: any[]) {
  await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ to, messages }),
  });
}

export async function getProfile(env: Env, userId: string) {
  const res = await fetch(`https://api.line.me/v2/bot/profile/${userId}`, {
    headers: { Authorization: `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}` },
  });
  return res.json() as Promise<{ displayName: string; pictureUrl?: string; userId: string }>;
}

export async function verifyIdToken(env: Env, idToken: string) {
  const res = await fetch('https://api.line.me/oauth2/v2.1/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      id_token: idToken,
      client_id: env.LINE_CHANNEL_ID,
    }),
  });
  return res.json() as Promise<{
    sub?: string;
    name?: string;
    picture?: string;
    email?: string;
    error?: string;
  }>;
}

export function textMessage(text: string) {
  return { type: 'text', text };
}

export function templateButtonMessage(text: string, actions: { label: string; uri?: string; data?: string }[]) {
  return {
    type: 'template',
    altText: text,
    template: {
      type: 'buttons',
      text,
      actions: actions.map(a => {
        if (a.uri) {
          return { type: 'uri', label: a.label, uri: a.uri };
        }
        return { type: 'postback', label: a.label, data: a.data || a.label };
      }),
    },
  };
}

export function quickReplyItems(items: { label: string; data: string }[]) {
  return {
    type: 'text',
    text: '',
    quickReply: {
      items: items.map((item) => ({
        type: 'action',
        action: { type: 'postback', label: item.label, data: item.data, text: item.label },
      })),
    },
  };
}

export function flexMessage(altText: string, contents: any) {
  return { type: 'flex', altText, contents };
}

export function buttonMessage(
  text: string,
  buttons: { label: string; data: string; type?: 'postback' | 'message' }[]
) {
  return {
    type: 'text',
    text,
    quickReply: {
      items: buttons.map((b) => ({
        type: 'action',
        action:
          b.type === 'message'
            ? { type: 'message', label: b.label, text: b.data }
            : { type: 'postback', label: b.label, data: b.data, text: b.label },
      })),
    },
  };
}
