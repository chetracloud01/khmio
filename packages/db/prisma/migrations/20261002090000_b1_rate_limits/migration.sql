-- CreateTable
CREATE TABLE "rate_limit_hits" (
    "bucket" TEXT NOT NULL,
    "window_start" TIMESTAMPTZ(6) NOT NULL,
    "hits" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "rate_limit_hits_pkey" PRIMARY KEY ("bucket","window_start")
);

-- CreateIndex
CREATE INDEX "rate_limit_hits_window_start_idx" ON "rate_limit_hits"("window_start");

-- =====================================================================
-- Rate limits (go-live step B1). No store_id: the counters belong to the
-- platform, not a shop. The app user can't read or change the table; it
-- can only count one hit through app_rate_limit_hit(), which answers with
-- the hits so far in this window.
-- =====================================================================

ALTER TABLE rate_limit_hits ADD CONSTRAINT rate_limit_hits_bucket_short CHECK (length(bucket) BETWEEN 1 AND 100);
REVOKE ALL ON rate_limit_hits FROM khmer_micro_store_app;

CREATE FUNCTION app_rate_limit_hit(bucket_key text, window_seconds integer) RETURNS integer
  LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public
  AS $$
    INSERT INTO rate_limit_hits AS r (bucket, window_start, hits)
    VALUES (
      bucket_key,
      to_timestamp(floor(extract(epoch FROM now()) / greatest(1, least(window_seconds, 86400))) * greatest(1, least(window_seconds, 86400))),
      1
    )
    ON CONFLICT (bucket, window_start) DO UPDATE SET hits = r.hits + 1
    RETURNING hits
  $$;
REVOKE ALL ON FUNCTION app_rate_limit_hit(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_rate_limit_hit(text, integer) TO khmer_micro_store_app;
