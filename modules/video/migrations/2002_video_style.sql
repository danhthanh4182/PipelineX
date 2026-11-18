-- PipelineX: the video's style (modules/video/backend/styles.ts); null until the pipeline chooses one.
ALTER TABLE video_jobs ADD COLUMN IF NOT EXISTS style text;
