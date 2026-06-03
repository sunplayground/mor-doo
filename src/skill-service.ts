import { Env, FeatureConfig, FeatureName } from './types';

const SKILLS_PREFIX = 'skills';

export function skillPath(feature: FeatureName, file: string): string {
  return `${SKILLS_PREFIX}/${feature}/${file}`;
}

export async function getSkillFile(env: Env, feature: FeatureName, filename: string): Promise<string> {
  const obj = await env.R2.get(skillPath(feature, filename));
  if (!obj) return '';
  return obj.text();
}

export async function setSkillFile(
  env: Env,
  feature: FeatureName,
  filename: string,
  content: string
): Promise<void> {
  await env.R2.put(skillPath(feature, filename), content, {
    httpMetadata: { contentType: 'text/markdown' },
  });
}

export async function deleteSkillFile(env: Env, feature: FeatureName, filename: string): Promise<void> {
  await env.R2.delete(skillPath(feature, filename));
}

export async function listSkillFiles(env: Env, feature: FeatureName): Promise<string[]> {
  const listed = await env.R2.list({
    prefix: `${SKILLS_PREFIX}/${feature}/`,
    limit: 50,
  });
  return listed.objects.map((o) => o.key.split('/').pop()!);
}

export async function getFeatureConfig(env: Env, feature: string): Promise<FeatureConfig | null> {
  return env.DB.prepare('SELECT * FROM feature_configs WHERE feature = ?')
    .bind(feature)
    .first() as Promise<FeatureConfig | null>;
}

export async function getAllFeatureConfigs(env: Env): Promise<FeatureConfig[]> {
  const results = await env.DB.prepare('SELECT * FROM feature_configs').all();
  return results.results as unknown as FeatureConfig[];
}

export async function upsertFeatureConfig(
  env: Env,
  feature: string,
  updates: Partial<FeatureConfig>
): Promise<void> {
  const existing = await getFeatureConfig(env, feature);
  if (existing) {
    const sets: string[] = [];
    const values: any[] = [];
    if (updates.ai_model !== undefined) { sets.push('ai_model = ?'); values.push(updates.ai_model); }
    if (updates.skill_md_path !== undefined) { sets.push('skill_md_path = ?'); values.push(updates.skill_md_path); }
    if (updates.reference_md_path !== undefined) { sets.push('reference_md_path = ?'); values.push(updates.reference_md_path); }
    if (updates.extra_skill_paths !== undefined) { sets.push('extra_skill_paths = ?'); values.push(updates.extra_skill_paths); }
    if (updates.enabled !== undefined) { sets.push('enabled = ?'); values.push(updates.enabled); }
    if (updates.max_tokens !== undefined) { sets.push('max_tokens = ?'); values.push(updates.max_tokens); }
    if (updates.natal_source_systems !== undefined) { sets.push('natal_source_systems = ?'); values.push(updates.natal_source_systems); }
    sets.push("updated_at = datetime('now')");
    values.push(feature);
    await env.DB.prepare(`UPDATE feature_configs SET ${sets.join(', ')} WHERE feature = ?`)
      .bind(...values)
      .run();
  } else {
    await env.DB.prepare(
      `INSERT INTO feature_configs (feature, ai_model, skill_md_path, reference_md_path, extra_skill_paths, enabled, natal_source_systems)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        feature,
        updates.ai_model || 'gpt-4o-mini',
        updates.skill_md_path || null,
        updates.reference_md_path || null,
        updates.extra_skill_paths || null,
        updates.enabled !== undefined ? updates.enabled : 1,
        updates.natal_source_systems || null
      )
      .run();
  }
}

const ALL_NATAL_SYSTEMS = JSON.stringify([
  'western_tropical', 'thai_sidereal', 'current_transits',
  'bazi', 'taksa', 'vimshottari_dasha', 'bad_year',
  'western_houses', 'compatibility_inputs',
]);

const ALL_FEATURES: FeatureName[] = [
  'daily-reading', 'weekly-reading', 'chat', 'birth-chart',
  'tarot', 'dream', 'phone-number', 'name-analysis',
  'bad-year', 'friend-chart', 'auspicious-time',
  'tak', 'today', 'profile', 'compatibility', 'morning-push',
  'week-energy', 'today-actions', 'day-timeline', 'ai-insight',
];

export async function initializeFeatureConfigs(env: Env): Promise<void> {
  for (const feature of ALL_FEATURES) {
    const existing = await getFeatureConfig(env, feature);
    if (!existing) {
      await upsertFeatureConfig(env, feature, {
        ai_model: 'gpt-4o-mini',
        skill_md_path: `skills/${feature}/skill.md`,
        reference_md_path: `skills/${feature}/reference.md`,
        enabled: 1,
        natal_source_systems: ALL_NATAL_SYSTEMS,
      });
    } else if (!existing.natal_source_systems) {
      // Backfill natal for existing features that were created without it
      await upsertFeatureConfig(env, feature, { natal_source_systems: ALL_NATAL_SYSTEMS });
    }
  }
}
