-- 기존 중복 이름의 첫 계정은 유지하고 나머지는 UUID가 붙은 이름으로 구분한다.
-- 고유 인덱스 생성에 실패하면 전체 마이그레이션을 롤백하여 중복을 허용하지 않는다.
UPDATE user SET name=substr(trim(name),1,12)||'-'||replace(id,'-',''),updatedAt=unixepoch()*1000
WHERE id IN (SELECT id FROM (SELECT id,row_number() OVER (PARTITION BY lower(trim(name)) ORDER BY createdAt,id) AS ordinal FROM user) WHERE ordinal>1);
UPDATE user SET name=trim(name);
CREATE UNIQUE INDEX user_nickname_unique ON user(lower(trim(name)));
-- 중복 정리로 바뀐 표시 이름을 기존 공개 기록에도 반영한다.
UPDATE posts SET snapshot=json_set(snapshot,'$.author',(SELECT name FROM user WHERE id=posts.author_id));
-- 여행 안의 모든 멤버 이름을 실제 계정 이름과 맞추고 버전도 함께 갱신한다.
UPDATE trips SET snapshot=json_set(snapshot,'$.trip.version',version+1,'$.members',json((SELECT json_group_array(json(json_set(value,'$.nickname',coalesce((SELECT name FROM user WHERE id=json_extract(value,'$.userId')),json_extract(value,'$.nickname'))))) FROM json_each(trips.snapshot,'$.members')))),version=version+1;
