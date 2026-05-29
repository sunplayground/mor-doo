export interface Env {
  DB: D1Database;
  R2: R2Bucket;
  FEATURE_QUEUE: Queue;
  LINE_CHANNEL_ID: string;
  LINE_CHANNEL_SECRET: string;
  LINE_CHANNEL_ACCESS_TOKEN: string;
  AI_API_KEY: string;
  AI_API_BASE_URL: string;
  AI_MODEL: string;
  ADMIN_PASSWORD: string;
  LIFF_ID: string;
}

export interface FeatureTask {
  resultId: string;
  lineUserId: string;
  feature: string;
  message?: string;
  otherBirthDate?: string;
  action?: string;
}

export interface User {
  id: number;
  line_user_id: string;
  display_name: string | null;
  picture_url: string | null;
  name: string | null;
  phone: string | null;
  birth_date: string | null;
  birth_time: string | null;
  birth_location: string | null;
  onboarding_complete: number;
  tier: string;
  subscription_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id?: number;
  line_user_id: string;
  direction: 'inbound' | 'outbound';
  message_type: string;
  content: string | null;
  feature: string | null;
  reaction: string | null;
  created_at: string;
}

export interface FeatureConfig {
  feature: string;
  ai_model: string;
  skill_md_path: string | null;
  reference_md_path: string | null;
  extra_skill_paths: string | null;
  enabled: number;
  max_tokens: number | null;
  natal_source_systems: string | null;
  updated_at: string;
}

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface SkillContext {
  skillMd: string;
  referenceMd: string;
  extraSkills: string[];
  memoryMd: string;
  user: User;
  userMessage?: string;
}

export interface LINEWebhookEvent {
  type: string;
  replyToken?: string;
  source?: {
    userId?: string;
    type?: string;
  };
  message?: {
    type?: string;
    text?: string;
    id?: string;
  };
  postback?: {
    data?: string;
    params?: Record<string, string>;
  };
  follow?: boolean;
  unfollow?: boolean;
}

export interface LINEWebhookBody {
  destination: string;
  events: LINEWebhookEvent[];
}

export type FeatureName =
  | 'daily-reading'
  | 'weekly-reading'
  | 'chat'
  | 'birth-chart'
  | 'tarot'
  | 'dream'
  | 'phone-number'
  | 'name-analysis'
  | 'bad-year'
  | 'friend-chart'
  | 'auspicious-time'
  | 'tak'
  | 'today'
  | 'profile'
  | 'compatibility'
  | 'morning-push';

export interface TodayData {
  headline: string;
  chips: { color: string; number: string; goldenTime: string; moonVoc: string } | null;
  monthTheme: string;
  yearTheme: string;
  cycles: CycleItem[];
  insight: { must: string; watch: string; hidden: string } | null;
  raw: { daily: string; weekly: string; birthChart: string };
}

export interface CycleItem {
  name: string;
  dates: string;
  status: 'active' | 'upcoming' | 'winding';
}

export interface CompatibilityResult {
  score: number;
  headline: string;
  dimensions: { name: string; score: number }[];
  friction: string;
  raw: string;
}
