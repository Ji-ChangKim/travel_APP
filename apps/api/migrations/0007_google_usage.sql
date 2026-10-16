-- 공급자 콘텐츠 없이 월별 실제 호출 예약 횟수만 원자적으로 집계한다.
CREATE TABLE google_api_usage (
  month TEXT NOT NULL,
  operation TEXT NOT NULL CHECK(operation IN ('text-search','place-details','place-photo')),
  hits INTEGER NOT NULL CHECK(hits > 0),
  PRIMARY KEY(month, operation)
);
