-- AlterTable
ALTER TABLE "platform_settings" ADD COLUMN     "restore_test_passed_at" TIMESTAMPTZ(6);

-- CreateTable
CREATE TABLE "backup_runs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "started_by_id" UUID,
    "object_key" TEXT,
    "size_bytes" BIGINT,
    "failure" TEXT,
    "started_at" TIMESTAMPTZ(6),
    "finished_at" TIMESTAMPTZ(6),
    "file_deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "backup_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "backup_runs_created_at_idx" ON "backup_runs"("created_at");

-- =====================================================================
-- Database backups (admin A13). No store_id: a backup run belongs to the
-- platform, so there is no row-level security to add. The app user can't
-- read or change the table at all; only SystemDb (the worker and the admin)
-- touches it.
-- =====================================================================

ALTER TABLE backup_runs
  ADD CONSTRAINT backup_runs_kind_known CHECK (kind IN ('nightly', 'manual')),
  ADD CONSTRAINT backup_runs_status_known CHECK (status IN ('queued', 'running', 'done', 'failed')),
  ADD CONSTRAINT backup_runs_failure_known CHECK (failure IS NULL OR failure IN ('dump_failed', 'storage_unreachable', 'interrupted')),
  -- A manual backup always names the admin who started it; a nightly one never does.
  ADD CONSTRAINT backup_runs_started_by CHECK ((kind = 'manual') = (started_by_id IS NOT NULL)),
  -- A finished run says how it ended: a file and its size, or a reason.
  ADD CONSTRAINT backup_runs_done_has_file CHECK (status <> 'done' OR (object_key IS NOT NULL AND size_bytes IS NOT NULL AND finished_at IS NOT NULL)),
  ADD CONSTRAINT backup_runs_failed_has_reason CHECK ((status = 'failed') = (failure IS NOT NULL));

-- One backup at a time: a second "Backup now", or the nightly run while a
-- manual one is going, is refused by the database itself.
CREATE UNIQUE INDEX backup_runs_one_at_a_time ON backup_runs ((true)) WHERE status IN ('queued', 'running');

REVOKE ALL ON backup_runs FROM khmer_micro_store_app;
