-- Content queue for automated X/Fanvue posting
CREATE TABLE IF NOT EXISTS content_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL CHECK (platform IN ('x', 'fanvue')),
  image_url TEXT NOT NULL,
  cloudinary_id TEXT,
  caption TEXT NOT NULL,
  posted BOOLEAN DEFAULT FALSE,
  posted_at TIMESTAMPTZ,
  prompt TEXT,
  seed INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick "next unposted" queries
CREATE INDEX IF NOT EXISTS idx_content_queue_unposted
  ON content_queue (platform, posted, created_at)
  WHERE posted = FALSE;
