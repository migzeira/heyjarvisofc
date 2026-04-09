/**
 * Gera os ícones PWA em múltiplos tamanhos a partir de public/favicon.png
 * Requer: npm install sharp (dev dependency)
 * Uso: node scripts/generate-pwa-icons.js
 */
import sharp from 'sharp';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const src = join(root, 'public', 'favicon.png');
const outDir = join(root, 'public', 'icons');

mkdirSync(outDir, { recursive: true });

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

for (const size of sizes) {
  await sharp(src)
    .resize(size, size, { fit: 'contain', background: { r: 3, g: 3, b: 10, alpha: 1 } })
    .png()
    .toFile(join(outDir, `icon-${size}.png`));
  console.log(`✅ icon-${size}.png`);
}

console.log('\nÍcones gerados em public/icons/');
