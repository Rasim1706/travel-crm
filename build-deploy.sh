#!/bin/bash
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "📦 Установка esbuild..."
cd "$ROOT"
npm install --save-dev esbuild --silent 2>/dev/null

echo "📦 Сборка фронтенда..."
cd "$ROOT/frontend"
npm install --silent
npm run build

echo "🗂  Создание папки deploy..."
cd "$ROOT"
rm -rf deploy
cp -r frontend/dist deploy
mkdir -p deploy/netlify/functions

echo "⚙️  Бандлинг функции (все зависимости включаются в один файл)..."
# Временно копируем credentials рядом с функцией для бандла
cp backend/credentials.json netlify/functions/credentials.json

"$ROOT/node_modules/.bin/esbuild" netlify/functions/api.js \
  --bundle \
  --minify \
  --platform=node \
  --target=node18 \
  --outfile=deploy/netlify/functions/api.js

# Убираем временный файл
rm netlify/functions/credentials.json

echo "📄 Создание netlify.toml..."
cat > deploy/netlify.toml << 'EOF'
[[redirects]]
  from   = "/api/*"
  to     = "/.netlify/functions/api/:splat"
  status = 200

[[redirects]]
  from   = "/*"
  to     = "/index.html"
  status = 200
EOF

echo ""
echo "✅ Готово! Папка deploy/ создана."
echo "   Размер функции: $(du -sh deploy/netlify/functions/api.js | cut -f1)"
echo "   Перетащите папку deploy/ на netlify.com/drop"
