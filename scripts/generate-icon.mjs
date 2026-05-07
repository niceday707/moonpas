import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');

async function generateIcons() {
  const logoBuffer = await sharp(path.join(publicDir, 'logo.jpg'))
    .resize(300, 300, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .toBuffer();

  // 192x192 아이콘: 흰 배경 위에 로고를 70% 크기로 중앙 배치
  await sharp({
    create: { width: 192, height: 192, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } }
  })
    .composite([{
      input: await sharp(logoBuffer).resize(130, 130, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } }).toBuffer(),
      gravity: 'centre'
    }])
    .png()
    .toFile(path.join(publicDir, 'icon-192.png'));

  // 512x512 아이콘
  await sharp({
    create: { width: 512, height: 512, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } }
  })
    .composite([{
      input: await sharp(logoBuffer).resize(350, 350, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } }).toBuffer(),
      gravity: 'centre'
    }])
    .png()
    .toFile(path.join(publicDir, 'icon-512.png'));

  console.log('아이콘 생성 완료!');
}

generateIcons();
