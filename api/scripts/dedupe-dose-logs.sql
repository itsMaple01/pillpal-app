-- One-time manual cleanup: remove duplicate dose_logs rows for the same schedule + day.
-- Run Step 1 first and review the output before uncommenting Step 2.
--
-- Step 1 — inspect duplicate groups:
SELECT
  schedule_id,
  log_date,
  COUNT(*) AS row_count,
  array_agg(id ORDER BY
    CASE WHEN status = 'taken' THEN 0 WHEN status = 'pending' THEN 1 ELSE 2 END,
    taken_at DESC NULLS LAST,
    id DESC
  ) AS ids,
  array_agg(status ORDER BY
    CASE WHEN status = 'taken' THEN 0 WHEN status = 'pending' THEN 1 ELSE 2 END,
    taken_at DESC NULLS LAST,
    id DESC
  ) AS statuses
FROM dose_logs
WHERE log_date IS NOT NULL
GROUP BY schedule_id, log_date
HAVING COUNT(*) > 1
ORDER BY row_count DESC;

-- Step 2 — delete duplicates, keeping the best row per (schedule_id, log_date):
-- WITH ranked AS (
--   SELECT id,
--          ROW_NUMBER() OVER (
--            PARTITION BY schedule_id, log_date
--            ORDER BY
--              CASE WHEN status = 'taken' THEN 0 WHEN status = 'pending' THEN 1 ELSE 2 END,
--              taken_at DESC NULLS LAST,
--              id DESC
--          ) AS rn
--   FROM dose_logs
--   WHERE log_date IS NOT NULL
-- )
-- DELETE FROM dose_logs
-- WHERE id IN (SELECT id FROM ranked WHERE rn > 1);
