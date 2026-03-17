-- Juno MVP Schema
-- Run this in Supabase SQL Editor or via migrations

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- COACHES
-- ============================================
CREATE TABLE coaches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  timezone VARCHAR(50) DEFAULT 'America/New_York',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS: Coaches can only see their own data
ALTER TABLE coaches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches can view own profile"
  ON coaches FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Coaches can update own profile"
  ON coaches FOR UPDATE
  USING (auth.uid() = id);

-- ============================================
-- BRAND PROFILES (Voice Learning)
-- ============================================
CREATE TABLE brand_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  coach_id UUID UNIQUE REFERENCES coaches(id) ON DELETE CASCADE,

  -- Core voice attributes
  style_words VARCHAR(255),           -- "energetic, no-BS, supportive"
  tone VARCHAR(50),                   -- 'motivational', 'educational', 'casual', 'professional', 'raw'
  emoji_usage VARCHAR(20),            -- 'never', 'sparingly', 'frequently', 'heavily'
  sign_off TEXT,                      -- "Let's go! 💪"

  -- Boundaries
  avoided_topics TEXT[],              -- ['politics', 'competitor X']
  avoided_words TEXT[],               -- ['just', 'very', 'amazing']
  preferred_words TEXT[],             -- ['transform', 'unleash', 'crush it']

  -- Audience
  target_audience TEXT,               -- "Busy moms who want to get strong"

  -- Example content (for style matching)
  example_posts TEXT[],               -- Up to 5 pasted captions

  -- Metadata
  completed_at TIMESTAMP WITH TIME ZONE,  -- NULL if skipped
  skipped_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE brand_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches can view own brand profile"
  ON brand_profiles FOR SELECT
  USING (coach_id = auth.uid());

CREATE POLICY "Coaches can insert own brand profile"
  ON brand_profiles FOR INSERT
  WITH CHECK (coach_id = auth.uid());

CREATE POLICY "Coaches can update own brand profile"
  ON brand_profiles FOR UPDATE
  USING (coach_id = auth.uid());

-- ============================================
-- CONTENT FRAMEWORKS (5 hardcoded for MVP)
-- ============================================
CREATE TABLE content_frameworks (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  output_type VARCHAR(50),             -- 'caption', 'carousel_script'
  questions JSONB NOT NULL,            -- Array of question objects
  prompt_template TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert the 5 MVP frameworks
INSERT INTO content_frameworks (id, name, description, output_type, questions, prompt_template, display_order) VALUES
('client_win', 'Client Win Story', 'Celebrate client success, build social proof', 'caption',
 '[{"key": "client_name", "question": "Client''s first name (or ''a client'' if anonymous)", "type": "text"},
   {"key": "achievement", "question": "What did they achieve?", "type": "text"},
   {"key": "obstacle", "question": "What was their biggest obstacle?", "type": "text"},
   {"key": "timeframe", "question": "How long did it take?", "type": "text"},
   {"key": "lesson", "question": "One lesson others can learn from this", "type": "text"}]'::jsonb,
 'Write an Instagram caption celebrating a client transformation.

Client: {client_name}
Achievement: {achievement}
Obstacle they overcame: {obstacle}
Timeframe: {timeframe}
Key lesson: {lesson}

Structure:
- Hook (stop the scroll)
- The struggle (relatable)
- The transformation (specific)
- The lesson (actionable)
- CTA (engagement or DM)', 1),

('educational_carousel', 'Educational Carousel', 'Teach something valuable, establish expertise', 'carousel_script',
 '[{"key": "topic", "question": "What topic do you want to teach?", "type": "text"},
   {"key": "audience", "question": "Who is this for?", "type": "text"},
   {"key": "mistake", "question": "What''s the common mistake people make with this?", "type": "text"},
   {"key": "unique_take", "question": "What''s your unique take or method?", "type": "text"}]'::jsonb,
 'Create an Instagram carousel script about {topic}.

Target audience: {audience}
Common mistake: {mistake}
Coach''s unique approach: {unique_take}

Structure:
- Slide 1 (Cover): Bold claim or question that stops the scroll
- Slides 2-6: One key point per slide (short, scannable)
- Slide 7: Summary or "The truth is..."
- Slide 8: CTA (save, share, follow, DM)

Format each slide as:
**Slide N: [Title]**
[Body text - max 30 words per slide]', 2),

('engagement_hook', 'Engagement Hook', 'Start conversations, boost algorithm', 'caption',
 '[{"key": "take_or_myth", "question": "What''s a spicy take or common myth in your niche?", "type": "text"},
   {"key": "engagement_type", "question": "What do you want people to comment?", "type": "select", "options": ["Their opinion", "Their experience", "A or B choice"]}]'::jsonb,
 'Write a short Instagram engagement post.

Hot take or myth: {take_or_myth}
Desired engagement: {engagement_type}

Structure:
- Bold statement (challenge conventional wisdom)
- Brief explanation (1-2 sentences)
- Direct question to audience

Keep it under 100 words. End with a question that''s easy to answer.', 3),

('behind_the_scenes', 'Behind the Scenes', 'Build connection, show authenticity', 'caption',
 '[{"key": "activity", "question": "What are you doing today?", "type": "text"},
   {"key": "why_it_matters", "question": "Why does this matter to your audience?", "type": "text"},
   {"key": "insight", "question": "What''s one thing people don''t realize about this?", "type": "text"}]'::jsonb,
 'Write a casual behind-the-scenes Instagram caption.

Activity: {activity}
Why it matters: {why_it_matters}
Insider insight: {insight}

Structure:
- Casual opener (like talking to a friend)
- What you''re doing and why
- The insight or lesson
- Soft CTA (question or invitation to share theirs)

Keep it conversational and authentic. Not salesy.', 4),

('myth_buster', 'Myth Buster', 'Establish authority, challenge misinformation', 'caption',
 '[{"key": "myth", "question": "What myth or misconception do you want to bust?", "type": "text"},
   {"key": "why_believed", "question": "Why do people believe this?", "type": "text"},
   {"key": "truth", "question": "What''s the truth?", "type": "text"},
   {"key": "action", "question": "What should people do instead?", "type": "text"}]'::jsonb,
 'Write an Instagram caption busting a fitness/wellness myth.

Myth: {myth}
Why people believe it: {why_believed}
The truth: {truth}
What to do instead: {action}

Structure:
- Hook: State the myth boldly ("Stop believing this...")
- Acknowledge why it''s believable
- Drop the truth (with brief explanation)
- Actionable alternative
- CTA (save this, share with someone who needs it)

Be authoritative but not condescending.', 5);

-- ============================================
-- CONTENT BATCHES (Plan My Week)
-- ============================================
CREATE TABLE content_batches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  coach_id UUID REFERENCES coaches(id) ON DELETE CASCADE,

  -- Inputs
  focus_topic TEXT,
  posting_days TEXT[],                -- ['monday', 'wednesday', 'friday']
  has_promotion BOOLEAN DEFAULT false,
  promotion_text TEXT,

  -- Status
  status VARCHAR(20) DEFAULT 'generating', -- 'generating', 'ready', 'partial_saved', 'all_saved'

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE content_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches can view own batches"
  ON content_batches FOR SELECT
  USING (coach_id = auth.uid());

CREATE POLICY "Coaches can insert own batches"
  ON content_batches FOR INSERT
  WITH CHECK (coach_id = auth.uid());

CREATE POLICY "Coaches can update own batches"
  ON content_batches FOR UPDATE
  USING (coach_id = auth.uid());

-- ============================================
-- CONTENT
-- ============================================
CREATE TABLE content (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  coach_id UUID REFERENCES coaches(id) ON DELETE CASCADE,

  -- Content
  type VARCHAR(50) NOT NULL,          -- 'caption', 'carousel_script'
  status VARCHAR(20) DEFAULT 'draft', -- 'draft', 'reminder_set', 'posted'
  body TEXT NOT NULL,

  -- Framework tracking
  framework_id VARCHAR(50) REFERENCES content_frameworks(id),
  framework_answers JSONB,            -- Answers provided during guided flow

  -- Batch tracking
  batch_id UUID REFERENCES content_batches(id),
  batch_position INTEGER,

  -- Scheduling
  reminder_at TIMESTAMP WITH TIME ZONE,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_content_coach ON content(coach_id);
CREATE INDEX idx_content_status ON content(status);
CREATE INDEX idx_content_reminder ON content(reminder_at) WHERE status = 'reminder_set';

ALTER TABLE content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches can view own content"
  ON content FOR SELECT
  USING (coach_id = auth.uid());

CREATE POLICY "Coaches can insert own content"
  ON content FOR INSERT
  WITH CHECK (coach_id = auth.uid());

CREATE POLICY "Coaches can update own content"
  ON content FOR UPDATE
  USING (coach_id = auth.uid());

CREATE POLICY "Coaches can delete own content"
  ON content FOR DELETE
  USING (coach_id = auth.uid());

-- ============================================
-- CHAT MESSAGES
-- ============================================
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  coach_id UUID REFERENCES coaches(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,

  -- Optional: link to generated content
  content_id UUID REFERENCES content(id) ON DELETE SET NULL,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_chat_messages_coach ON chat_messages(coach_id, created_at DESC);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches can view own messages"
  ON chat_messages FOR SELECT
  USING (coach_id = auth.uid());

CREATE POLICY "Coaches can insert own messages"
  ON chat_messages FOR INSERT
  WITH CHECK (coach_id = auth.uid());

-- ============================================
-- FRAMEWORK USAGE TRACKING
-- ============================================
CREATE TABLE framework_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  coach_id UUID REFERENCES coaches(id) ON DELETE CASCADE,
  framework_id VARCHAR(50) REFERENCES content_frameworks(id),
  content_id UUID REFERENCES content(id) ON DELETE SET NULL,
  answers JSONB,
  completed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE framework_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches can view own framework usage"
  ON framework_usage FOR SELECT
  USING (coach_id = auth.uid());

CREATE POLICY "Coaches can insert own framework usage"
  ON framework_usage FOR INSERT
  WITH CHECK (coach_id = auth.uid());

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_coaches_updated_at
  BEFORE UPDATE ON coaches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_brand_profiles_updated_at
  BEFORE UPDATE ON brand_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_content_updated_at
  BEFORE UPDATE ON content
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- AUTH TRIGGER: Create coach on signup
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.coaches (id, email)
  VALUES (NEW.id, NEW.email);

  -- Also create empty brand profile
  INSERT INTO public.brand_profiles (coach_id)
  VALUES (NEW.id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
