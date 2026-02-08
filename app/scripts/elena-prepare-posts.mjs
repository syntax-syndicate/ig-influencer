#!/usr/bin/env node
/**
 * Elena Content Pipeline — Prepare Posts
 *
 * Takes approved images, uploads to Cloudinary, generates captions with Claude,
 * and queues them in Supabase for automated posting.
 *
 * Flow:
 *   1. Scan elena_content/approved/x/ and approved/fanvue/
 *   2. Upload each image to Cloudinary
 *   3. Claude generates caption per image (Elena voice, platform-appropriate)
 *   4. Save to Supabase content_queue table
 *   5. Move processed images to elena_content/posted/
 *
 * Usage:
 *   node app/scripts/elena-prepare-posts.mjs              # Process all approved images
 *   node app/scripts/elena-prepare-posts.mjs --dry        # Preview without uploading/posting
 *   node app/scripts/elena-prepare-posts.mjs --no-move    # Don't move files after processing
 */

import dotenv from 'dotenv';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join, basename } from 'path';
import { readdirSync, existsSync, renameSync, readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');

dotenv.config({ path: join(__dirname, '..', '.env.local') });

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

// ═══════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const CLAUDE_KEY = process.env.ANTHROPIC_API_KEY || process.env.Claude_key || process.env.CLAUDE_KEY;
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;

const APPROVED_X = join(PROJECT_ROOT, 'elena_content', 'approved', 'x');
const APPROVED_FANVUE = join(PROJECT_ROOT, 'elena_content', 'approved', 'fanvue');
const POSTED_DIR = join(PROJECT_ROOT, 'elena_content', 'posted');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry');
const NO_MOVE = args.includes('--no-move');

// ═══════════════════════════════════════════════════════════════
// CLOUDINARY UPLOAD (from local file)
// ═══════════════════════════════════════════════════════════════

async function uploadToCloudinary(filePath, folder = 'elena-x') {
  const timestamp = Math.floor(Date.now() / 1000);
  const signatureString = `folder=${folder}&timestamp=${timestamp}${CLOUDINARY_API_SECRET}`;
  const signature = crypto.createHash('sha1').update(signatureString).digest('hex');

  const fileBuffer = readFileSync(filePath);
  const base64 = `data:image/png;base64,${fileBuffer.toString('base64')}`;

  const formData = new FormData();
  formData.append('file', base64);
  formData.append('api_key', CLOUDINARY_API_KEY);
  formData.append('timestamp', timestamp.toString());
  formData.append('signature', signature);
  formData.append('folder', folder);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    { method: 'POST', body: formData }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Cloudinary upload failed: ${error}`);
  }

  const result = await response.json();
  return {
    url: result.secure_url,
    publicId: result.public_id,
  };
}

// ═══════════════════════════════════════════════════════════════
// CLAUDE CAPTION GENERATION
// ═══════════════════════════════════════════════════════════════

async function generateCaptions(images) {
  const anthropic = new Anthropic({ apiKey: CLAUDE_KEY });

  const imageList = images.map((img, i) =>
    `${i + 1}. [${img.platform.toUpperCase()}] ${img.filename}`
  ).join('\n');

  const prompt = `You are Elena Visconti, a 24yo married French woman in Paris. Your husband is always traveling for business.
You're gleeful, free, flirty — you love your situation (freedom + money).

Your X/Twitter voice:
- Short, punchy, mysterious
- Mix English with occasional French words
- Hint at secrets, freedom, "bad decisions"
- Tease Fanvue link occasionally ("link in bio if you can keep a secret 😏")
- Use 0-2 emojis max per tweet
- 280 chars max
- NO hashtags (they look desperate on X)

Write ONE caption for each of these images. Consider the filename for context about the scene.

${imageList}

For X images: suggestive, teasing, mysterious — hint at what followers can't see
For Fanvue images: more explicit/bold, reward the subscriber

Return JSON only:
{
  "captions": [
    { "index": 1, "caption": "..." },
    { "index": 2, "caption": "..." }
  ]
}`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].text;
  let jsonStr = text;
  const codeBlock = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) jsonStr = codeBlock[1];
  else {
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) jsonStr = jsonMatch[0];
  }

  const parsed = JSON.parse(jsonStr.trim());
  return parsed.captions;
}

// ═══════════════════════════════════════════════════════════════
// SCAN APPROVED FOLDERS
// ═══════════════════════════════════════════════════════════════

function scanApproved() {
  const images = [];

  const imageExts = ['.png', '.jpg', '.jpeg', '.webp'];

  for (const dir of [APPROVED_X, APPROVED_FANVUE]) {
    if (!existsSync(dir)) continue;
    const platform = dir.includes('/x') ? 'x' : 'fanvue';
    const files = readdirSync(dir).filter(f =>
      imageExts.some(ext => f.toLowerCase().endsWith(ext))
    );
    for (const file of files) {
      images.push({
        filename: file,
        path: join(dir, file),
        platform,
      });
    }
  }

  return images;
}

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📤 ELENA CONTENT PIPELINE — Prepare Posts');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  if (DRY_RUN) console.log('   🔍 DRY RUN — no uploads or database writes');
  console.log('');

  // Check env vars
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    console.error('❌ Missing Cloudinary credentials');
    process.exit(1);
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Missing Supabase credentials');
    process.exit(1);
  }
  if (!CLAUDE_KEY) {
    console.error('❌ Missing ANTHROPIC_API_KEY');
    process.exit(1);
  }

  // Scan approved folders
  const images = scanApproved();

  if (images.length === 0) {
    console.log('📁 No images found in approved folders.');
    console.log('   Move images to:');
    console.log(`   - ${APPROVED_X} (for X/Twitter)`);
    console.log(`   - ${APPROVED_FANVUE} (for Fanvue)`);
    return;
  }

  const xCount = images.filter(i => i.platform === 'x').length;
  const fanvueCount = images.filter(i => i.platform === 'fanvue').length;
  console.log(`📸 Found ${images.length} images (${xCount} for X, ${fanvueCount} for Fanvue)\n`);

  // Generate captions with Claude
  console.log('💬 Generating captions with Claude...\n');
  const captions = await generateCaptions(images);

  // Preview
  images.forEach((img, i) => {
    const caption = captions.find(c => c.index === i + 1);
    console.log(`   ${i + 1}. [${img.platform.toUpperCase()}] ${img.filename}`);
    console.log(`      "${caption?.caption || 'No caption generated'}"`);
    console.log('');
  });

  if (DRY_RUN) {
    console.log('🔍 DRY RUN complete. Remove --dry to upload and queue.\n');
    return;
  }

  // Upload and queue
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    const caption = captions.find(c => c.index === i + 1);

    console.log(`📤 Processing ${i + 1}/${images.length}: ${img.filename}`);

    // Upload to Cloudinary
    const folder = img.platform === 'x' ? 'elena-x' : 'elena-fanvue';
    const { url, publicId } = await uploadToCloudinary(img.path, folder);
    console.log(`   ✅ Uploaded: ${url.substring(0, 60)}...`);

    // Insert into Supabase queue
    const { error } = await supabase
      .from('content_queue')
      .insert({
        platform: img.platform,
        image_url: url,
        cloudinary_id: publicId,
        caption: caption?.caption || '',
        posted: false,
        metadata: { filename: img.filename },
      });

    if (error) {
      console.log(`   ❌ Supabase error: ${error.message}`);
      continue;
    }
    console.log(`   ✅ Queued in Supabase`);

    // Move to posted/
    if (!NO_MOVE) {
      const dest = join(POSTED_DIR, img.filename);
      renameSync(img.path, dest);
      console.log(`   📁 Moved to posted/`);
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ PREPARE COMPLETE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`   Uploaded: ${images.length} images to Cloudinary`);
  console.log(`   Queued: ${images.length} posts in Supabase`);
  console.log('\n📋 Posts will be published by GitHub Actions:');
  console.log('   X: 4x/day (9h, 14h, 19h, 22h CET)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch(err => {
  console.error('❌ Fatal error:', err.message);
  process.exit(1);
});
