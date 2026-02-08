/**
 * Test Seedream 4.5 with Elena reference images
 * Run: node scripts/elena-seedream-test.mjs
 */
import Replicate from 'replicate';
import fs from 'fs';
import https from 'https';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

if (!process.env.REPLICATE_API_TOKEN) {
  console.error('REPLICATE_API_TOKEN not found in .env.local');
  process.exit(1);
}

const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

// Elena reference images from base-portraits.ts
const ELENA_REFS = [
  'https://res.cloudinary.com/dily60mr0/image/upload/v1764767097/Photo_1_ewwkky.png',
  'https://res.cloudinary.com/dily60mr0/image/upload/v1764767099/Photo_2_q8kxit.png',
  'https://res.cloudinary.com/dily60mr0/image/upload/v1764767098/Photo_3_nopedx.png',
];

// NSFW test prompt (boudoir/lingerie style)
const prompt = `A photorealistic intimate boudoir photo of a beautiful 24-year-old French woman with natural wavy brown hair, warm brown eyes, natural skin texture. Lying on white silk sheets in a luxury bedroom, soft morning light through sheer curtains. Wearing black lace lingerie. Sensual pose, bedroom eyes, natural body. Shot on professional camera, soft lighting, intimate atmosphere, high resolution, natural skin texture, no plastic skin.`;

console.log('Testing Seedream 4.5 with NSFW prompt...');
console.log('Prompt:', prompt.slice(0, 100) + '...');
console.log('Reference images:', ELENA_REFS.length);

try {
  const output = await replicate.run("bytedance/seedream-4.5", {
    input: {
      prompt,
      image_input: ELENA_REFS,
      aspect_ratio: "3:4", // Closest to 4:5 Instagram portrait
      size: "2K",
    }
  });

  console.log('Raw output:', output);

  // Extract image URL
  let imageUrl;
  if (typeof output === 'string') {
    imageUrl = output;
  } else if (Array.isArray(output) && output.length > 0) {
    imageUrl = output[0];
  } else {
    const match = String(output).match(/https?:\/\/[^\s"'\]]+/);
    if (match) imageUrl = match[0];
  }

  if (imageUrl) {
    console.log('Image URL:', imageUrl);

    // Download to local file
    const outputFile = 'elena_seedream_nsfw_test.jpg';
    const file = fs.createWriteStream(outputFile);
    https.get(imageUrl, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log(`Saved to ${outputFile}`);
      });
    });
  } else {
    console.error('No image URL in output');
  }
} catch (error) {
  console.error('Error (may be content filter):', error.message || error);
}
