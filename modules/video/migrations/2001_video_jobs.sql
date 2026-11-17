-- PipelineX: one row per video made from a story; its files live in .data/videos/<id>/.
CREATE TABLE video_jobs (
  id           bigserial PRIMARY KEY,
  story_id     bigint REFERENCES stories (id) ON DELETE SET NULL,
  title        text NOT NULL,
  status       text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'ready', 'failed', 'approved', 'rejected')),
  step         text,
  error        text,
  result       jsonb NOT NULL DEFAULT '{}'::jsonb,
  cost         numeric(10,4) NOT NULL DEFAULT 0,
  duration_s   numeric(8,1),
  created_by   text NOT NULL DEFAULT 'auto',
  created_at   timestamptz NOT NULL DEFAULT now(),
  started_at   timestamptz,
  finished_at  timestamptz,
  updated_at   timestamptz NOT NULL DEFAULT now()
);
