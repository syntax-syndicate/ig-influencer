# X (Twitter)

> Distribution channel for @ElenaVisco46970 — traffic source to Fanvue

**Last updated**: 8 February 2026

---

## Status: ✅ READY (API working)

> Account created, OAuth 2.0 authentication working, can post tweets via API.

---

## Sub-features

| Feature | Status | Description | Link |
|---------|--------|-------------|------|
| **Setup** | ✅ Done | Account + API working | [→](./setup/) |
| **Posting** | 🟡 Planning Done | Real-time generation, 3-4 posts/day | [→](./posting/) |
| **Replies** | 🔵 Todo | Auto-reply to comments (Claude AI) | [→](./replies/) |
| **Engagement** | 🔵 Todo | Manual like tactics (NO automation) | [→](./engagement/) |

---

## Strategy Overview

### Why X/Twitter

| Factor | X/Twitter | Instagram |
|--------|-----------|-----------|
| NSFW content | Allowed (labeled) | Restricted |
| DM automation | Not needed | Got us banned |
| API for posting | $0 (free tier) | Via ManyChat |
| Ban risk | Lower | Higher |

### Funnel

```
X teasers (3-4/day) → Profile → Bio link → Fanvue → Venice AI chat → PPV/Tips
```

### Key Rules

| Do | Don't |
|----|-------|
| Post 3-4x/day | Auto-DM |
| Auto-reply to OWN post comments | Auto-reply on others' posts |
| Like manually (100-200/day) | Auto-like |
| Use 2-10 min delays | Reply instantly |
| Redirect to Fanvue occasionally | Spam links in every reply |
| Label sensitive content | Post unlabeled NSFW |

---

## Active Tasks

| Task | Title | Status | Date |
|------|-------|--------|------|
| TASK-003 | X Auto-Posting (Content Brain) | 🔵 Todo | 2026-01-29 |
| TASK-004 | Temporary Cloudinary Posting | ⏸️ Paused | 2026-01-30 |
| TASK-005 | Auto-Like Engagement Bot | 🔵 Todo (Investigated) | 2026-01-31 |
| TASK-006 | Viral Reply Bot | 🔵 Todo (Investigated) | 2026-01-31 |
## Done Tasks (not yet renamed)

| Task | Title | Status | Date |
|------|-------|--------|------|
| TASK-001 | Account Setup & API | ✅ Done | 2026-01-29 |

---

## Completed Tasks

| Task | Title | Status | Date |
|------|-------|--------|------|
| DONE-002 | X API OAuth 2.0 Connection | ✅ Complete | 2026-01-29 |
| DONE-007 | Elena Content Pipeline (Generate → Curate → Post) | ✅ Complete | 2026-02-08 |

---

## Key Decisions

| Date | Decision | Reason |
|------|----------|--------|
| 2026-01-29 | Real-time generation for posting | Generate at post time, not daily scheduler. More reactive to changes. |
| 2026-01-29 | Text-only posts first | ComfyUI face consistency not ready. Add images later. |
| 2026-01-29 | Use OAuth 2.0 instead of OAuth 1.0a | OAuth 1.0a doesn't work with Pay Per Use tier |
| 2026-01-29 | Auto-reply to OWN post comments OK | Reactive engagement is safer than proactive DMs |
| 2026-01-29 | No mass auto-engagement | Can't auto-like/reply on OTHER accounts' posts |
| 2026-01-29 | No DM automation | Lesson from IG ban |
| 2026-01-29 | Fanvue handles chat | Venice AI already built there |
| 2026-01-29 | 2-10 min delays on replies | Looks human, avoids bot detection |

---

## Quick Stats

| Metric | Value |
|--------|-------|
| **Account** | @ElenaVisco46970 |
| **Name** | Elena Visconti |
| **Posts** | 3-4/day (target) |
| **API Plan** | Pay Per Use ($10 credits) |
| **API Status** | ✅ OAuth 2.0 working |

---

## What Works ✅

- X account created and active
- Bio and profile picture set
- Developer Portal account created
- Pay Per Use credits loaded
- **OAuth 2.0 authentication (user context)**
- **Posting tweets via API**
- User lookup via API
- Token refresh for long-term use
- **Image posting via v2 API** (OAuth 2.0 + `media.write` scope)
- **33 Cloudinary images ready to post** (with captions)
- **Elena Content Pipeline** (generate → curate → prepare → auto-post)
- **GitHub Actions auto-posting** (4x/day from Supabase queue)
- **OAuth2 auto-refresh** (tokens persist in Supabase, auto-refresh on 401)

## What Doesn't Work ❌

- OAuth 1.0a (legacy, broken with Pay Per Use tier)
- v1.uploadMedia (requires OAuth 1.0a, use v2.uploadMedia instead)

---

## API Usage

```bash
# Check auth status
node app/scripts/x-oauth2-test.mjs --status

# Post a tweet
node app/scripts/x-oauth2-test.mjs --post

# Refresh tokens (if expired)
node app/scripts/x-oauth2-test.mjs --refresh

# Post from Cloudinary catalog (TASK-004)
node app/scripts/x-post-cloudinary.mjs --list          # List all 33 images
node app/scripts/x-post-cloudinary.mjs --id 2 --dry    # Preview post
node app/scripts/x-post-cloudinary.mjs --id 2          # Post (text-only until media.write enabled)

# Content Pipeline (DONE-007)
node app/scripts/elena-generate-batch.mjs --count 5 --dry    # Preview prompts
node app/scripts/elena-generate-batch.mjs --count 10         # Generate batch on Vast.ai
node app/scripts/elena-prepare-posts.mjs --dry               # Preview captions
node app/scripts/elena-prepare-posts.mjs                     # Upload + queue
node app/scripts/x-post-from-queue.mjs --status              # Check queue
node app/scripts/x-post-from-queue.mjs --dry                 # Preview next post
```

---

## Related Features

- [ComfyUI Generation →](../comfyui-generation-workflow/) — Image generation
- [Fanvue →](../fanvue/) — Conversion destination
- [Elena Persona →](../elena-persona/) — Character definition
- [Instagram →](../instagram/) — ABANDONED, lessons learned
