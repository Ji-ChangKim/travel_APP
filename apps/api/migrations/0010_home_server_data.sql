-- 개인 작성 계획과 발행된 여행 팁은 서버 DB를 원본으로 사용한다.
CREATE TABLE plan_drafts (
 owner_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
 id TEXT NOT NULL,
 payload TEXT NOT NULL CHECK(json_valid(payload) AND length(payload)<=100000),
 revision INTEGER NOT NULL CHECK(revision>0),
 saved_at INTEGER NOT NULL,
 PRIMARY KEY(owner_id,id)
);
CREATE INDEX plan_drafts_recent ON plan_drafts(owner_id,saved_at DESC);
CREATE TABLE travel_tips (
 id TEXT NOT NULL,
 locale TEXT NOT NULL CHECK(locale IN ('ko','en','ja')),
 body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 500),
 published INTEGER NOT NULL DEFAULT 0 CHECK(published IN (0,1)),
 starts_at INTEGER,
 ends_at INTEGER,
 PRIMARY KEY(id,locale),
 CHECK(starts_at IS NULL OR ends_at IS NULL OR starts_at<ends_at)
);
-- 예시 여행·초안·팁을 삽입하지 않는다. 발행된 콘텐츠가 없으면 빈 목록을 반환한다.
