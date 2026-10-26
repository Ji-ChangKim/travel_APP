-- 영수증 내용 확정과 같은 트랜잭션에 원본 정리 대상을 남긴다.
CREATE TABLE receipt_cleanup_jobs (
  path TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  attempted_at INTEGER,
  completed_at INTEGER,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts >= 0)
);
CREATE INDEX receipt_cleanup_pending ON receipt_cleanup_jobs(completed_at, attempted_at);

-- 이전 버전의 미보관 원본은 업로드 삭제 표식과 서버 확정 결과가 모두 일치할 때만 재시도한다.
INSERT OR IGNORE INTO receipt_cleanup_jobs(path, trip_id, created_at)
SELECT u.path, u.trip_id, min(m.created_at)
FROM uploads u JOIN mutation_requests m
  ON json_extract(m.result, '$.discardedReceiptPath') = u.path
  AND json_extract(m.result, '$.tripId') = u.trip_id
WHERE u.deleted_at IS NOT NULL
GROUP BY u.path, u.trip_id;
