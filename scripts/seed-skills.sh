#!/bin/bash
set -e

echo "🌱 Seeding skill files to R2..."

FEATURES=(
  "daily-reading"
  "weekly-reading"
  "chat"
  "birth-chart"
  "tarot"
  "dream"
  "phone-number"
  "name-analysis"
  "bad-year"
  "friend-chart"
  "auspicious-time"
)

for feature in "${FEATURES[@]}"; do
  echo "  📤 Uploading skills/$feature/skill.md..."
  wrangler r2 object put "mor-doo-data/skills/$feature/skill.md" \
    --file "./skills/$feature/skill.md" --content-type "text/markdown" || echo "  ⚠️ Failed to upload $feature/skill.md (may need R2 bucket creation first)"

  echo "  📤 Uploading skills/$feature/reference.md..."
  wrangler r2 object put "mor-doo-data/skills/$feature/reference.md" \
    --file "./skills/$feature/reference.md" --content-type "text/markdown" || echo "  ⚠️ Failed to upload $feature/reference.md"
done

echo "✅ Done! All skill files seeded."
