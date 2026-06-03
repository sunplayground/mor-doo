import { Env, FeatureTask, User } from './types';
import { getResult, updateResult, setCachedFeature } from './result-service';
import { getUserByLineId } from './user-service';
import {
  handleChat, handleDailyReading, handleWeeklyReading, handleBirthChart,
  handleTarot, handleDream, handlePhoneNumber, handleNameAnalysis,
  handleBadYear, handleAuspiciousTime,
} from './feature-handler';
import { generateToday, generateTak, generateCompatibility, generateRightNow } from './today-service';

export async function handleQueueBatch(batch: MessageBatch<FeatureTask>, env: Env): Promise<void> {
  for (const msg of batch.messages) {
    const task = msg.body;
    try {
      const user = await getUserByLineId(env, task.lineUserId);
      if (!user) {
        await updateResult(env, task.resultId, 'failed', undefined, 'User not found');
        msg.ack();
        continue;
      }

      let result: string;

      switch (task.feature) {
        case 'daily-reading':
          result = await handleDailyReading(env, user, task.todayChips);
          break;
        case 'weekly-reading':
          result = await handleWeeklyReading(env, user, task.compassContext);
          break;
        case 'birth-chart':
          result = await handleBirthChart(env, user);
          break;
        case 'tarot':
          result = await handleTarot(env, user, task.message);
          break;
        case 'dream':
          result = await handleDream(env, user, task.message || '');
          break;
        case 'phone-number':
          result = await handlePhoneNumber(env, user, task.message || '');
          break;
        case 'name-analysis':
          result = await handleNameAnalysis(env, user, task.message || '');
          break;
        case 'bad-year':
          result = await handleBadYear(env, user);
          break;
        case 'friend-chart':
          result = await handleFriendChart(env, user, task.otherBirthDate);
          break;
        case 'auspicious-time':
          result = await handleAuspiciousTime(env, user);
          break;
        case 'compatibility':
          result = await generateCompatibility(env, user, task.otherBirthDate || '');
          break;
        case 'timing-right-now':
          result = await generateRightNow(env, user, task.action || 'call');
          break;
        case 'today':
          const todayData = await generateToday(env, user);
          result = JSON.stringify(todayData);
          break;
        case 'tak':
          result = await generateTak(env, user);
          break;
        default:
          result = await handleChat(env, user, task.message || '');
      }

      await updateResult(env, task.resultId, 'completed', result);

      const cacheableFeatures = ['daily-reading','weekly-reading','birth-chart','bad-year','auspicious-time','friend-chart','compatibility','tak'];
      const cacheKey = task.feature === 'timing-right-now' ? 'timing-right-now-' + (task.action || 'call') : task.feature;
      if ((cacheableFeatures.includes(task.feature) || task.feature === 'timing-right-now') && result) {
        try {
          await setCachedFeature(env, task.lineUserId, cacheKey, result);
        } catch (cacheErr) {
          console.error('Cache save failed:', cacheErr);
        }
      }
    } catch (err: any) {
      console.error(`Queue task failed for ${task.feature}:`, err);
      await updateResult(env, task.resultId, 'failed', undefined, err.message || 'Unknown error');
    }

    msg.ack();
  }
}

async function handleFriendChart(env: Env, user: User, otherBirthDate?: string): Promise<string> {
  const { chatCompletion, buildSystemPrompt } = await import('./ai-client');
  const { getFeatureConfig, getSkillFile } = await import('./skill-service');
  const { getMemory } = await import('./memory-service');
  const { getNatalChartSection } = await import('./natal-calculator');

  const config = await getFeatureConfig(env, 'friend-chart');
  const skillMd = await getSkillFile(env, 'friend-chart', 'skill.md');
  const referenceMd = await getSkillFile(env, 'friend-chart', 'reference.md');
  const memoryMd = await getMemory(env, user.line_user_id);
  const model = config?.ai_model || env.AI_MODEL;

  let systemPrompt = buildSystemPrompt(skillMd, referenceMd, memoryMd, [], 'friend-chart');
  if (config?.natal_source_systems) {
    try {
      const systems: string[] = JSON.parse(config.natal_source_systems);
      const natalSection = getNatalChartSection(user, systems);
      if (natalSection) systemPrompt += '\n\n' + natalSection;
    } catch {}
  }
  const prompt = `เปรียบเทียบดวงชะตาของฉัน (เกิด ${user.birth_date} เวลา ${user.birth_time || 'ไม่ระบุ'}) กับคนที่เกิดวันที่ ${otherBirthDate || 'ไม่ระบุ'}`;

  return chatCompletion(env, [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: prompt },
  ], model, config?.max_tokens || undefined);
}