-- 기존 생성 검증은 그대로 유지하면서 선택 항공편을 같은 원자 명령으로 저장한다.
ALTER FUNCTION wherego_private.validate_trip(JSONB) RENAME TO validate_trip_base;
CREATE FUNCTION wherego_private.validate_trip(p_input JSONB) RETURNS JSONB LANGUAGE SQL STABLE SET search_path='' AS $$
  -- RPC 직접 호출에서도 편명·공항·시각과 알 수 없는 속성을 거부한다.
  SELECT CASE WHEN wherego_private.validate_trip_base(p_input-'flight') IS NOT NULL AND
    (NOT p_input ? 'flight' OR (
      jsonb_typeof(p_input->'flight')='object'
      AND ((p_input->'flight')-ARRAY['number','departure','arrival','time'])='{}'::jsonb
      AND jsonb_typeof(p_input->'flight'->'number')='string'
      AND jsonb_typeof(p_input->'flight'->'departure')='string'
      AND jsonb_typeof(p_input->'flight'->'arrival')='string'
      AND jsonb_typeof(p_input->'flight'->'time')='string'
      AND p_input->'flight'->>'number' ~ '^[A-Z0-9]{2,3}[0-9]{1,4}[A-Z]?$'
      AND p_input->'flight'->>'departure' ~ '^[A-Z]{3}$'
      AND p_input->'flight'->>'arrival' ~ '^[A-Z]{3}$'
      AND p_input->'flight'->>'departure'<>p_input->'flight'->>'arrival'
      AND (p_input->'flight'->>'time'='' OR p_input->'flight'->>'time' ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
    )) THEN p_input ELSE wherego_private.fail('VALIDATION_FAILED') END;
$$;
ALTER FUNCTION wherego_private.insert_trip(JSONB) RENAME TO insert_trip_base;
CREATE FUNCTION wherego_private.insert_trip(p_input JSONB) RETURNS JSONB LANGUAGE SQL SECURITY DEFINER SET search_path='' AS $$
  -- 여행·DAY·항공편은 함께 성공하거나 함께 취소되며 같은 생성 키는 한 번만 저장한다.
  WITH created AS MATERIALIZED (SELECT wherego_private.insert_trip_base(p_input-'flight') AS data),
  flight AS MATERIALIZED (
    SELECT wherego_private.schedule_save((data->'trip'->>'id')::uuid,jsonb_build_object(
      'id',pg_catalog.gen_random_uuid(),'dayId',data->'days'->0->>'id',
      'title',(p_input->'flight'->>'number')||' · '||(p_input->'flight'->>'departure')||' → '||(p_input->'flight'->>'arrival'),
      'type','TRANSPORT','timeSlot',p_input->'flight'->>'time','sortOrder',1,
      'memo','사용자가 등록한 항공편입니다. 운항 정보 자동 조회·예약 확인은 수행하지 않았습니다.',
      'address',(p_input->'flight'->>'departure')||' → '||(p_input->'flight'->>'arrival'))) AS saved
    FROM created WHERE p_input ? 'flight'
  ) SELECT data FROM created LEFT JOIN flight ON flight.saved IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION wherego_private.validate_trip_base(JSONB),wherego_private.validate_trip(JSONB),wherego_private.insert_trip_base(JSONB),wherego_private.insert_trip(JSONB) FROM PUBLIC,anon,authenticated;
