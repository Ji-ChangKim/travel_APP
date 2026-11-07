-- 읽기 전용. 0014 적용 전 환경·백업·실제 마이그레이션 적용 상태를 먼저 확인한다.
-- 개인 이메일·sub·토큰·사진·여행 본문을 출력하지 않는다.
SELECT providerId, count(*) AS linked_accounts FROM account GROUP BY providerId;
SELECT count(*) AS anonymous_accounts FROM user WHERE isAnonymous=1;
SELECT count(*) AS users_with_multiple_google_links FROM (
  SELECT userId FROM account WHERE providerId='google' GROUP BY userId HAVING count(*)>1
);
SELECT count(*) AS shared_owned_trips FROM trips t WHERE EXISTS (
  SELECT 1 FROM trip_members m WHERE m.trip_id=t.id AND m.user_id<>t.owner_id
);
SELECT count(*) AS orphan_uploads FROM uploads u WHERE NOT EXISTS (
  SELECT 1 FROM user WHERE id=u.actor_id
) OR NOT EXISTS (SELECT 1 FROM trips WHERE id=u.trip_id);
SELECT count(*) AS legacy_retirement_requests FROM account_retirements;
