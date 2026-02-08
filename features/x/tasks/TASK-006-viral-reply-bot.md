# TASK-006: Viral Reply Bot

**Status**: 🔵 Todo (Investigation Complete)
**Created**: 2026-01-31
**Feature**: [X](../README.md) > [Engagement](../engagement/)

---

## Goal

"Early bird viral reply" - get maximum visibility by replying early to posts going viral in the NSFW/model niche.

---

## Strategy

### Target Posts
- **Age**: Less than 5 minutes old
- **Views**: Already 1,000+ impressions (viral potential)
- **Niche**: NSFW/model creators only (#OnlyFans, #Fanvue, similar accounts)

### Reply Types (Mix)
1. **Witty text reply** - Claude analyzes post → generates funny/engaging reply
2. **Sexy photo reply** - Pick from Cloudinary catalog OR generate via ComfyUI

### Approval Flow
- **Fully autonomous** - no human-in-the-loop

---

## API Feasibility: Confirmed

| Capability | Supported | How |
|------------|-----------|-----|
| Get view count | ✅ | `public_metrics.impression_count` |
| Filter by time | ✅ | `start_time` parameter (ISO 8601) |
| Sort by recency | ✅ | `sort_order: 'recency'` |
| Get media URLs | ✅ | `expansions: 'attachments.media_keys'` |
| Reply with media | ✅ | Already working (`v2.uploadMedia`) |

---

## Implementation Approach

### Phase 1: Viral Post Discovery

```javascript
const now = new Date();
const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

const result = await client.v2.search('#OnlyFans OR #Fanvue -is:retweet has:media', {
  start_time: fiveMinutesAgo.toISOString(),
  sort_order: 'recency',
  'tweet.fields': 'public_metrics,created_at,author_id,attachments',
  'media.fields': 'url,preview_image_url,type,alt_text',
  expansions: ['author_id', 'attachments.media_keys'],
  max_results: 100
});

// Filter for 1k+ views
const viralPosts = result.data.filter(t =>
  t.public_metrics?.impression_count >= 1000
);
```

### Phase 2: Content Analysis

For each viral post:
1. Extract caption text
2. Download image URL
3. Send to Claude Vision for analysis:
   - What's the vibe? (sexy, funny, provocative)
   - Text reply or photo reply?
   - Draft the reply or describe needed photo

```javascript
const analysis = await claude.analyze({
  image: mediaUrl,
  text: tweetText,
  prompt: `You're Elena, a 24yo playful luxury wife.
           Analyze this post and decide:
           1. Should you reply with text (witty/flirty) or photo?
           2. What's the perfect reply angle?
           3. Draft the reply or describe the photo needed.`
});
```

### Phase 3: Reply Generation

**Text Reply**:
```javascript
const reply = await claude.generate({
  prompt: `Generate a witty X reply as Elena.
           Goal: Make people laugh OR show Elena as sexy.
           Keep it short (< 200 chars), engaging, flirty.`
});
await client.v2.reply(reply.text, tweetId);
```

**Photo Reply**:
```javascript
const mediaId = await client.v2.uploadMedia(imageBuffer);
await client.v2.reply(caption, tweetId, { media: { media_ids: [mediaId] } });
```

### Phase 4: Scheduling

- Run every 15-30 minutes during active hours
- Max 10-20 replies per day (conservative)
- Random delays between replies (2-5 min)

---

## Acceptance Criteria

- [ ] `app/scripts/x-viral-reply-bot.mjs` script created
- [ ] Search for posts <5 min old with 1k+ views
- [ ] Filter to NSFW/model niche only
- [ ] Claude Vision analyzes post content
- [ ] Decides text vs photo reply
- [ ] Generates contextual reply
- [ ] Posts reply with appropriate delay
- [ ] `--dry` mode for testing
- [ ] `--stats` mode for daily stats
- [ ] Action logging

---

## Files to Create

| File | Purpose |
|------|---------|
| `app/scripts/x-viral-reply-bot.mjs` | Main bot script |
| `app/scripts/lib/viral-post-finder.mjs` | Search & filter logic |
| `app/scripts/lib/reply-generator.mjs` | Claude analysis + generation |

---

## Search Queries

```javascript
const QUERIES = [
  '#OnlyFans -is:retweet has:media',
  '#Fanvue creator -is:retweet has:media',
  '#Fansly model -is:retweet has:media',
  '#NSFW model -is:retweet has:media',
  'link in bio exclusive -is:retweet has:media',
];
```

---

## Rate Limits

| Action | X Limit | Our Limit |
|--------|---------|-----------|
| Search | 300/15min | 4/15min |
| Reply | 200/15min | 10/day |
| Upload media | 415/15min | 10/day |

---

## Safety Considerations

| Risk | Mitigation |
|------|------------|
| X auto-reply ban | Low volume (10-20/day), human-like delays |
| Spammy appearance | Varied replies, contextual content |
| Wrong context | Claude Vision validates before replying |
| Rate limiting | Conservative limits, 15-30 min intervals |

---

## CLI Interface

```bash
node x-viral-reply-bot.mjs              # Run one cycle
node x-viral-reply-bot.mjs --dry        # Preview without posting
node x-viral-reply-bot.mjs --text-only  # Only text replies
node x-viral-reply-bot.mjs --stats      # Show daily stats
```

---

## Open Questions

1. **ComfyUI integration**: How to generate contextual Elena photos on-demand?
2. **Photo selection**: How to match Cloudinary photos to post context?

---

## Progress Log

### 2026-01-31
- Investigation completed
- API feasibility confirmed (view counts, time filters, media)
- Strategy defined: mix of text and photo replies
- Decision: fully autonomous (no human approval)
- Documented for future implementation

---

## Outcome

_Investigation complete. Implementation pending._

---

## Ralph Sessions

_Automatically filled when Ralph completes this task_
