# TASK-005: Auto-Like Engagement Bot

**Status**: 🔵 Todo (Investigation Complete)
**Created**: 2026-01-31
**Feature**: [X](../README.md) > [Engagement](../engagement/)

---

## Goal

Build a bot that automatically likes low-engagement comments on similar creators' posts to increase Elena's visibility and attract followers.

---

## Investigation Summary (2026-01-31)

### What We Want
1. Find posts similar to Elena's (NSFW model/creator niche)
2. Fetch comments/replies on those posts
3. Auto-like comments with ≤3 likes (low competition, high visibility)

### Proposed Schedule (Human-Mimicking)
- 2 random times per day (e.g., morning + evening windows)
- 30-60 likes per session (randomly chosen)
- Total: 60-120 likes/day
- Random delays between likes (30-90 seconds)

---

## Feasibility: Confirmed

### X API Endpoints Required

| Action | Endpoint | Method |
|--------|----------|--------|
| Search posts | `/2/tweets/search/recent` | `client.v2.search(query)` |
| Get replies | Search with `conversation_id:{id}` | Same as search |
| Like tweet | `/2/users/{id}/likes` | `client.v2.like(userId, tweetId)` |

### Rate Limits (Our Plan Fits)

| Limit | X Allows | Our Plan |
|-------|----------|----------|
| Per 15 min | 50 likes | 30-60 (with delays, fits in ~30 min) |
| Per 24 hours | 1,000 likes | 60-120 |

### OAuth Scope Needed

Must add `like.write` to scopes in `x-oauth2-test.mjs`:
```javascript
const SCOPES = [
  'tweet.read',
  'tweet.write',
  'users.read',
  'offline.access',
  'media.write',
  'like.write',  // ADD THIS
];
```

Then re-authenticate: `node app/scripts/x-oauth2-test.mjs`

---

## Acceptance Criteria

- [ ] `like.write` scope added and re-authenticated
- [ ] `app/scripts/x-engagement-bot.mjs` script created
- [ ] Search similar posts using configurable queries
- [ ] Fetch replies via `conversation_id` search
- [ ] Filter replies with ≤3 likes
- [ ] Like qualifying replies with rate limiting
- [ ] Random scheduling (2x/day, 30-60 likes/session)
- [ ] `--dry` mode for testing without liking
- [ ] `--stats` mode to view daily stats
- [ ] Action logging to `.x-engagement-log.json`
- [ ] Safety filters (skip bots, old tweets, viral posts)

---

## Search Queries

```javascript
const SEARCH_QUERIES = [
  '#OnlyFans model -is:retweet has:media',
  '#Fanvue creator -is:retweet has:media',
  '#Fansly exclusive -is:retweet',
  'link in bio exclusive content -is:retweet',
];
```

---

## Rate Limiting Strategy

```javascript
const RATE_LIMITS = {
  LIKE_DELAY_MS: 45_000,        // 45 sec between likes (+ random jitter)
  SEARCH_DELAY_MS: 90_000,      // 90 sec between searches
  DAILY_LIKE_CAP: 200,          // Hard cap
  LIKES_PER_SESSION: [30, 60],  // Random range per session
  MAX_LIKE_COUNT: 3,            // Only like if reply has ≤3 likes
};
```

---

## Human-Mimicking Patterns

| Pattern | Implementation |
|---------|----------------|
| Random times | Pick 2 times from windows: `[9-12h]` and `[18-22h]` |
| Random count | 30-60 likes per session |
| Random delays | 30-90 sec between likes (jitter ±30%) |
| Skip days | Occasionally skip weekends/holidays |
| Burst patterns | Sometimes 3-5 quick likes, then longer pause |

---

## Safety Filters

```javascript
const SAFETY_FILTERS = {
  MIN_AUTHOR_FOLLOWERS: 100,   // Skip bot accounts
  MAX_TWEET_AGE_HOURS: 48,     // Focus on recent content
  SKIP_HIGH_ENGAGEMENT: 100,   // Skip viral tweets
  SKIP_OWN_TWEETS: true,       // Never like own content
};
```

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `app/scripts/x-oauth2-test.mjs` | Add `like.write` to SCOPES |
| `app/scripts/x-engagement-bot.mjs` | **NEW** - Main bot script |
| `app/scripts/.x-engagement-log.json` | **NEW** - Action log (auto-created) |

---

## CLI Interface

```bash
node x-engagement-bot.mjs              # Run engagement cycle
node x-engagement-bot.mjs --dry        # Preview without liking
node x-engagement-bot.mjs --query "q"  # Custom search query
node x-engagement-bot.mjs --stats      # Show daily stats
```

---

## Risk Assessment

| Risk | Level | Mitigation |
|------|-------|------------|
| Account suspension | HIGH | X explicitly bans auto-liking |
| Rate limiting | LOW | Conservative limits (50% of max) |
| Bot detection | MEDIUM | Random delays, human-like patterns |

**Recommendation**: Start with very low volume (10-20 likes/day) and monitor for warnings before scaling up.

---

## Progress Log

### 2026-01-31
- Investigation completed
- Confirmed API feasibility (endpoints, rate limits, scopes)
- Documented human-mimicking patterns
- Risk: X ToS prohibits auto-liking, proceed with caution
- Decision: Task documented for future implementation if needed

---

## Outcome

_Investigation complete. Implementation pending user decision to proceed given ToS risks._

---

## Ralph Sessions

_Automatically filled when Ralph completes this task_
