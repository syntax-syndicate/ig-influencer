#!/usr/bin/env node
/**
 * X Auto-Posting from Queue
 *
 * Picks the next unposted image from Supabase content_queue and posts to X.
 * Designed for GitHub Actions cron (4x/day).
 *
 * Usage:
 *   node app/scripts/x-post-from-queue.mjs              # Post next in queue
 *   node app/scripts/x-post-from-queue.mjs --dry        # Preview without posting
 *   node app/scripts/x-post-from-queue.mjs --status     # Show queue status
 */

import dotenv from 'dotenv';
import { TwitterApi } from 'twitter-api-v2';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env.local') });

import { createClient } from '@supabase/supabase-js';

// ═══════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const TOKEN_FILE = join(__dirname, '.x-oauth2-tokens.json');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry');
const STATUS_ONLY = args.includes('--status');

// ═══════════════════════════════════════════════════════════════
// LOAD X TOKENS
// ═══════════════════════════════════════════════════════════════

function loadTokens() {
  // Try file first (local dev)
  if (existsSync(TOKEN_FILE)) {
    return JSON.parse(readFileSync(TOKEN_FILE, 'utf-8'));
  }
  // Fall back to env vars (GitHub Actions)
  if (process.env.X_OAUTH2_ACCESS_TOKEN) {
    return {
      accessToken: process.env.X_OAUTH2_ACCESS_TOKEN,
      refreshToken: process.env.X_OAUTH2_REFRESH_TOKEN,
      username: process.env.X_USERNAME || 'ElenaVisco46970',
    };
  }
  console.error('❌ No X OAuth tokens found');
  console.error('   Run x-oauth2-test.mjs locally or set X_OAUTH2_ACCESS_TOKEN in GitHub secrets');
  process.exit(1);
}

// ═══════════════════════════════════════════════════════════════
// FETCH IMAGE BUFFER FROM URL
// ═══════════════════════════════════════════════════════════════

async function fetchImageBuffer(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🐦 X AUTO-POST FROM QUEUE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Show queue status
  const { data: allPosts, error: countError } = await supabase
    .from('content_queue')
    .select('id, platform, posted, created_at')
    .eq('platform', 'x');

  if (countError) {
    console.error(`❌ Supabase error: ${countError.message}`);
    process.exit(1);
  }

  const queued = (allPosts || []).filter(p => !p.posted).length;
  const posted = (allPosts || []).filter(p => p.posted).length;
  console.log(`\n   📊 Queue: ${queued} pending, ${posted} posted\n`);

  if (STATUS_ONLY) return;

  if (queued === 0) {
    console.log('   📭 Queue empty — nothing to post');
    console.log('   Run elena-prepare-posts.mjs to add images\n');
    return;
  }

  // Get next unposted image (oldest first)
  const { data: nextPost, error: fetchError } = await supabase
    .from('content_queue')
    .select('*')
    .eq('platform', 'x')
    .eq('posted', false)
    .order('created_at', { ascending: true })
    .limit(1)
    .single();

  if (fetchError || !nextPost) {
    console.error('❌ Could not fetch next post');
    process.exit(1);
  }

  console.log(`   📸 Next post: ${nextPost.id}`);
  console.log(`   🔗 Image: ${nextPost.image_url.substring(0, 60)}...`);
  console.log(`   💬 Caption: "${nextPost.caption}"`);

  if (DRY_RUN) {
    console.log('\n   🔍 DRY RUN — no tweet posted\n');
    return;
  }

  // Post to X
  console.log('\n   🚀 Posting to X...');

  const tokens = loadTokens();
  const client = new TwitterApi(tokens.accessToken);

  try {
    // Fetch and upload image
    const imageBuffer = await fetchImageBuffer(nextPost.image_url);
    console.log(`   📥 Image fetched (${(imageBuffer.length / 1024).toFixed(0)} KB)`);

    const mediaId = await client.v2.uploadMedia(imageBuffer, {
      media_type: 'image/png',
      media_category: 'tweet_image',
    });
    console.log(`   📤 Media uploaded (ID: ${mediaId})`);

    // Post tweet
    const tweet = await client.v2.tweet({
      text: nextPost.caption,
      media: { media_ids: [mediaId] },
    });

    const tweetId = tweet.data?.id;
    const tweetUrl = `https://x.com/${tokens.username}/status/${tweetId}`;

    console.log(`   ✅ Posted! ${tweetUrl}`);

    // Mark as posted in Supabase
    const { error: updateError } = await supabase
      .from('content_queue')
      .update({
        posted: true,
        posted_at: new Date().toISOString(),
        metadata: {
          ...nextPost.metadata,
          tweet_id: tweetId,
          tweet_url: tweetUrl,
        },
      })
      .eq('id', nextPost.id);

    if (updateError) {
      console.error(`   ⚠️ Failed to mark as posted: ${updateError.message}`);
    } else {
      console.log('   ✅ Marked as posted in Supabase');
    }

    console.log(`\n   📊 Remaining in queue: ${queued - 1}`);

  } catch (error) {
    console.error(`\n   ❌ POSTING FAILED: ${error.message}`);
    if (error.data) console.error('   Details:', JSON.stringify(error.data, null, 2));

    if (String(error.message).includes('401')) {
      console.error('\n   💡 Token expired. Run: node x-oauth2-test.mjs --refresh');
    }
    process.exit(1);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch(err => {
  console.error('❌ Fatal error:', err.message);
  process.exit(1);
});
