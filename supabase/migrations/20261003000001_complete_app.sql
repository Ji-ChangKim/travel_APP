-- 서버 여행을 일정·초대·사진·영수증·공개 게시의 단일 원본으로 확장한다.
ALTER TABLE public.itinerary_items ADD COLUMN address TEXT NOT NULL DEFAULT '' CHECK (length(address)<=200);
ALTER TABLE public.trips ADD CONSTRAINT trips_nonempty_labels CHECK(length(btrim(title)) BETWEEN 1 AND 100 AND length(btrim(country)) BETWEEN 1 AND 50 AND length(btrim(city)) BETWEEN 1 AND 50);
-- 기간 이동 중 날짜 충돌은 거래 종료 시 최종 상태로 검사한다.
ALTER TABLE public.trip_days DROP CONSTRAINT uq_trip_day, DROP CONSTRAINT trip_days_unique_date;
ALTER TABLE public.trip_days ADD CONSTRAINT uq_trip_day UNIQUE(trip_id,day_number) DEFERRABLE INITIALLY DEFERRED, ADD CONSTRAINT trip_days_unique_date UNIQUE(trip_id,trip_date) DEFERRABLE INITIALLY DEFERRED;
CREATE TABLE public.trip_media (
  id UUID PRIMARY KEY, trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  schedule_id UUID REFERENCES public.itinerary_items(id) ON DELETE RESTRICT,
  uploaded_by UUID NOT NULL REFERENCES public.profiles(id),
  path TEXT NOT NULL UNIQUE, purpose TEXT NOT NULL CHECK (purpose IN ('photo','receipt')),
  mime_type TEXT NOT NULL CHECK (mime_type IN ('image/jpeg','image/png')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png)$')
);
CREATE TABLE public.receipt_records (
  id UUID PRIMARY KEY, trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  schedule_id UUID NOT NULL REFERENCES public.itinerary_items(id) ON DELETE RESTRICT,
  media_id UUID NOT NULL UNIQUE REFERENCES public.trip_media(id) ON DELETE RESTRICT,
  expense_id UUID NOT NULL UNIQUE REFERENCES public.expenses(id) ON DELETE RESTRICT,
  merchant TEXT NOT NULL CHECK (length(btrim(merchant)) BETWEEN 1 AND 100),
  transaction_date DATE NOT NULL, total_amount NUMERIC(12,2) NOT NULL CHECK (total_amount>0),
  currency TEXT NOT NULL CHECK (currency IN ('KRW','JPY','USD')),
  details TEXT NOT NULL DEFAULT '' CHECK (length(details)<=1000),
  confirmed_by UUID NOT NULL REFERENCES public.profiles(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (currency='USD' OR total_amount=trunc(total_amount))
);
CREATE TABLE public.community_posts (
  id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(), trip_id UUID NOT NULL UNIQUE REFERENCES public.trips(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id),
  title TEXT NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 100),
  body TEXT NOT NULL CHECK (length(body)<=2000), snapshot JSONB NOT NULL,
  photo_ids UUID[] NOT NULL DEFAULT '{}', published BOOLEAN NOT NULL DEFAULT true,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.community_reports (
  post_id UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (length(btrim(reason)) BETWEEN 1 AND 500), created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(post_id,reporter_id)
);
CREATE TABLE public.community_blocks (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY(user_id,blocked_user_id), CHECK(user_id<>blocked_user_id)
);
ALTER TABLE public.trip_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipt_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY media_member_read ON public.trip_media FOR SELECT TO authenticated USING(wherego_private.member_role(trip_id) IS NOT NULL);
CREATE POLICY receipts_member_read ON public.receipt_records FOR SELECT TO authenticated USING(wherego_private.member_role(trip_id) IS NOT NULL);
CREATE POLICY community_public_read ON public.community_posts FOR SELECT TO anon,authenticated USING(published);
REVOKE ALL ON public.trip_media,public.receipt_records,public.community_posts,public.community_reports,public.community_blocks FROM anon,authenticated;
GRANT SELECT ON public.trip_media,public.receipt_records TO authenticated;
GRANT SELECT ON public.community_posts TO anon,authenticated;

-- 소유자만 여행 메타정보·멤버·공개 범위를 변경할 수 있다.
CREATE FUNCTION wherego_private.require_owner(p_trip UUID) RETURNS UUID LANGUAGE SQL SECURITY DEFINER SET search_path='' AS $$
  -- DB의 실제 역할을 기준으로 소유권을 확인한다.
  SELECT CASE WHEN wherego_private.require_write(p_trip) IS NOT NULL AND wherego_private.member_role(p_trip)='owner' THEN p_trip ELSE (wherego_private.fail('ROLE_FORBIDDEN')::text)::uuid END;
$$;
CREATE FUNCTION wherego_private.schedule_save(p_trip UUID,p_input JSONB) RETURNS JSONB LANGUAGE SQL SECURITY DEFINER SET search_path='' AS $$
  -- 실제 DAY 소속을 검사한 일정만 같은 UUID로 추가 또는 수정한다.
  WITH saved AS (
    INSERT INTO public.itinerary_items AS old(id,trip_day_id,title,type,time_slot,sort_order,memo,address,created_by,updated_by)
    SELECT (p_input->>'id')::uuid,d.id,btrim(p_input->>'title'),p_input->>'type',nullif(p_input->>'timeSlot',''),(p_input->>'sortOrder')::int,p_input->>'memo',p_input->>'address',wherego_private.require_actor(),wherego_private.require_actor()
    FROM public.trip_days d WHERE d.id=(p_input->>'dayId')::uuid AND d.trip_id=p_trip
    ON CONFLICT(id) DO UPDATE SET trip_day_id=excluded.trip_day_id,title=excluded.title,type=excluded.type,time_slot=excluded.time_slot,sort_order=excluded.sort_order,memo=excluded.memo,address=excluded.address,updated_by=excluded.updated_by,updated_at=now()
    WHERE EXISTS(SELECT 1 FROM public.trip_days d WHERE d.id=old.trip_day_id AND d.trip_id=p_trip)
      AND (old.trip_day_id=excluded.trip_day_id OR NOT EXISTS(SELECT 1 FROM public.expenses e WHERE e.schedule_id=old.id))
    RETURNING id
  ) SELECT coalesce((SELECT jsonb_build_object('id',id) FROM saved),wherego_private.fail('VALIDATION_FAILED'));
$$;
CREATE FUNCTION wherego_private.schedule_delete(p_trip UUID,p_input JSONB) RETURNS JSONB LANGUAGE SQL SECURITY DEFINER SET search_path='' AS $$
  -- 기록·사진·지출이 연결된 일정은 제약으로 보존한다.
  WITH removed AS (DELETE FROM public.itinerary_items i USING public.trip_days d WHERE i.id=(p_input->>'id')::uuid AND i.trip_day_id=d.id AND d.trip_id=p_trip RETURNING i.id)
  SELECT coalesce((SELECT jsonb_build_object('id',id) FROM removed),wherego_private.fail('RESOURCE_NOT_FOUND'));
$$;
CREATE FUNCTION wherego_private.expense_save(p_trip UUID,p_input JSONB) RETURNS JSONB LANGUAGE SQL SECURITY DEFINER SET search_path='' AS $$
  -- 금액은 decimal로 저장하고 부모·통화 제약을 그대로 적용한다.
  WITH saved AS (
    INSERT INTO public.expenses AS old(id,trip_id,trip_day_id,schedule_id,title,amount,currency,category,is_actual,source,created_by,updated_by)
    VALUES((p_input->>'id')::uuid,p_trip,nullif(p_input->>'dayId','')::uuid,nullif(p_input->>'scheduleId','')::uuid,btrim(p_input->>'title'),(p_input->>'amount')::numeric,p_input->>'currency',p_input->>'category',(p_input->>'isActual')::boolean,'manual',wherego_private.require_actor(),wherego_private.require_actor())
    ON CONFLICT(id) DO UPDATE SET title=excluded.title,amount=excluded.amount,currency=excluded.currency,category=excluded.category,is_actual=excluded.is_actual,trip_day_id=excluded.trip_day_id,schedule_id=excluded.schedule_id,updated_by=excluded.updated_by,updated_at=now()
    WHERE old.trip_id=p_trip AND old.source='manual' RETURNING id
  ) SELECT coalesce((SELECT jsonb_build_object('id',id) FROM saved),wherego_private.fail('VALIDATION_FAILED'));
$$;
CREATE FUNCTION wherego_private.expense_delete(p_trip UUID,p_input JSONB) RETURNS JSONB LANGUAGE SQL SECURITY DEFINER SET search_path='' AS $$
  -- 영수증 지출은 영수증 삭제 명령에서만 함께 제거한다.
  WITH removed AS(DELETE FROM public.expenses WHERE id=(p_input->>'id')::uuid AND trip_id=p_trip AND source='manual' RETURNING id)
  SELECT coalesce((SELECT jsonb_build_object('id',id) FROM removed),wherego_private.fail('RESOURCE_NOT_FOUND'));
$$;
CREATE FUNCTION wherego_private.trip_update(p_trip UUID,p_input JSONB) RETURNS JSONB LANGUAGE SQL SECURITY DEFINER SET search_path='' AS $$
  -- 여행 종료와 지역·제목 변경을 명시적 소유자 명령으로 저장한다.
  WITH saved AS(UPDATE public.trips SET title=btrim(p_input->>'title'),country=btrim(p_input->>'country'),city=btrim(p_input->>'city'),status=(p_input->>'status')::public.trip_status WHERE id=p_trip RETURNING id)
  SELECT jsonb_build_object('id',id) FROM saved;
$$;
CREATE FUNCTION wherego_private.trip_period(p_trip UUID,p_input JSONB) RETURNS JSONB LANGUAGE SQL SECURITY DEFINER SET search_path='' AS $$
  -- DAY 순서·식별자를 보존해 날짜를 이동하고 기록이 있는 마지막 DAY 축소는 거부한다.
  WITH bounds AS MATERIALIZED(SELECT (p_input->>'startDate')::date first,(p_input->>'endDate')::date last), valid AS MATERIALIZED(
    SELECT first,last FROM bounds WHERE last-first BETWEEN 0 AND 89 AND NOT EXISTS(SELECT 1 FROM public.receipt_records WHERE trip_id=p_trip AND transaction_date NOT BETWEEN first AND last) AND NOT EXISTS(
      SELECT 1 FROM public.trip_days d WHERE d.trip_id=p_trip AND d.day_number>last-first+1 AND
       (EXISTS(SELECT 1 FROM public.itinerary_items WHERE trip_day_id=d.id) OR EXISTS(SELECT 1 FROM public.expenses WHERE trip_day_id=d.id))
    )
  ), saved AS(UPDATE public.trips t SET start_date=v.first,end_date=v.last FROM valid v WHERE t.id=p_trip RETURNING t.id,t.start_date,t.end_date),
  removed AS(DELETE FROM public.trip_days d USING saved s WHERE d.trip_id=s.id AND d.day_number>s.end_date-s.start_date+1 RETURNING d.id),
  moved AS(UPDATE public.trip_days d SET trip_date=s.start_date+d.day_number-1,updated_at=now() FROM saved s WHERE d.trip_id=s.id AND d.day_number<=s.end_date-s.start_date+1 RETURNING d.id),
  added AS(INSERT INTO public.trip_days(trip_id,day_number,trip_date) SELECT s.id,n,s.start_date+n-1 FROM saved s CROSS JOIN LATERAL generate_series(1,s.end_date-s.start_date+1) n WHERE NOT EXISTS(SELECT 1 FROM public.trip_days WHERE trip_id=s.id AND day_number=n) RETURNING id)
  SELECT coalesce((SELECT jsonb_build_object('id',id) FROM saved),wherego_private.fail('VALIDATION_FAILED'));
$$;
CREATE FUNCTION wherego_private.media_register(p_trip UUID,p_input JSONB) RETURNS JSONB LANGUAGE SQL SECURITY DEFINER SET search_path='' AS $$
  -- 업로드 완료된 자기 여행 파일과 일정만 메타데이터로 확정한다.
  WITH saved AS(
    INSERT INTO public.trip_media(id,trip_id,schedule_id,uploaded_by,path,purpose,mime_type)
    SELECT (p_input->>'id')::uuid,p_trip,nullif(p_input->>'scheduleId','')::uuid,wherego_private.require_actor(),p_input->>'path',p_input->>'purpose',p_input->>'mimeType'
    WHERE split_part(p_input->>'path','/',1)=p_trip::text AND split_part(split_part(p_input->>'path','/',2),'.',1)=p_input->>'id'
      AND EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='trip-private' AND name=p_input->>'path')
      AND (nullif(p_input->>'scheduleId','') IS NULL OR EXISTS(SELECT 1 FROM public.itinerary_items i JOIN public.trip_days d ON i.trip_day_id=d.id WHERE i.id=(p_input->>'scheduleId')::uuid AND d.trip_id=p_trip))
    RETURNING id
  ) SELECT coalesce((SELECT jsonb_build_object('id',id) FROM saved),wherego_private.fail('VALIDATION_FAILED'));
$$;
CREATE FUNCTION wherego_private.media_delete(p_trip UUID,p_input JSONB) RETURNS JSONB LANGUAGE SQL SECURITY DEFINER SET search_path='' AS $$
  -- 공개 중 사진과 영수증 원본은 참조를 해제하기 전 제거하지 않는다.
  WITH removed AS(DELETE FROM public.trip_media m WHERE id=(p_input->>'id')::uuid AND trip_id=p_trip AND NOT EXISTS(SELECT 1 FROM public.community_posts p WHERE p.published AND m.id=ANY(p.photo_ids)) RETURNING id,path)
  SELECT coalesce((SELECT jsonb_build_object('id',id,'path',path) FROM removed),wherego_private.fail('VALIDATION_FAILED'));
$$;
CREATE FUNCTION wherego_private.receipt_confirm(p_trip UUID,p_input JSONB) RETURNS JSONB LANGUAGE SQL SECURITY DEFINER SET search_path='' AS $$
  -- 확인값·실제 지출·필요한 신규 일정을 하나의 트랜잭션에 연결한다.
  WITH target AS MATERIALIZED(
    SELECT coalesce(nullif(p_input->>'scheduleId','')::uuid,pg_catalog.gen_random_uuid()) id,d.id day_id
    FROM public.trip_days d JOIN public.trips t ON t.id=d.trip_id JOIN public.trip_media m ON m.trip_id=t.id
    WHERE d.id=(p_input->>'dayId')::uuid AND t.id=p_trip AND m.id=(p_input->>'mediaId')::uuid AND m.purpose='receipt'
    AND (p_input->>'transactionDate')::date BETWEEN t.start_date AND t.end_date
    AND (nullif(p_input->>'scheduleId','') IS NULL OR EXISTS(SELECT 1 FROM public.itinerary_items i WHERE i.id=(p_input->>'scheduleId')::uuid AND i.trip_day_id=d.id))
  ), new_schedule AS(
    INSERT INTO public.itinerary_items(id,trip_day_id,title,type,sort_order,memo,address,created_by,updated_by)
    SELECT id,day_id,btrim(p_input->>'merchant'),'PLACE',1,'영수증에서 추가한 기록','',wherego_private.require_actor(),wherego_private.require_actor() FROM target WHERE nullif(p_input->>'scheduleId','') IS NULL RETURNING id
  ), cost AS(
    INSERT INTO public.expenses(id,trip_id,trip_day_id,schedule_id,title,amount,currency,category,is_actual,source,created_by,updated_by)
    SELECT (p_input->>'id')::uuid,p_trip,day_id,id,btrim(p_input->>'merchant'),(p_input->>'amount')::numeric,p_input->>'currency','etc',true,'receipt',wherego_private.require_actor(),wherego_private.require_actor() FROM target
    WHERE nullif(p_input->>'scheduleId','') IS NOT NULL OR EXISTS(SELECT 1 FROM new_schedule) RETURNING id
  ), saved AS(
    INSERT INTO public.receipt_records(id,trip_id,schedule_id,media_id,expense_id,merchant,transaction_date,total_amount,currency,details,confirmed_by)
    SELECT c.id,p_trip,t.id,(p_input->>'mediaId')::uuid,c.id,btrim(p_input->>'merchant'),(p_input->>'transactionDate')::date,(p_input->>'amount')::numeric,p_input->>'currency',p_input->>'details',wherego_private.require_actor() FROM cost c CROSS JOIN target t RETURNING id
  ) SELECT coalesce((SELECT jsonb_build_object('id',id) FROM saved),wherego_private.fail('VALIDATION_FAILED'));
$$;
CREATE FUNCTION wherego_private.receipt_delete(p_trip UUID,p_input JSONB) RETURNS JSONB LANGUAGE SQL SECURITY DEFINER SET search_path='' AS $$
  -- 영수증 확인 기록과 해당 지출을 함께 제거하고 원본은 사진 관리에 남긴다.
  WITH removed AS(DELETE FROM public.receipt_records WHERE id=(p_input->>'id')::uuid AND trip_id=p_trip RETURNING id,expense_id), cost AS(DELETE FROM public.expenses WHERE id IN(SELECT expense_id FROM removed) RETURNING id)
  SELECT coalesce((SELECT jsonb_build_object('id',id) FROM removed WHERE EXISTS(SELECT 1 FROM cost)),wherego_private.fail('RESOURCE_NOT_FOUND'));
$$;
CREATE FUNCTION wherego_private.invite_create(p_trip UUID,p_input JSONB) RETURNS JSONB LANGUAGE SQL SECURITY DEFINER SET search_path='' AS $$
  -- 두 개의 보안 UUID를 조합한 토큰의 해시만 초대 테이블에 저장한다.
  WITH token AS MATERIALIZED(SELECT replace(pg_catalog.gen_random_uuid()::text||pg_catalog.gen_random_uuid()::text,'-','') value), saved AS(
    INSERT INTO public.trip_invites(trip_id,token_hash,role,created_by,expires_at)
    SELECT p_trip,encode(sha256(convert_to(value,'UTF8')),'hex'),(p_input->>'role')::public.member_role,wherego_private.require_actor(),now()+interval '7 days' FROM token RETURNING id,expires_at
  ) SELECT jsonb_build_object('id',s.id,'token',t.value,'expiresAt',s.expires_at) FROM saved s CROSS JOIN token t;
$$;
CREATE FUNCTION wherego_private.invite_revoke(p_trip UUID,p_input JSONB) RETURNS JSONB LANGUAGE SQL SECURITY DEFINER SET search_path='' AS $$
  -- 소유 여행의 초대만 철회한다.
  WITH changed AS(UPDATE public.trip_invites SET revoked_at=now() WHERE id=(p_input->>'id')::uuid AND trip_id=p_trip RETURNING id)
  SELECT coalesce((SELECT jsonb_build_object('id',id) FROM changed),wherego_private.fail('RESOURCE_NOT_FOUND'));
$$;
CREATE FUNCTION wherego_private.member_change(p_trip UUID,p_input JSONB,p_remove BOOLEAN) RETURNS JSONB LANGUAGE SQL SECURITY DEFINER SET search_path='' AS $$
  -- owner를 제외한 실제 여행 멤버만 역할 변경 또는 제거한다.
  WITH changed AS(UPDATE public.trip_members SET role=(p_input->>'role')::public.member_role,updated_at=now() WHERE trip_id=p_trip AND user_id=(p_input->>'userId')::uuid AND role<>'owner' AND NOT p_remove RETURNING id), removed AS(DELETE FROM public.trip_members WHERE trip_id=p_trip AND user_id=(p_input->>'userId')::uuid AND role<>'owner' AND p_remove RETURNING id,user_id), revoked AS(UPDATE public.trip_invites SET revoked_at=now() WHERE trip_id=p_trip AND accepted_by IN(SELECT user_id FROM removed) RETURNING id)
  SELECT coalesce((SELECT jsonb_build_object('id',id) FROM changed UNION ALL SELECT jsonb_build_object('id',id) FROM removed),wherego_private.fail('VALIDATION_FAILED'));
$$;
CREATE FUNCTION wherego_private.community_publish(p_trip UUID,p_input JSONB) RETURNS JSONB LANGUAGE SQL SECURITY DEFINER SET search_path='' AS $$
  -- 공개할 일정·사진·통화 합계만 별도 스냅샷으로 게시한다.
  WITH selected_photos AS MATERIALIZED(SELECT array_agg(value::uuid) ids FROM jsonb_array_elements_text(p_input->'photoIds')),
  saved AS(
    INSERT INTO public.community_posts(trip_id,author_id,title,body,photo_ids,snapshot)
    SELECT t.id,wherego_private.require_actor(),btrim(p_input->>'title'),p_input->>'body',coalesce(s.ids,'{}'),jsonb_build_object('country',t.country,'city',t.city,'startDate',t.start_date,'endDate',t.end_date,
      'itinerary',coalesce((SELECT jsonb_agg(jsonb_build_object('title',i.title,'date',d.trip_date,'timeSlot',i.time_slot,'address',i.address) ORDER BY d.trip_date,i.sort_order,i.id) FROM public.itinerary_items i JOIN public.trip_days d ON d.id=i.trip_day_id WHERE d.trip_id=t.id AND i.id IN(SELECT value::uuid FROM jsonb_array_elements_text(p_input->'scheduleIds'))),'[]'),
      'costs',CASE WHEN (p_input->>'includeCosts')::boolean THEN coalesce((SELECT jsonb_object_agg(currency,total::text) FROM(SELECT currency,sum(amount) total FROM public.expenses WHERE trip_id=t.id AND is_actual GROUP BY currency) costs),'{}') ELSE '{}'::jsonb END)
    FROM public.trips t CROSS JOIN selected_photos s WHERE t.id=p_trip AND t.status='COMPLETED'
      AND NOT EXISTS(SELECT 1 FROM unnest(coalesce(s.ids,'{}')) chosen(value) WHERE NOT EXISTS(SELECT 1 FROM public.trip_media m WHERE m.id=chosen.value AND m.trip_id=p_trip AND m.purpose='photo'))
      AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(p_input->'scheduleIds') chosen(value) WHERE NOT EXISTS(SELECT 1 FROM public.itinerary_items i JOIN public.trip_days d ON d.id=i.trip_day_id WHERE i.id=chosen.value::uuid AND d.trip_id=p_trip))
    ON CONFLICT(trip_id) DO UPDATE SET title=excluded.title,body=excluded.body,snapshot=excluded.snapshot,photo_ids=excluded.photo_ids,published=true,updated_at=now() RETURNING id
  ) SELECT coalesce((SELECT jsonb_build_object('id',id) FROM saved),wherego_private.fail('VALIDATION_FAILED'));
$$;
CREATE FUNCTION wherego_private.community_withdraw(p_trip UUID) RETURNS JSONB LANGUAGE SQL SECURITY DEFINER SET search_path='' AS $$
  -- 공개 사진 접근도 함께 종료되도록 게시 상태를 철회한다.
  WITH changed AS(UPDATE public.community_posts SET published=false,updated_at=now() WHERE trip_id=p_trip RETURNING id)
  SELECT coalesce((SELECT jsonb_build_object('id',id) FROM changed),wherego_private.fail('RESOURCE_NOT_FOUND'));
$$;
CREATE FUNCTION wherego_private.dispatch_command(p_trip UUID,p_operation TEXT,p_input JSONB) RETURNS JSONB LANGUAGE SQL SECURITY DEFINER SET search_path='' AS $$
  -- 알려진 명령만 각 단일 책임 저장 함수에 연결한다.
  SELECT CASE p_operation
    WHEN 'schedule.save' THEN wherego_private.schedule_save(p_trip,p_input) WHEN 'schedule.delete' THEN wherego_private.schedule_delete(p_trip,p_input)
    WHEN 'expense.save' THEN wherego_private.expense_save(p_trip,p_input) WHEN 'expense.delete' THEN wherego_private.expense_delete(p_trip,p_input)
    WHEN 'trip.update' THEN wherego_private.trip_update(p_trip,p_input) WHEN 'trip.period' THEN wherego_private.trip_period(p_trip,p_input)
    WHEN 'media.register' THEN wherego_private.media_register(p_trip,p_input) WHEN 'media.delete' THEN wherego_private.media_delete(p_trip,p_input)
    WHEN 'receipt.confirm' THEN wherego_private.receipt_confirm(p_trip,p_input) WHEN 'receipt.delete' THEN wherego_private.receipt_delete(p_trip,p_input)
    WHEN 'invite.create' THEN wherego_private.invite_create(p_trip,p_input) WHEN 'invite.revoke' THEN wherego_private.invite_revoke(p_trip,p_input)
    WHEN 'member.role' THEN wherego_private.member_change(p_trip,p_input,false) WHEN 'member.remove' THEN wherego_private.member_change(p_trip,p_input,true)
    WHEN 'community.publish' THEN wherego_private.community_publish(p_trip,p_input) WHEN 'community.withdraw' THEN wherego_private.community_withdraw(p_trip)
    ELSE wherego_private.fail('VALIDATION_FAILED') END;
$$;
CREATE FUNCTION wherego_private.apply_command(p_trip UUID,p_operation TEXT,p_input JSONB,p_version BIGINT,p_claim JSONB) RETURNS JSONB LANGUAGE SQL SECURITY DEFINER SET search_path='' AS $$
  -- 성공 재생은 현재 권한을 재검사하며 새 변경만 버전을 증가시킨다.
  SELECT CASE WHEN (CASE WHEN p_operation LIKE 'trip.%' OR p_operation LIKE 'invite.%' OR p_operation LIKE 'member.%' OR p_operation LIKE 'community.%' THEN wherego_private.require_owner(p_trip) ELSE wherego_private.require_write(p_trip) END) IS NOT NULL THEN
    CASE WHEN p_claim->'result'<>'null'::jsonb THEN wherego_private.finish_mutation(p_claim,p_claim->'result') ELSE
      (WITH bumped AS MATERIALIZED(SELECT wherego_private.bump_trip(p_trip,p_version) trip), applied AS MATERIALIZED(SELECT wherego_private.dispatch_command(p_trip,p_operation,p_input) result FROM bumped)
       SELECT wherego_private.finish_mutation(p_claim,a.result||jsonb_build_object('tripId',p_trip,'tripVersion',(b.trip->>'version')::bigint)) FROM applied a CROSS JOIN bumped b) END END;
$$;
CREATE FUNCTION wherego_private.validate_command(p_operation TEXT,p_input JSONB) RETURNS JSONB LANGUAGE SQL IMMUTABLE SET search_path='' AS $$
  -- HTTP를 우회한 RPC 호출에도 허용 필드·금액 정밀도·공개 타입을 검사한다.
  SELECT CASE WHEN jsonb_typeof(p_input)='object' AND (p_input - CASE p_operation
    WHEN 'schedule.save' THEN ARRAY['id','dayId','title','type','timeSlot','sortOrder','memo','address']
    WHEN 'expense.save' THEN ARRAY['id','dayId','scheduleId','title','amount','currency','category','isActual']
    WHEN 'trip.update' THEN ARRAY['title','country','city','status']
    WHEN 'trip.period' THEN ARRAY['startDate','endDate']
    WHEN 'media.register' THEN ARRAY['id','scheduleId','path','purpose','mimeType']
    WHEN 'receipt.confirm' THEN ARRAY['id','dayId','scheduleId','mediaId','merchant','transactionDate','amount','currency','details']
    WHEN 'invite.create' THEN ARRAY['role'] WHEN 'member.role' THEN ARRAY['userId','role'] WHEN 'member.remove' THEN ARRAY['userId']
    WHEN 'community.publish' THEN ARRAY['title','body','scheduleIds','photoIds','includeCosts'] WHEN 'community.withdraw' THEN ARRAY[]::text[]
    WHEN 'schedule.delete' THEN ARRAY['id'] WHEN 'expense.delete' THEN ARRAY['id'] WHEN 'media.delete' THEN ARRAY['id'] WHEN 'receipt.delete' THEN ARRAY['id'] WHEN 'invite.revoke' THEN ARRAY['id'] ELSE ARRAY['__invalid__'] END)='{}'::jsonb
    AND (p_operation NOT IN('expense.save','receipt.confirm') OR (jsonb_typeof(p_input->'amount')='string' AND (p_input->>'amount') ~ CASE WHEN p_input->>'currency'='USD' THEN '^\d{1,10}(\.\d{1,2})?$' ELSE '^\d{1,10}$' END))
    AND (p_operation<>'expense.save' OR jsonb_typeof(p_input->'isActual')='boolean')
    AND (p_operation<>'trip.update' OR p_input->>'status' IN('DRAFT','PLANNED','IN_PROGRESS','COMPLETED'))
    AND (p_operation<>'community.publish' OR (jsonb_typeof(p_input->'scheduleIds')='array' AND jsonb_typeof(p_input->'photoIds')='array' AND jsonb_typeof(p_input->'includeCosts')='boolean'))
    AND (p_operation NOT IN('invite.create','member.role') OR p_input->>'role' IN('editor','viewer'))
  THEN p_input ELSE wherego_private.fail('VALIDATION_FAILED') END;
$$;
CREATE FUNCTION public.wherego_command(p_trip UUID,p_operation TEXT,p_input JSONB,p_version BIGINT,p_key UUID) RETURNS JSONB LANGUAGE SQL SECURITY DEFINER SET search_path='' AS $$
  -- 서버에서 정의한 명령만 원자적으로 실행한다.
  SELECT wherego_private.apply_command(p_trip,p_operation,wherego_private.validate_command(p_operation,p_input),p_version,wherego_private.claim_mutation(p_key,p_operation,jsonb_build_object('tripId',p_trip,'input',wherego_private.validate_command(p_operation,p_input),'version',p_version)));
$$;
CREATE FUNCTION wherego_private.accept_invite(p_token TEXT) RETURNS JSONB LANGUAGE SQL SECURITY DEFINER SET search_path='' AS $$
  -- 초대 행을 잠가 한 사용자만 수락하고 기존 멤버 역할은 유지한다.
  WITH candidate AS MATERIALIZED(SELECT * FROM public.trip_invites WHERE token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') AND revoked_at IS NULL AND expires_at>now() AND (used_at IS NULL OR accepted_by=wherego_private.require_actor()) AND EXISTS(SELECT 1 FROM public.trips WHERE id=trip_id AND status<>'ARCHIVED') FOR UPDATE), accepted AS(
    UPDATE public.trip_invites i SET used_at=coalesce(i.used_at,now()),accepted_by=wherego_private.require_actor() FROM candidate c WHERE i.id=c.id RETURNING i.*
  ), member AS(INSERT INTO public.trip_members(trip_id,user_id,role) SELECT trip_id,wherego_private.require_actor(),role FROM accepted ON CONFLICT(trip_id,user_id) DO UPDATE SET role=public.trip_members.role RETURNING trip_id), bumped AS(UPDATE public.trips SET version=version+1 WHERE id IN(SELECT trip_id FROM member) RETURNING id,version)
  SELECT coalesce((SELECT jsonb_build_object('tripId',id,'tripVersion',version) FROM bumped),wherego_private.fail('INVITE_INVALID'));
$$;
CREATE FUNCTION wherego_private.apply_accept(p_token TEXT,p_claim JSONB) RETURNS JSONB LANGUAGE SQL SECURITY DEFINER SET search_path='' AS $$
  -- 재시도 시 저장 결과의 멤버십과 초대 철회를 재검사한다.
  SELECT wherego_private.finish_mutation(p_claim,CASE WHEN p_claim->'result'<>'null'::jsonb THEN CASE WHEN wherego_private.member_role((p_claim->'result'->>'tripId')::uuid) IS NOT NULL AND EXISTS(SELECT 1 FROM public.trip_invites WHERE token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') AND revoked_at IS NULL) THEN p_claim->'result' ELSE wherego_private.fail('INVITE_INVALID') END ELSE wherego_private.accept_invite(p_token) END);
$$;
CREATE FUNCTION public.wherego_accept_invite(p_token TEXT,p_key UUID) RETURNS JSONB LANGUAGE SQL SECURITY DEFINER SET search_path='' AS $$
  -- 초대 토큰 원문 대신 해시를 중복 요청 식별 내용에 사용한다.
  SELECT CASE WHEN p_token ~ '^[0-9a-f]{64}$' THEN wherego_private.apply_accept(p_token,wherego_private.claim_mutation(p_key,'invite.accept',jsonb_build_object('tokenHash',encode(sha256(convert_to(p_token,'UTF8')),'hex')))) ELSE wherego_private.fail('INVITE_INVALID') END;
$$;
CREATE FUNCTION public.wherego_workspace(p_trip UUID) RETURNS JSONB LANGUAGE SQL STABLE SECURITY DEFINER SET search_path='' AS $$
  -- 기존 스냅샷 권한 검사 후 확장 기록과 최소 초대 상태를 투영한다.
  SELECT public.wherego_trip_snapshot(p_trip)||jsonb_build_object(
    'itinerary',coalesce((SELECT jsonb_agg(jsonb_build_object('id',i.id,'dayId',i.trip_day_id,'title',i.title,'type',i.type,'timeSlot',i.time_slot,'sortOrder',i.sort_order,'memo',i.memo,'address',i.address) ORDER BY d.day_number,i.sort_order,i.id) FROM public.itinerary_items i JOIN public.trip_days d ON d.id=i.trip_day_id WHERE d.trip_id=p_trip),'[]'),
    'media',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'path',path,'purpose',purpose,'scheduleId',schedule_id)) FROM public.trip_media WHERE trip_id=p_trip),'[]'),
    'receipts',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'scheduleId',schedule_id,'mediaId',media_id,'merchant',merchant,'date',transaction_date,'amount',total_amount::text,'currency',currency,'details',details)) FROM public.receipt_records WHERE trip_id=p_trip),'[]'),
    'invites',CASE WHEN wherego_private.member_role(p_trip)='owner' THEN coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'role',role,'expiresAt',expires_at,'revokedAt',revoked_at,'usedAt',used_at)) FROM public.trip_invites WHERE trip_id=p_trip),'[]') ELSE '[]'::jsonb END,
    'postId',(SELECT id FROM public.community_posts WHERE trip_id=p_trip AND published));
$$;
CREATE FUNCTION public.wherego_community(p_offset INT DEFAULT 0) RETURNS JSONB LANGUAGE SQL STABLE SECURITY DEFINER SET search_path='' AS $$
  -- 공개 스냅샷만 페이지로 반환하고 로그인 사용자의 차단 목록을 적용한다.
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',p.id,'authorId',p.author_id,'author',r.nickname,'title',p.title,'body',p.body,'snapshot',p.snapshot,'publishedAt',p.published_at,'photoPaths',coalesce((SELECT jsonb_agg(m.path) FROM public.trip_media m WHERE m.id=ANY(p.photo_ids) AND m.purpose='photo'),'[]')) ORDER BY p.published_at DESC,p.id),'[]')
  FROM(SELECT * FROM public.community_posts p WHERE published AND NOT EXISTS(SELECT 1 FROM public.community_blocks WHERE user_id=auth.uid() AND blocked_user_id=p.author_id) ORDER BY published_at DESC,id LIMIT 20 OFFSET greatest(0,least(p_offset,10000))) p JOIN public.profiles r ON r.id=p.author_id;
$$;
CREATE FUNCTION public.wherego_report(p_post UUID,p_reason TEXT) RETURNS JSONB LANGUAGE SQL SECURITY DEFINER SET search_path='' AS $$
  -- 신고는 본인 식별자와 공개 게시물에만 연결한다.
  WITH saved AS(INSERT INTO public.community_reports(post_id,reporter_id,reason) SELECT id,wherego_private.require_actor(),btrim(p_reason) FROM public.community_posts WHERE id=p_post AND published ON CONFLICT(post_id,reporter_id) DO UPDATE SET reason=excluded.reason RETURNING post_id)
  SELECT coalesce((SELECT jsonb_build_object('id',post_id) FROM saved),wherego_private.fail('RESOURCE_NOT_FOUND'));
$$;
CREATE FUNCTION public.wherego_block(p_user UUID) RETURNS JSONB LANGUAGE SQL SECURITY DEFINER SET search_path='' AS $$
  -- 본인 차단 목록에 사용자 하나만 등록한다.
  WITH saved AS(INSERT INTO public.community_blocks(user_id,blocked_user_id) VALUES(wherego_private.require_actor(),p_user) ON CONFLICT DO NOTHING RETURNING blocked_user_id)
  SELECT jsonb_build_object('id',p_user);
$$;
CREATE FUNCTION wherego_private.can_read_media(p_name TEXT) RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path='' AS $$
  -- 비공개 여행 멤버 또는 공개 게시에 선택된 사진만 읽을 수 있다.
  SELECT EXISTS(SELECT 1 FROM public.trip_media m WHERE m.path=p_name AND (wherego_private.member_role(m.trip_id) IS NOT NULL OR (m.purpose='photo' AND EXISTS(SELECT 1 FROM public.community_posts p WHERE p.published AND m.id=ANY(p.photo_ids))))) OR
    (NOT EXISTS(SELECT 1 FROM public.trip_media WHERE path=p_name) AND EXISTS(SELECT 1 FROM public.trips t WHERE t.id::text=split_part(p_name,'/',1) AND wherego_private.member_role(t.id) IN('owner','editor')));
$$;
CREATE FUNCTION wherego_private.can_upload_media(p_name TEXT) RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path='' AS $$
  -- 실제 여행의 편집자와 정규화된 파일 경로만 업로드한다.
  SELECT p_name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png)$' AND EXISTS(SELECT 1 FROM public.trips t WHERE t.id::text=split_part(p_name,'/',1) AND wherego_private.member_role(t.id) IN('owner','editor') AND t.status<>'ARCHIVED');
$$;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES('trip-private','trip-private',false,4194304,ARRAY['image/jpeg','image/png']) ON CONFLICT(id) DO NOTHING;
CREATE POLICY trip_media_upload ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='trip-private' AND wherego_private.can_upload_media(name));
CREATE POLICY trip_media_read ON storage.objects FOR SELECT TO anon,authenticated USING(bucket_id='trip-private' AND wherego_private.can_read_media(name));
CREATE POLICY trip_media_remove ON storage.objects FOR DELETE TO authenticated USING(bucket_id='trip-private' AND wherego_private.can_upload_media(name) AND NOT EXISTS(SELECT 1 FROM public.trip_media m WHERE m.path=name));
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA wherego_private FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION wherego_private.member_role(UUID) TO authenticated;
GRANT USAGE ON SCHEMA wherego_private TO anon;
GRANT EXECUTE ON FUNCTION wherego_private.can_read_media(TEXT) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION wherego_private.can_upload_media(TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.wherego_command(UUID,TEXT,JSONB,BIGINT,UUID),public.wherego_accept_invite(TEXT,UUID),public.wherego_workspace(UUID),public.wherego_community(INT),public.wherego_report(UUID,TEXT),public.wherego_block(UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.wherego_command(UUID,TEXT,JSONB,BIGINT,UUID),public.wherego_accept_invite(TEXT,UUID),public.wherego_workspace(UUID),public.wherego_report(UUID,TEXT),public.wherego_block(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.wherego_community(INT) TO anon,authenticated;
