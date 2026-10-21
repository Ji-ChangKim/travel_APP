-- 장소 조회의 기존 집계는 유지하고 추천·경로의 유료 호출만 별도 제한한다.
CREATE TABLE IF NOT EXISTS planning_provider_usage (
  month TEXT NOT NULL,
  operation TEXT NOT NULL CHECK(operation IN ('route','recommendation')),
  hits INTEGER NOT NULL CHECK(hits > 0),
  PRIMARY KEY(month, operation)
);
