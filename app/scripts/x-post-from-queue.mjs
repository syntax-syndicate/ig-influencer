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
import { readFileSync, writeFileSync, existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env.local') });

import { createClient } from '@supabase/supabase-js';

// ═══════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const X_CLIENT_ID = process.env.X_CLIENT_ID;
const X_CLIENT_SECRET = process.env.X_CLIENT_SECRET;
const TOKEN_FILE = join(__dirname, '.x-oauth2-tokens.json');
const TOKEN_KEY = 'x_oauth2_tokens'; // Supabase storage key

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry');
const STATUS_ONLY = args.includes('--status');

// ═══════════════════════════════════════════════════════════════
// TOKEN MANAGEMENT (Supabase-persistent for GitHub Actions)
// ═══════════════════════════════════════════════════════════════

async function loadTokens(supabase) {
  // 1. Try Supabase first (persists across GitHub Actions runs)
  const { data } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', TOKEN_KEY)
    .single();

  if (data?.value?.accessToken) {
    console.log('   🔑 Tokens loaded from Supabase');
    return data.value;
  }

  // 2. Try local file (dev)
  if (existsSync(TOKEN_FILE)) {
    const tokens = JSON.parse(readFileSync(TOKEN_FILE, 'utf-8'));
    console.log('   🔑 Tokens loaded from local file');
    // Seed Supabase with local tokens for future GH Actions runs
    await saveTokensToSupabase(supabase, tokens);
    return tokens;
  }

  // 3. Fall back to env vars (first GH Actions run)
  if (process.env.X_OAUTH2_ACCESS_TOKEN) {
    const tokens = {
      accessToken: process.env.X_OAUTH2_ACCESS_TOKEN,
      refreshToken: process.env.X_OAUTH2_REFRESH_TOKEN,
      username: process.env.X_USERNAME || 'elenav_paris',
    };
    console.log('   🔑 Tokens loaded from env vars');
    await saveTokensToSupabase(supabase, tokens);
    return tokens;
  }

  console.error('❌ No X OAuth tokens found');
  process.exit(1);
}

async function saveTokensToSupabase(supabase, tokens) {
  const { error } = await supabase
    .from('app_config')
    .upsert({ key: TOKEN_KEY, value: tokens, updated_at: new Date().toISOString() });
  if (error) {
    console.log(`   ⚠️ Could not save tokens to Supabase: ${error.message}`);
  }
}

function saveTokensToFile(tokens) {
  if (existsSync(TOKEN_FILE) || !process.env.GITHUB_ACTIONS) {
    try {
      writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2));
    } catch {}
  }
}

async function refreshTokens(supabase, tokens) {
  if (!X_CLIENT_ID || !X_CLIENT_SECRET) {
    console.error('   ❌ Cannot refresh: missing X_CLIENT_ID / X_CLIENT_SECRET');
    return null;
  }
  if (!tokens.refreshToken) {
    console.error('   ❌ Cannot refresh: no refresh token');
    return null;
  }

  console.log('   🔄 Refreshing expired token...');

  const authClient = new TwitterApi({ clientId: X_CLIENT_ID, clientSecret: X_CLIENT_SECRET });
  const { accessToken, refreshToken: newRefreshToken, client: refreshedClient } =
    await authClient.refreshOAuth2Token(tokens.refreshToken);

  const me = await refreshedClient.v2.me();

  const newTokens = {
    accessToken,
    refreshToken: newRefreshToken,
    username: me.data.username,
    userId: me.data.id,
    step: 'authenticated',
    authenticatedAt: tokens.authenticatedAt || new Date().toISOString(),
    refreshedAt: new Date().toISOString(),
  };

  // Persist everywhere
  await saveTokensToSupabase(supabase, newTokens);
  saveTokensToFile(newTokens);

  console.log(`   ✅ Token refreshed for @${me.data.username}`);
  return newTokens;
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
  const postedCount = (allPosts || []).filter(p => p.posted).length;
  console.log(`\n   📊 Queue: ${queued} pending, ${postedCount} posted\n`);

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

  // Post to X (with auto-refresh on 401)
  console.log('\n   🚀 Posting to X...');

  let tokens = await loadTokens(supabase);
  const imageBuffer = await fetchImageBuffer(nextPost.image_url);
  console.log(`   📥 Image fetched (${(imageBuffer.length / 1024).toFixed(0)} KB)`);

  let posted = false;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const client = new TwitterApi(tokens.accessToken);

      const mediaId = await client.v2.uploadMedia(imageBuffer, {
        media_type: 'image/png',
        media_category: 'tweet_image',
      });
      console.log(`   📤 Media uploaded (ID: ${mediaId})`);

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
      posted = true;
      break;

    } catch (error) {
      const is401 = String(error.message).includes('401') ||
        error.code === 401 || error.data?.status === 401;

      if (is401 && attempt === 1) {
        console.log(`\n   ⚠️ Token expired (401). Auto-refreshing...`);
        try {
          const newTokens = await refreshTokens(supabase, tokens);
          if (newTokens) {
            tokens = newTokens;
            console.log('   🔁 Retrying post with fresh token...\n');
            continue;
          }
        } catch (refreshErr) {
          console.error(`   ❌ Refresh failed: ${refreshErr.message}`);
        }
      }

      console.error(`\n   ❌ POSTING FAILED: ${error.message}`);
      if (error.data) console.error('   Details:', JSON.stringify(error.data, null, 2));
      process.exit(1);
    }
  }

  if (!posted) {
    console.error('   ❌ Failed after refresh retry');
    process.exit(1);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch(err => {
  console.error('❌ Fatal error:', err.message);
  process.exit(1);
});
