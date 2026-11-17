-- PipelineX eval: stories picked as candidates for a long-form video.
CREATE TABLE video_candidates (
  id          bigserial PRIMARY KEY,
  story_id    bigint NOT NULL UNIQUE REFERENCES stories (id) ON DELETE CASCADE,
  title       text NOT NULL,
  heat        numeric(10,3) NOT NULL,
  sources     integer NOT NULL,
  status      text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'selected', 'skipped')),
  created_at  timestamptz NOT NULL DEFAULT now()
);
