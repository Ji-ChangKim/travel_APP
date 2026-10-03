-- M1 목표 필드와 제약을 추가한다. 기존 잘못된 데이터는 자동 삭제하지 않고 적용 오류로 드러낸다.
CREATE SCHEMA IF NOT EXISTS wherego_private;
REVOKE ALL ON SCHEMA wherego_private FROM PUBLIC;
GRANT USAGE ON SCHEMA wherego_private TO authenticated;

ALTER TABLE public.profiles ADD COLUMN version BIGINT NOT NULL DEFAULT 1 CHECK (version > 0);
ALTER TABLE public.trips
  ADD COLUMN timezone TEXT NOT NULL DEFAULT 'UTC',
  ADD COLUMN default_currency VARCHAR(3) NOT NULL DEFAULT 'KRW' CHECK (default_currency IN ('KRW', 'JPY', 'USD')),
  ADD COLUMN version BIGINT NOT NULL DEFAULT 1 CHECK (version > 0),
  ADD CONSTRAINT trips_period_limit CHECK (end_date - start_date BETWEEN 0 AND 89);
ALTER TABLE public.trip_members ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.trip_days
  ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD CONSTRAINT trip_days_positive_number CHECK (day_number > 0),
  ADD CONSTRAINT trip_days_unique_date UNIQUE (trip_id, trip_date);
ALTER TABLE public.places
  ADD COLUMN provider VARCHAR(30) NOT NULL DEFAULT 'legacy',
  ADD COLUMN external_place_id TEXT,
  ADD COLUMN scope_trip_id UUID REFERENCES public.trips(id) ON DELETE CASCADE,
  ADD COLUMN fetched_at TIMESTAMPTZ,
  ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD CONSTRAINT places_coordinate_pair CHECK ((latitude IS NULL AND longitude IS NULL) OR (latitude IS NOT NULL AND longitude IS NOT NULL AND latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180)),
  ADD CONSTRAINT places_manual_scope CHECK (provider <> 'manual' OR scope_trip_id IS NOT NULL);
CREATE UNIQUE INDEX places_provider_identity ON public.places(provider, external_place_id) WHERE external_place_id IS NOT NULL;

ALTER TABLE public.itinerary_items
  ALTER COLUMN place_id DROP NOT NULL,
  DROP CONSTRAINT itinerary_items_place_id_fkey,
  ADD CONSTRAINT itinerary_items_place_id_fkey FOREIGN KEY (place_id) REFERENCES public.places(id) ON DELETE RESTRICT,
  ADD COLUMN type VARCHAR(20) NOT NULL DEFAULT 'PLACE' CHECK (type IN ('PLACE','TRANSPORT','STAY','RESERVATION','TODO','MEMO')),
  ADD COLUMN title VARCHAR(100),
  ADD COLUMN created_by UUID REFERENCES public.profiles(id),
  ADD COLUMN updated_by UUID REFERENCES public.profiles(id),
  ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
-- 기존 일정 이름과 작성자를 현재 연결 관계에서 백필한다.
UPDATE public.itinerary_items i SET title = p.name FROM public.places p WHERE p.id = i.place_id AND i.title IS NULL;
UPDATE public.itinerary_items i SET created_by = t.user_id, updated_by = t.user_id FROM public.trip_days d JOIN public.trips t ON t.id = d.trip_id WHERE d.id = i.trip_day_id;
ALTER TABLE public.itinerary_items
  ALTER COLUMN title SET NOT NULL,
  ALTER COLUMN created_by SET NOT NULL,
  ALTER COLUMN updated_by SET NOT NULL,
  ADD CONSTRAINT itinerary_title_length CHECK (length(btrim(title)) BETWEEN 1 AND 100),
  ADD CONSTRAINT itinerary_memo_length CHECK (memo IS NULL OR length(memo) <= 300),
  ADD CONSTRAINT itinerary_valid_time CHECK (time_slot IS NULL OR time_slot ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  ADD CONSTRAINT itinerary_positive_order CHECK (sort_order > 0);

ALTER TABLE public.expenses
  ADD COLUMN source VARCHAR(20) NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','schedule','receipt')),
  ADD COLUMN created_by UUID REFERENCES public.profiles(id),
  ADD COLUMN updated_by UUID REFERENCES public.profiles(id),
  ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD CONSTRAINT expenses_positive_amount CHECK (amount > 0),
  ADD CONSTRAINT expenses_currency_precision CHECK (currency IN ('KRW','JPY','USD') AND (currency = 'USD' OR amount = trunc(amount))),
  ADD CONSTRAINT expenses_category CHECK (category IN ('food','transport','stay','activity','shopping','etc')),
  ADD CONSTRAINT expenses_title_length CHECK (length(btrim(title)) BETWEEN 1 AND 100),
  ADD CONSTRAINT expenses_schedule_source CHECK (source <> 'schedule' OR (schedule_id IS NOT NULL AND is_actual = false));
UPDATE public.expenses e SET created_by = t.user_id, updated_by = t.user_id FROM public.trips t WHERE t.id = e.trip_id;
ALTER TABLE public.expenses ALTER COLUMN created_by SET NOT NULL, ALTER COLUMN updated_by SET NOT NULL;
CREATE UNIQUE INDEX expenses_single_schedule_estimate ON public.expenses(schedule_id, currency) WHERE source = 'schedule' AND is_actual = false;
ALTER TABLE public.checklists
  ADD COLUMN created_by UUID REFERENCES public.profiles(id),
  ADD COLUMN updated_by UUID REFERENCES public.profiles(id),
  ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD CONSTRAINT checklists_title_length CHECK (length(btrim(title)) BETWEEN 1 AND 100);
UPDATE public.checklists c SET created_by = t.user_id, updated_by = t.user_id FROM public.trips t WHERE t.id = c.trip_id;
ALTER TABLE public.checklists ALTER COLUMN created_by SET NOT NULL, ALTER COLUMN updated_by SET NOT NULL;

-- 소유자를 독립 멤버 행에도 등록해 참조 일관성을 유지한다.
INSERT INTO public.trip_members(trip_id,user_id,role) SELECT id,user_id,'owner' FROM public.trips ON CONFLICT (trip_id,user_id) DO UPDATE SET role='owner';
CREATE UNIQUE INDEX trip_members_single_owner ON public.trip_members(trip_id) WHERE role='owner';
ALTER TABLE public.trips ADD CONSTRAINT trips_owner_membership FOREIGN KEY (id,user_id) REFERENCES public.trip_members(trip_id,user_id) DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE public.trip_invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  role member_role NOT NULL CHECK (role IN ('editor','viewer')),
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  used_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT trip_invites_expiry CHECK (expires_at > created_at),
  CONSTRAINT trip_invites_acceptance CHECK ((used_at IS NULL) = (accepted_by IS NULL))
);
CREATE TABLE public.mutation_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  principal_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  request_key UUID NOT NULL,
  operation TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  CONSTRAINT mutation_requests_actor_key UNIQUE (principal_id,request_key),
  CONSTRAINT mutation_requests_expiry CHECK (expires_at > created_at)
);
CREATE INDEX mutation_requests_expiry_index ON public.mutation_requests(expires_at);
ALTER TABLE public.trip_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mutation_requests ENABLE ROW LEVEL SECURITY;

-- 내부 오류 한 개를 SQL 예외로 변환한다.
CREATE FUNCTION wherego_private.fail(p_code TEXT) RETURNS JSONB LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  -- 검증 실패를 공개 가능한 오류 코드로만 전달한다.
  RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE=p_code;
END;
$$;

-- 실제 Auth 컬럼을 사용해 회원 프로필 하나를 생성한다.
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  -- Auth UID와 검증된 제공자 정보로만 기본 프로필을 등록한다.
  RETURN wherego_private.register_profile(NEW);
END;
$$;
CREATE FUNCTION wherego_private.register_profile(p_user auth.users) RETURNS auth.users LANGUAGE SQL SECURITY DEFINER SET search_path='' AS $$
  -- 공백 닉네임을 기본값으로 대체하고 실제 raw_app_meta_data 제공자를 저장한다.
  WITH inserted AS (
    INSERT INTO public.profiles(id,nickname,avatar_url,os_platform,auth_provider)
    VALUES (p_user.id, left(coalesce(nullif(btrim(p_user.raw_user_meta_data->>'nickname'),''),nullif(btrim(p_user.raw_user_meta_data->>'name'),''),nullif(split_part(p_user.email,'@',1),''),'여행자'),50),p_user.raw_user_meta_data->>'avatar_url','web',coalesce(p_user.raw_app_meta_data->>'provider','email'))
    ON CONFLICT (id) DO NOTHING RETURNING id
  ) SELECT p_user FROM (SELECT count(*) FROM inserted) AS applied;
$$;

-- 현재 JWT 사용자의 역할만 읽어 정책의 재귀 참조를 피한다.
CREATE FUNCTION wherego_private.member_role(p_trip UUID) RETURNS TEXT LANGUAGE SQL STABLE SECURITY DEFINER SET search_path='' AS $$
  -- 현재 사용자와 여행 멤버십을 대조한다.
  SELECT role::text FROM public.trip_members WHERE trip_id=p_trip AND user_id=auth.uid();
$$;

-- 비용의 여행·일정·DAY·결제자 연결을 한 번 검증한다.
CREATE FUNCTION wherego_private.validate_expense(p_row public.expenses) RETURNS public.expenses LANGUAGE SQL SET search_path='' AS $$
  -- 서로 다른 여행을 참조하는 비용을 거부한다.
  SELECT CASE WHEN
    (p_row.trip_day_id IS NULL OR EXISTS (SELECT 1 FROM public.trip_days WHERE id=p_row.trip_day_id AND trip_id=p_row.trip_id)) AND
    (p_row.schedule_id IS NULL OR EXISTS (SELECT 1 FROM public.itinerary_items i JOIN public.trip_days d ON d.id=i.trip_day_id WHERE i.id=p_row.schedule_id AND d.trip_id=p_row.trip_id AND d.id=p_row.trip_day_id)) AND
    (p_row.paid_by_user_id IS NULL OR EXISTS (SELECT 1 FROM public.trip_members WHERE trip_id=p_row.trip_id AND user_id=p_row.paid_by_user_id))
  THEN p_row ELSE jsonb_populate_record(NULL::public.expenses,wherego_private.fail('VALIDATION_FAILED')) END;
$$;
CREATE FUNCTION wherego_private.expense_guard() RETURNS TRIGGER LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  -- 비용 연결 검증의 결과 행만 반환한다.
  RETURN wherego_private.validate_expense(NEW);
END;
$$;
CREATE TRIGGER expenses_parent_guard BEFORE INSERT OR UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION wherego_private.expense_guard();

-- 사적 장소를 다른 여행 일정에 연결하지 못하게 한다.
CREATE FUNCTION wherego_private.validate_itinerary(p_row public.itinerary_items) RETURNS public.itinerary_items LANGUAGE SQL SET search_path='' AS $$
  -- 장소의 여행 범위와 일정 DAY의 소속을 비교한다.
  SELECT CASE WHEN p_row.place_id IS NULL OR EXISTS (SELECT 1 FROM public.places p JOIN public.trip_days d ON d.id=p_row.trip_day_id WHERE p.id=p_row.place_id AND (p.scope_trip_id IS NULL OR p.scope_trip_id=d.trip_id))
  THEN p_row ELSE jsonb_populate_record(NULL::public.itinerary_items,wherego_private.fail('VALIDATION_FAILED')) END;
$$;
CREATE FUNCTION wherego_private.itinerary_guard() RETURNS TRIGGER LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  -- 일정 부모 검증 하나를 위임한다.
  RETURN wherego_private.validate_itinerary(NEW);
END;
$$;
CREATE TRIGGER itinerary_parent_guard BEFORE INSERT OR UPDATE ON public.itinerary_items FOR EACH ROW EXECUTE FUNCTION wherego_private.itinerary_guard();

-- owner 역할과 여행 소유자 UUID를 일치시킨다.
CREATE FUNCTION wherego_private.validate_member(p_row public.trip_members) RETURNS public.trip_members LANGUAGE SQL SET search_path='' AS $$
  -- 여행 소유자의 역할이 owner이며 다른 멤버는 owner가 아닌지 확인한다.
  SELECT CASE WHEN EXISTS (SELECT 1 FROM public.trips WHERE id=p_row.trip_id AND ((user_id=p_row.user_id)=(p_row.role='owner')))
  THEN p_row ELSE jsonb_populate_record(NULL::public.trip_members,wherego_private.fail('VALIDATION_FAILED')) END;
$$;
CREATE FUNCTION wherego_private.member_guard() RETURNS TRIGGER LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  -- 멤버 소유권 검증 하나를 위임한다.
  RETURN wherego_private.validate_member(NEW);
END;
$$;
CREATE TRIGGER members_owner_guard BEFORE INSERT OR UPDATE ON public.trip_members FOR EACH ROW EXECUTE FUNCTION wherego_private.member_guard();

-- 기존 공개/쓰기 정책을 제거하고 읽기와 명령 권한을 분리한다.
DROP POLICY "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY "Users can insert own profile" ON public.profiles;
DROP POLICY "Users can update own profile" ON public.profiles;
CREATE POLICY profiles_self_read ON public.profiles FOR SELECT TO authenticated USING (id=auth.uid());
DROP POLICY "Places are viewable by everyone" ON public.places;
DROP POLICY "Authenticated users can insert places" ON public.places;
CREATE POLICY places_member_read ON public.places FOR SELECT TO authenticated USING (
  (scope_trip_id IS NOT NULL AND wherego_private.member_role(scope_trip_id) IS NOT NULL) OR
  EXISTS (SELECT 1 FROM public.itinerary_items i JOIN public.trip_days d ON d.id=i.trip_day_id WHERE i.place_id=places.id AND wherego_private.member_role(d.trip_id) IS NOT NULL)
);
DROP POLICY "Users can view own trips and shared trips" ON public.trips;
DROP POLICY "Users can insert own trips" ON public.trips;
DROP POLICY "Owners can update trips" ON public.trips;
DROP POLICY "Owners can delete trips" ON public.trips;
CREATE POLICY trips_member_read ON public.trips FOR SELECT TO authenticated USING (wherego_private.member_role(id) IS NOT NULL);
CREATE POLICY members_trip_read ON public.trip_members FOR SELECT TO authenticated USING (wherego_private.member_role(trip_id) IS NOT NULL);
CREATE POLICY days_trip_read ON public.trip_days FOR SELECT TO authenticated USING (wherego_private.member_role(trip_id) IS NOT NULL);
CREATE POLICY itinerary_trip_read ON public.itinerary_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.trip_days WHERE id=itinerary_items.trip_day_id AND wherego_private.member_role(trip_id) IS NOT NULL));
DROP POLICY "Users can view expenses of own or joined trips" ON public.expenses;
DROP POLICY "Members can insert expenses" ON public.expenses;
DROP POLICY "Members can update expenses" ON public.expenses;
DROP POLICY "Members can delete expenses" ON public.expenses;
CREATE POLICY expenses_trip_read ON public.expenses FOR SELECT TO authenticated USING (wherego_private.member_role(trip_id) IS NOT NULL);
DROP POLICY "Users can view checklists of own or joined trips" ON public.checklists;
DROP POLICY "Members can insert checklists" ON public.checklists;
DROP POLICY "Members can update checklists" ON public.checklists;
DROP POLICY "Members can delete checklists" ON public.checklists;
CREATE POLICY checklists_trip_read ON public.checklists FOR SELECT TO authenticated USING (wherego_private.member_role(trip_id) IS NOT NULL);

-- 일반 사용자의 직접 쓰기를 차단하고 검증된 RPC만 실행하게 한다.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
GRANT SELECT ON public.profiles,public.trips,public.trip_members,public.trip_days,public.places,public.itinerary_items,public.expenses,public.checklists TO authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA wherego_private FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION wherego_private.member_role(UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC,anon,authenticated;
