-- 각 SQL 함수는 하나의 검증·조회·저장 명령만 담당한다. 공개 RPC는 하나의 원자적 트랜잭션이다.
CREATE FUNCTION wherego_private.require_actor() RETURNS UUID LANGUAGE SQL STABLE SET search_path='' AS $$
  -- 익명 체험 계정은 실제 사용자 명령을 실행하지 못하게 한다.
  SELECT CASE WHEN auth.uid() IS NOT NULL AND coalesce(auth.jwt()->>'is_anonymous','false')='false'
    THEN auth.uid() ELSE (wherego_private.fail('AUTH_REQUIRED')::text)::uuid END;
$$;

CREATE FUNCTION wherego_private.require_write(p_trip UUID) RETURNS UUID LANGUAGE SQL STABLE SECURITY DEFINER SET search_path='' AS $$
  -- 멤버 역할과 보관 상태를 서버에서 검사한다.
  SELECT CASE
    WHEN wherego_private.require_actor() IS NULL THEN NULL
    WHEN wherego_private.member_role(p_trip) IS NULL THEN (wherego_private.fail('RESOURCE_NOT_FOUND')::text)::uuid
    WHEN wherego_private.member_role(p_trip) NOT IN ('owner','editor') THEN (wherego_private.fail('ROLE_FORBIDDEN')::text)::uuid
    WHEN EXISTS (SELECT 1 FROM public.trips WHERE id=p_trip AND status='ARCHIVED') THEN (wherego_private.fail('TRIP_ARCHIVED')::text)::uuid
    ELSE p_trip END;
$$;

CREATE FUNCTION wherego_private.trip_json(p_trip public.trips) RETURNS JSONB LANGUAGE SQL IMMUTABLE SET search_path='' AS $$
  -- 내부 행을 공개 여행 계약에 맞게 변환한다.
  SELECT jsonb_build_object('id',p_trip.id,'ownerId',p_trip.user_id,'title',p_trip.title,'country',p_trip.country,'city',p_trip.city,'startDate',p_trip.start_date,'endDate',p_trip.end_date,'timezone',p_trip.timezone,'defaultCurrency',p_trip.default_currency,'coverColor',p_trip.cover_color,'status',p_trip.status,'version',p_trip.version);
$$;

CREATE FUNCTION wherego_private.validate_trip(p_input JSONB) RETURNS JSONB LANGUAGE SQL STABLE SET search_path='' AS $$
  -- RPC 직접 호출에도 동일한 입력 제약을 적용한다.
  SELECT CASE WHEN jsonb_typeof(p_input)='object'
    AND (p_input - ARRAY['title','country','city','startDate','endDate','timezone','defaultCurrency','coverColor'])='{}'::jsonb
    AND jsonb_typeof(p_input->'country')='string' AND jsonb_typeof(p_input->'city')='string'
    AND jsonb_typeof(p_input->'startDate')='string' AND jsonb_typeof(p_input->'endDate')='string'
    AND jsonb_typeof(p_input->'timezone')='string'
    AND (NOT p_input ? 'title' OR jsonb_typeof(p_input->'title')='string')
    AND (NOT p_input ? 'defaultCurrency' OR jsonb_typeof(p_input->'defaultCurrency')='string')
    AND (NOT p_input ? 'coverColor' OR jsonb_typeof(p_input->'coverColor')='string')
    AND length(btrim(p_input->>'country')) BETWEEN 1 AND 50 AND length(btrim(p_input->>'city')) BETWEEN 1 AND 50
    AND coalesce(length(btrim(p_input->>'title')),0)<=50
    AND p_input->>'startDate' ~ '^\d{4}-\d{2}-\d{2}$' AND p_input->>'endDate' ~ '^\d{4}-\d{2}-\d{2}$'
    AND (p_input->>'endDate')::date - (p_input->>'startDate')::date BETWEEN 0 AND 89
    AND EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name=p_input->>'timezone')
    AND coalesce(p_input->>'defaultCurrency','KRW') IN ('KRW','JPY','USD')
    AND coalesce(p_input->>'coverColor','#246A54') ~ '^#[0-9A-Fa-f]{6}$'
  THEN p_input ELSE wherego_private.fail('VALIDATION_FAILED') END;
$$;

CREATE FUNCTION wherego_private.claim_mutation(p_key UUID,p_operation TEXT,p_input JSONB) RETURNS JSONB LANGUAGE SQL SECURITY DEFINER SET search_path='' AS $$
  -- 같은 사용자와 키의 행을 잠가 최초 요청 내용을 유지한다.
  INSERT INTO public.mutation_requests AS existing(principal_id,request_key,operation,request_hash)
  VALUES (wherego_private.require_actor(),p_key,p_operation,encode(sha256(convert_to(p_input::text,'UTF8')),'hex'))
  ON CONFLICT (principal_id,request_key) DO UPDATE SET request_key=existing.request_key
  RETURNING CASE WHEN expires_at<=NOW() THEN wherego_private.fail('REQUEST_KEY_EXPIRED')
    WHEN operation<>p_operation OR request_hash<>encode(sha256(convert_to(p_input::text,'UTF8')),'hex') THEN wherego_private.fail('REQUEST_KEY_REUSED')
    ELSE jsonb_build_object('id',id,'result',result,'replayed',result IS NOT NULL) END;
$$;

CREATE FUNCTION wherego_private.finish_mutation(p_claim JSONB,p_result JSONB) RETURNS JSONB LANGUAGE SQL SECURITY DEFINER SET search_path='' AS $$
  -- 확정 결과를 핵심 변경과 같은 트랜잭션에 저장한다.
  UPDATE public.mutation_requests SET result=coalesce(result,p_result)
  WHERE id=(p_claim->>'id')::uuid AND principal_id=wherego_private.require_actor()
  RETURNING jsonb_build_object('data',result,'replayed',(p_claim->>'replayed')::boolean);
$$;

CREATE FUNCTION wherego_private.insert_trip(p_input JSONB) RETURNS JSONB LANGUAGE SQL SECURITY DEFINER SET search_path='' AS $$
  -- 여행·owner·전체 DAY를 하나의 저장 명령으로 생성한다.
  WITH trip AS (
    INSERT INTO public.trips(user_id,title,country,city,start_date,end_date,timezone,default_currency,cover_color)
    VALUES (wherego_private.require_actor(),coalesce(nullif(btrim(p_input->>'title'),''),left(p_input->>'startDate',4)||' '||btrim(p_input->>'city')||' 여행'),btrim(p_input->>'country'),btrim(p_input->>'city'),(p_input->>'startDate')::date,(p_input->>'endDate')::date,p_input->>'timezone',coalesce(p_input->>'defaultCurrency','KRW'),coalesce(p_input->>'coverColor','#246A54'))
    RETURNING *
  ), member AS (
    INSERT INTO public.trip_members(trip_id,user_id,role) SELECT id,user_id,'owner' FROM trip RETURNING trip_id
  ), days AS (
    INSERT INTO public.trip_days(trip_id,day_number,trip_date)
    SELECT t.id,n+1,t.start_date+n FROM trip t JOIN member m ON m.trip_id=t.id CROSS JOIN LATERAL generate_series(0,t.end_date-t.start_date) n
    RETURNING id,day_number,trip_date
  ) SELECT jsonb_build_object('trip',wherego_private.trip_json(t),'myRole','owner','tripVersion',t.version,'days',(SELECT jsonb_agg(jsonb_build_object('id',id,'dayNumber',day_number,'tripDate',trip_date) ORDER BY day_number) FROM days)) FROM trip t;
$$;

CREATE FUNCTION wherego_private.apply_create(p_claim JSONB,p_input JSONB) RETURNS JSONB LANGUAGE SQL SECURITY DEFINER SET search_path='' AS $$
  -- 재시도는 기존 결과를 재생하고 새 요청만 여행을 생성한다.
  SELECT wherego_private.finish_mutation(p_claim,CASE WHEN p_claim->'result'<>'null'::jsonb THEN CASE WHEN wherego_private.member_role((p_claim->'result'->'trip'->>'id')::uuid) IS NOT NULL THEN p_claim->'result' ELSE wherego_private.fail('RESOURCE_NOT_FOUND') END ELSE wherego_private.insert_trip(p_input) END);
$$;

CREATE FUNCTION public.wherego_create_trip(p_input JSONB,p_key UUID) RETURNS JSONB LANGUAGE SQL SECURITY DEFINER SET search_path='' AS $$
  -- 검증된 여행 생성 명령을 원자적으로 실행한다.
  SELECT wherego_private.apply_create(wherego_private.claim_mutation(p_key,'trip.create',wherego_private.validate_trip(p_input)),p_input);
$$;

CREATE FUNCTION wherego_private.bump_trip(p_trip UUID,p_version BIGINT) RETURNS JSONB LANGUAGE SQL SECURITY DEFINER SET search_path='' AS $$
  -- 쓰기 권한과 예상 버전이 일치하는 여행의 버전만 증가시킨다.
  WITH changed AS (
    UPDATE public.trips SET version=version+1,updated_at=NOW()
    WHERE id=wherego_private.require_write(p_trip) AND version=p_version RETURNING id,version
  ) SELECT coalesce((SELECT jsonb_build_object('id',id,'version',version) FROM changed),wherego_private.fail('VERSION_CONFLICT'));
$$;

CREATE FUNCTION wherego_private.insert_checklist(p_trip UUID,p_title TEXT,p_version BIGINT) RETURNS JSONB LANGUAGE SQL SECURITY DEFINER SET search_path='' AS $$
  -- 여행 버전 변경과 준비물 추가를 같은 명령에서 처리한다.
  WITH changed AS MATERIALIZED (SELECT wherego_private.bump_trip(p_trip,p_version) AS trip), inserted AS (
    INSERT INTO public.checklists(trip_id,title,created_by,updated_by)
    SELECT p_trip,btrim(p_title),wherego_private.require_actor(),wherego_private.require_actor() FROM changed
    RETURNING id,title,is_completed
  ) SELECT jsonb_build_object('id',i.id,'title',i.title,'isCompleted',i.is_completed,'tripVersion',(c.trip->>'version')::bigint) FROM inserted i CROSS JOIN changed c;
$$;

CREATE FUNCTION wherego_private.apply_checklist(p_claim JSONB,p_trip UUID,p_title TEXT,p_version BIGINT) RETURNS JSONB LANGUAGE SQL SECURITY DEFINER SET search_path='' AS $$
  -- 권한 철회 여부를 다시 확인한 후 추가 결과를 저장 또는 재생한다.
  SELECT CASE WHEN wherego_private.require_write(p_trip) IS NOT NULL THEN
    wherego_private.finish_mutation(p_claim,CASE WHEN p_claim->'result'<>'null'::jsonb THEN p_claim->'result' ELSE wherego_private.insert_checklist(p_trip,p_title,p_version) END) END;
$$;

CREATE FUNCTION public.wherego_add_checklist(p_trip UUID,p_title TEXT,p_version BIGINT,p_key UUID) RETURNS JSONB LANGUAGE SQL SECURITY DEFINER SET search_path='' AS $$
  -- 사용자·키·본문을 묶은 준비물 추가 명령을 실행한다.
  SELECT wherego_private.apply_checklist(wherego_private.claim_mutation(p_key,'checklist.add',jsonb_build_object('tripId',p_trip,'title',p_title,'version',p_version)),p_trip,p_title,p_version);
$$;

CREATE FUNCTION wherego_private.checklist_trip(p_item UUID) RETURNS UUID LANGUAGE SQL STABLE SECURITY DEFINER SET search_path='' AS $$
  -- 서버의 실제 항목 부모를 찾아 client의 여행 위조를 막는다.
  SELECT coalesce((SELECT trip_id FROM public.checklists WHERE id=p_item),(wherego_private.fail('RESOURCE_NOT_FOUND')::text)::uuid);
$$;

CREATE FUNCTION wherego_private.update_checklist(p_item UUID,p_completed BOOLEAN,p_version BIGINT) RETURNS JSONB LANGUAGE SQL SECURITY DEFINER SET search_path='' AS $$
  -- 버전 증가와 원하는 완료 상태 저장을 원자적으로 수행한다.
  WITH changed AS MATERIALIZED (SELECT wherego_private.bump_trip(wherego_private.checklist_trip(p_item),p_version) AS trip), updated AS (
    UPDATE public.checklists SET is_completed=p_completed,updated_by=wherego_private.require_actor(),updated_at=NOW()
    FROM changed WHERE id=p_item RETURNING id,title,is_completed
  ) SELECT jsonb_build_object('id',u.id,'title',u.title,'isCompleted',u.is_completed,'tripVersion',(c.trip->>'version')::bigint) FROM updated u CROSS JOIN changed c;
$$;

CREATE FUNCTION wherego_private.apply_checklist_state(p_claim JSONB,p_item UUID,p_completed BOOLEAN,p_version BIGINT) RETURNS JSONB LANGUAGE SQL SECURITY DEFINER SET search_path='' AS $$
  -- 재생 시에도 현재 멤버 권한을 검사해 이전 결과 노출을 막는다.
  SELECT CASE WHEN wherego_private.require_write(wherego_private.checklist_trip(p_item)) IS NOT NULL THEN
    wherego_private.finish_mutation(p_claim,CASE WHEN p_claim->'result'<>'null'::jsonb THEN p_claim->'result' ELSE wherego_private.update_checklist(p_item,p_completed,p_version) END) END;
$$;

CREATE FUNCTION public.wherego_set_checklist(p_item UUID,p_trip UUID,p_completed BOOLEAN,p_version BIGINT,p_key UUID) RETURNS JSONB LANGUAGE SQL SECURITY DEFINER SET search_path='' AS $$
  -- 토글 대신 명시적인 완료 상태 명령을 실행한다.
  SELECT CASE WHEN wherego_private.checklist_trip(p_item)=p_trip THEN wherego_private.apply_checklist_state(wherego_private.claim_mutation(p_key,'checklist.state',jsonb_build_object('itemId',p_item,'tripId',p_trip,'isCompleted',p_completed,'version',p_version)),p_item,p_completed,p_version) ELSE wherego_private.fail('VALIDATION_FAILED') END;
$$;

CREATE FUNCTION public.wherego_trip_snapshot(p_trip UUID) RETURNS JSONB LANGUAGE SQL STABLE SECURITY DEFINER SET search_path='' AS $$
  -- 동일한 읽기 시점의 여행·하위 데이터·최소 멤버 프로필을 반환한다.
  SELECT CASE WHEN wherego_private.require_actor() IS NOT NULL AND wherego_private.member_role(p_trip) IS NOT NULL THEN
    (SELECT jsonb_build_object(
      'trip',wherego_private.trip_json(t),'myRole',wherego_private.member_role(t.id),
      'days',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',d.id,'dayNumber',d.day_number,'tripDate',d.trip_date) ORDER BY d.day_number),'[]') FROM public.trip_days d WHERE d.trip_id=t.id),
      'itinerary',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',i.id,'dayId',i.trip_day_id,'type',i.type,'title',i.title,'placeId',i.place_id,'timeSlot',i.time_slot,'sortOrder',i.sort_order,'memo',i.memo) ORDER BY i.sort_order),'[]') FROM public.itinerary_items i JOIN public.trip_days d ON d.id=i.trip_day_id WHERE d.trip_id=t.id),
      'expenses',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',e.id,'title',e.title,'amount',e.amount::text,'currency',e.currency,'isActual',e.is_actual,'dayId',e.trip_day_id,'scheduleId',e.schedule_id,'category',e.category,'source',e.source)),'[]') FROM public.expenses e WHERE e.trip_id=t.id),
      'checklists',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',c.id,'title',c.title,'isCompleted',c.is_completed) ORDER BY c.created_at,c.id),'[]') FROM public.checklists c WHERE c.trip_id=t.id),
      'members',(SELECT coalesce(jsonb_agg(jsonb_build_object('memberId',m.id,'userId',m.user_id,'nickname',p.nickname,'role',m.role,'isMe',m.user_id=auth.uid())),'[]') FROM public.trip_members m JOIN public.profiles p ON p.id=m.user_id WHERE m.trip_id=t.id)
    ) FROM public.trips t WHERE t.id=p_trip) ELSE wherego_private.fail('RESOURCE_NOT_FOUND') END;
$$;

CREATE FUNCTION public.wherego_list_trips() RETURNS JSONB LANGUAGE SQL STABLE SECURITY DEFINER SET search_path='' AS $$
  -- M1 읽기 기반으로 현재 멤버의 여행만 반환한다.
  SELECT CASE WHEN wherego_private.require_actor() IS NOT NULL THEN
    coalesce((SELECT jsonb_agg(wherego_private.trip_json(t) ORDER BY t.start_date,t.id) FROM public.trips t WHERE wherego_private.member_role(t.id) IS NOT NULL),'[]'::jsonb) END;
$$;

CREATE FUNCTION public.wherego_me() RETURNS JSONB LANGUAGE SQL STABLE SECURITY DEFINER SET search_path='' AS $$
  -- 본인 프로필만 M1 계약으로 조회한다.
  SELECT coalesce((SELECT jsonb_build_object('id',id,'nickname',nickname,'bio',bio,'version',version) FROM public.profiles WHERE id=wherego_private.require_actor()),wherego_private.fail('RESOURCE_NOT_FOUND'));
$$;

-- 함수의 기본 PUBLIC 실행 권한을 제거하고 명시한 RPC만 실제 사용자에게 공개한다.
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA wherego_private FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION wherego_private.member_role(UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.wherego_create_trip(JSONB,UUID),public.wherego_add_checklist(UUID,TEXT,BIGINT,UUID),public.wherego_set_checklist(UUID,UUID,BOOLEAN,BIGINT,UUID),public.wherego_trip_snapshot(UUID),public.wherego_list_trips(),public.wherego_me() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.wherego_create_trip(JSONB,UUID),public.wherego_add_checklist(UUID,TEXT,BIGINT,UUID),public.wherego_set_checklist(UUID,UUID,BOOLEAN,BIGINT,UUID),public.wherego_trip_snapshot(UUID),public.wherego_list_trips(),public.wherego_me() TO authenticated;
