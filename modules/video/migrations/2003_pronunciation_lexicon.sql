-- PipelineX: the pronunciation dictionary the voice step reads from. The admin page edits these
-- rows; the enabled ones are materialized to industry/lexicon.json for the renderer (tts.py).
-- Terms come from the Studio's lexicon export; only ASR-verified rows are enabled, and enabling
-- more is the channel owner's call, never the import's.
CREATE TABLE pronunciation_lexicon (
  id             bigserial PRIMARY KEY,
  term           text NOT NULL UNIQUE,
  reading        text NOT NULL,
  scope          text NOT NULL DEFAULT 'all',
  category_scope text NOT NULL DEFAULT 'all',
  enabled        boolean NOT NULL DEFAULT false,
  locked         boolean NOT NULL DEFAULT false,
  asr_status     text NOT NULL DEFAULT '',
  note           text NOT NULL DEFAULT '',
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
