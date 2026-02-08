#!/usr/bin/env node
/**
 * Download Elena Z-Image LoRA training dataset
 * Downloads 56 images from Cloudinary and saves to lora-dataset-elena-zimage/
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATASET_DIR = path.join(__dirname, '../../lora-dataset-elena-zimage');

const IMAGE_URLS = [
  'https://res.cloudinary.com/dily60mr0/image/upload/v1768847547/elena-scheduled/carousel-2-1768847547.jpg',
  'https://res.cloudinary.com/dily60mr0/image/upload/v1768847319/elena-scheduled/carousel-1-1768847318.jpg',
  'https://res.cloudinary.com/dily60mr0/image/upload/v1768844736/elena-scheduled/carousel-1-1768844735.jpg',
  'https://res.cloudinary.com/dily60mr0/image/upload/v1768763692/elena-scheduled/carousel-3-1768763692.jpg',
  'https://res.cloudinary.com/dily60mr0/image/upload/v1768763641/elena-scheduled/carousel-2-1768763641.jpg',
  'https://res.cloudinary.com/dily60mr0/image/upload/v1768763588/elena-scheduled/carousel-1-1768763588.jpg',
  'https://res.cloudinary.com/dily60mr0/image/upload/v1768739598/elena-scheduled/carousel-3-1768739597.jpg',
  'https://res.cloudinary.com/dily60mr0/image/upload/v1768677268/elena-scheduled/carousel-2-1768677268.jpg',
  'https://res.cloudinary.com/dily60mr0/image/upload/v1768677197/elena-scheduled/carousel-1-1768677196.jpg',
  'https://res.cloudinary.com/dily60mr0/image/upload/v1768656524/elena-scheduled/carousel-2-1768656524.jpg',
  'https://res.cloudinary.com/dily60mr0/image/upload/v1768656426/elena-scheduled/carousel-1-1768656426.jpg',
  'https://res.cloudinary.com/dily60mr0/image/upload/v1768653117/elena-scheduled/carousel-1-1768653117.jpg',
  'https://res.cloudinary.com/dily60mr0/image/upload/v1768591221/elena-scheduled/carousel-3-1768591221.jpg',
  'https://res.cloudinary.com/dily60mr0/image/upload/v1768591177/elena-scheduled/carousel-2-1768591177.jpg',
  'https://res.cloudinary.com/dily60mr0/image/upload/v1768591118/elena-scheduled/carousel-1-1768591118.jpg',
  'https://res.cloudinary.com/dily60mr0/image/upload/v1768518016/elena-fanvue-daily/morning_selfie_above-1768518015.jpg',
  'https://res.cloudinary.com/dily60mr0/image/upload/v1768517864/elena-fanvue-daily/yoga_from_above-1768517863.jpg',
  'https://res.cloudinary.com/dily60mr0/image/upload/v1768511997/elena-scheduled/carousel-2-1768511997.jpg',
  'https://res.cloudinary.com/dily60mr0/image/upload/v1768511907/elena-scheduled/carousel-1-1768511906.jpg',
  'https://res.cloudinary.com/dily60mr0/image/upload/v1768506296/elena-scheduled/carousel-1-1768506295.jpg',
  'https://res.cloudinary.com/dily60mr0/image/upload/v1768484265/elena-scheduled/carousel-1-1768484265.jpg',
  'https://res.cloudinary.com/dily60mr0/image/upload/v1768418450/elena-scheduled/carousel-2-1768418450.jpg',
  'https://res.cloudinary.com/dily60mr0/image/upload/v1768418393/elena-scheduled/carousel-1-1768418392.jpg',
  'https://res.cloudinary.com/dily60mr0/image/upload/v1768394526/elena-scheduled/carousel-2-1768394525.jpg',
  'https://res.cloudinary.com/dily60mr0/image/upload/v1768332035/elena-scheduled/carousel-3-1768332034.jpg',
  'https://res.cloudinary.com/dily60mr0/image/upload/v1768331913/elena-scheduled/carousel-1-1768331913.jpg',
  'https://res.cloudinary.com/dily60mr0/image/upload/v1768307935/elena-scheduled/carousel-2-1768307935.jpg',
  'https://res.cloudinary.com/dily60mr0/image/upload/v1768245687/elena-scheduled/carousel-3-1768245686.jpg',
  'https://res.cloudinary.com/dily60mr0/image/upload/v1768245583/elena-scheduled/carousel-1-1768245582.jpg',
  'https://res.cloudinary.com/dily60mr0/image/upload/v1768234884/elena-fanvue-daily/morning_bed_stretch-1768234884.jpg',
  'https://res.cloudinary.com/dily60mr0/image/upload/v1768158808/elena-scheduled/carousel-1-1768158807.jpg',
  'https://res.cloudinary.com/dily60mr0/image/upload/v1767954077/elena-trending-test/bozekkek0rc8nrrotr6w.jpg',
  'https://res.cloudinary.com/dily60mr0/image/upload/v1767951368/elena-trending-test/ljnvpscynjz5qutszpn8.jpg',
  'https://res.cloudinary.com/dily60mr0/image/upload/v1767554094/elena-scheduled/carousel-3-1767554094.jpg',
  'https://res.cloudinary.com/dily60mr0/image/upload/v1767554047/elena-scheduled/carousel-2-1767554046.jpg',
  'https://res.cloudinary.com/dily60mr0/image/upload/v1766651337/elena-scheduled/reel-2-1766651337.jpg',
  'https://res.cloudinary.com/dily60mr0/image/upload/v1766653839/elena-scheduled/reel-1-1766653839.jpg',
  'https://res.cloudinary.com/dily60mr0/image/upload/v1766654049/elena-scheduled/reel-3-1766654049.jpg',
  'https://res.cloudinary.com/dily60mr0/image/upload/v1766572399/elena-fanvue-pack1/elena-pack1-photo_3-1766572398786.jpg',
  'https://res.cloudinary.com/dily60mr0/image/upload/v1766572346/elena-fanvue-pack1/elena-pack1-photo_2-1766572345325.jpg',
  'https://res.cloudinary.com/dily60mr0/image/upload/v1766561004/elena-scheduled/reel-2-1766561004.jpg',
  'https://res.cloudinary.com/dily60mr0/image/upload/v1766561049/elena-scheduled/reel-3-1766561048.jpg',
  'https://res.cloudinary.com/dily60mr0/image/upload/v1766501180/elena-scheduled/reel-2-1766501180.jpg',
  'https://res.cloudinary.com/dily60mr0/image/upload/v1766499727/elena-scheduled/reel-3-1766499726.jpg',
  'https://res.cloudinary.com/dily60mr0/image/upload/v1766499665/elena-scheduled/reel-2-1766499655.jpg',
  'https://res.cloudinary.com/dily60mr0/image/upload/v1766499613/elena-scheduled/reel-1-1766499613.jpg',
  'https://res.cloudinary.com/dily60mr0/image/upload/v1766478271/elena-scheduled/carousel-1-1766478271.jpg',
  'https://res.cloudinary.com/dily60mr0/image/upload/v1766445336/elena-scheduled/reel-1-1766445335.jpg',
  'https://res.cloudinary.com/dily60mr0/image/upload/v1766443939/elena-scheduled/reel-3-1766443938.jpg',
  'https://res.cloudinary.com/dily60mr0/image/upload/v1766403548/elena-vacation-reels/elena-yacht-1-1766403547908.jpg',
  'https://res.cloudinary.com/dily60mr0/image/upload/v1766307117/elena-carousel/zbnnquow5kfkpkkrerx5.jpg',
  'https://res.cloudinary.com/dily60mr0/image/upload/v1766263301/elena-carousel/epoavhydrokfrvsw9pxp.jpg',
  'https://res.cloudinary.com/dily60mr0/image/upload/v1766263353/elena-carousel/vcuijiegd85mr7fydqwy.jpg',
  'https://res.cloudinary.com/dily60mr0/image/upload/v1766230840/elena-carousel/bkp8fmzwzrbocg64da7e.jpg',
  'https://res.cloudinary.com/dily60mr0/image/upload/v1766144591/elena-carousel/bhkia2z0mmqxp0xxdpvr.jpg',
  'https://res.cloudinary.com/dily60mr0/image/upload/v1766144546/elena-carousel/rygy3bbill3ob4vbnfbl.jpg',
];

function downloadImage(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    https.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        // Follow redirect
        https.get(response.headers.location, (redirectResponse) => {
          redirectResponse.pipe(file);
          file.on('finish', () => {
            file.close();
            resolve();
          });
        }).on('error', reject);
      } else {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      }
    }).on('error', (err) => {
      fs.unlink(destPath, () => {}); // Delete failed file
      reject(err);
    });
  });
}

async function main() {
  console.log(`Downloading ${IMAGE_URLS.length} images to ${DATASET_DIR}`);

  // Ensure directory exists
  if (!fs.existsSync(DATASET_DIR)) {
    fs.mkdirSync(DATASET_DIR, { recursive: true });
  }

  let downloaded = 0;
  let failed = 0;

  for (let i = 0; i < IMAGE_URLS.length; i++) {
    const url = IMAGE_URLS[i];
    const filename = `elena_${String(i + 1).padStart(3, '0')}.jpg`;
    const destPath = path.join(DATASET_DIR, filename);

    try {
      process.stdout.write(`[${i + 1}/${IMAGE_URLS.length}] Downloading ${filename}... `);
      await downloadImage(url, destPath);
      console.log('OK');
      downloaded++;
    } catch (err) {
      console.log(`FAILED: ${err.message}`);
      failed++;
    }
  }

  console.log(`\nDone! Downloaded: ${downloaded}, Failed: ${failed}`);
  console.log(`Dataset location: ${DATASET_DIR}`);
}

main().catch(console.error);
