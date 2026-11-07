-- 기존 90일 여행은 유지하고 신규 생성·이름 계약만 갱신한다.
ALTER TABLE public.trips DROP CONSTRAINT trips_nonempty_labels;
ALTER TABLE public.trips ADD CONSTRAINT trips_nonempty_labels CHECK(length(btrim(title)) BETWEEN 1 AND 100 AND length(btrim(country)) BETWEEN 1 AND 50 AND length(btrim(city)) BETWEEN 0 AND 50);
CREATE OR REPLACE FUNCTION wherego_private.validate_trip_base(p_input JSONB) RETURNS JSONB LANGUAGE SQL STABLE SET search_path='' AS $$
  SELECT CASE WHEN jsonb_typeof(p_input)='object'
    AND (p_input - ARRAY['title','country','city','startDate','endDate','timezone','defaultCurrency','coverColor'])='{}'::jsonb
    AND jsonb_typeof(p_input->'country')='string' AND jsonb_typeof(p_input->'city')='string'
    AND jsonb_typeof(p_input->'startDate')='string' AND jsonb_typeof(p_input->'endDate')='string'
    AND jsonb_typeof(p_input->'timezone')='string'
    AND (NOT p_input ? 'title' OR jsonb_typeof(p_input->'title')='string')
    AND (NOT p_input ? 'defaultCurrency' OR jsonb_typeof(p_input->'defaultCurrency')='string')
    AND (NOT p_input ? 'coverColor' OR jsonb_typeof(p_input->'coverColor')='string')
    AND length(btrim(p_input->>'country')) BETWEEN 1 AND 50 AND length(btrim(p_input->>'city')) BETWEEN 0 AND 50
    AND coalesce(length(normalize(btrim(p_input->>'title'),NFC)),0)<=60
    AND p_input->>'startDate' ~ '^\d{4}-\d{2}-\d{2}$' AND p_input->>'endDate' ~ '^\d{4}-\d{2}-\d{2}$'
    AND (p_input->>'endDate')::date - (p_input->>'startDate')::date BETWEEN 0 AND 89
    AND EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name=p_input->>'timezone')
    AND coalesce(p_input->>'defaultCurrency','KRW') IN ('KRW','JPY','USD')
    AND coalesce(p_input->>'coverColor','#246A54') ~ '^#[0-9A-Fa-f]{6}$'
  THEN p_input ELSE wherego_private.fail('VALIDATION_FAILED') END;
$$;

CREATE FUNCTION wherego_private.new_trip_input(p_input JSONB) RETURNS JSONB LANGUAGE SQL STABLE SET search_path='' AS $$
  -- 신규 제한은 이전 성공 결과 재생 뒤에 적용하고 기존 요청의 해시는 변경하지 않는다.
  SELECT CASE WHEN (p_input->>'endDate')::date-(p_input->>'startDate')::date BETWEEN 0 AND 29
    THEN jsonb_set(p_input,'{title}',to_jsonb(coalesce(nullif(normalize(btrim(p_input->>'title'),NFC),''),
      left(left(p_input->>'startDate',4)||' '||coalesce(nullif(btrim(p_input->>'city'),''),btrim(p_input->>'country'))||' 여행',60))))
    ELSE wherego_private.fail('VALIDATION_FAILED') END;
$$;

CREATE OR REPLACE FUNCTION wherego_private.apply_create(p_claim JSONB,p_input JSONB) RETURNS JSONB LANGUAGE SQL SECURITY DEFINER SET search_path='' AS $$
  SELECT wherego_private.finish_mutation(p_claim,
    CASE WHEN p_claim->'result'<>'null'::jsonb THEN
      CASE WHEN wherego_private.member_role((p_claim->'result'->'trip'->>'id')::uuid) IS NOT NULL
        THEN p_claim->'result' ELSE wherego_private.fail('RESOURCE_NOT_FOUND') END
    ELSE wherego_private.insert_trip(wherego_private.new_trip_input(p_input)) END);
$$;

REVOKE ALL ON FUNCTION wherego_private.new_trip_input(JSONB) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION wherego_private.trip_update(p_trip UUID,p_input JSONB) RETURNS JSONB LANGUAGE SQL SECURITY DEFINER SET search_path='' AS $$
  WITH saved AS(UPDATE public.trips SET title=normalize(btrim(p_input->>'title'),NFC),country=btrim(p_input->>'country'),city=btrim(p_input->>'city'),status=(p_input->>'status')::public.trip_status
    WHERE id=p_trip AND CASE WHEN length(normalize(btrim(p_input->>'title'),NFC)) BETWEEN 1 AND 60 THEN true ELSE (wherego_private.fail('VALIDATION_FAILED')::text)::boolean END RETURNING id)
  SELECT jsonb_build_object('id',id) FROM saved;
$$;
