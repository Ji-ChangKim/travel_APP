-- 구글 장소 콘텐츠 대신 영구 저장이 허용되는 장소 ID만 기록한다.
CREATE TABLE wherego_private.itinerary_google_places (
  schedule_id UUID PRIMARY KEY REFERENCES public.itinerary_items(id) ON DELETE CASCADE,
  place_id TEXT NOT NULL CHECK (place_id ~ '^[A-Za-z0-9_-]{1,200}$')
);
ALTER TABLE wherego_private.itinerary_google_places ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON wherego_private.itinerary_google_places FROM PUBLIC,anon,authenticated;

ALTER FUNCTION wherego_private.validate_command(TEXT,JSONB) RENAME TO validate_command_base;
CREATE FUNCTION wherego_private.validate_command(p_operation TEXT,p_input JSONB) RETURNS JSONB LANGUAGE SQL IMMUTABLE SET search_path='' AS $$
  -- 장소 ID는 일정 저장에서만 허용하고 기존 모든 입력 검증을 유지한다.
  SELECT CASE WHEN p_operation='schedule.save' AND p_input ? 'googlePlaceId' THEN
    CASE WHEN jsonb_typeof(p_input->'googlePlaceId')='string' AND (p_input->>'googlePlaceId'='' OR p_input->>'googlePlaceId' ~ '^[A-Za-z0-9_-]{1,200}$')
      AND wherego_private.validate_command_base(p_operation,p_input-'googlePlaceId') IS NOT NULL
    THEN p_input ELSE wherego_private.fail('VALIDATION_FAILED') END
  ELSE wherego_private.validate_command_base(p_operation,p_input) END;
$$;

ALTER FUNCTION wherego_private.schedule_save(UUID,JSONB) RENAME TO schedule_save_base;
CREATE FUNCTION wherego_private.schedule_save(p_trip UUID,p_input JSONB) RETURNS JSONB LANGUAGE SQL SECURITY DEFINER SET search_path='' AS $$
  -- 기존 권한·부모 검증 일정과 장소 참조를 같은 원자 명령으로 저장한다.
  WITH saved AS MATERIALIZED (SELECT wherego_private.schedule_save_base(p_trip,p_input-'googlePlaceId') AS data),
  attached AS (INSERT INTO wherego_private.itinerary_google_places(schedule_id,place_id)
    SELECT (data->>'id')::uuid,p_input->>'googlePlaceId' FROM saved WHERE coalesce(p_input->>'googlePlaceId','')<>''
    ON CONFLICT(schedule_id) DO UPDATE SET place_id=excluded.place_id RETURNING schedule_id),
  detached AS (DELETE FROM wherego_private.itinerary_google_places WHERE schedule_id IN(SELECT (data->>'id')::uuid FROM saved) AND p_input->>'googlePlaceId'='' RETURNING schedule_id)
  SELECT data FROM saved;
$$;

ALTER FUNCTION public.wherego_workspace(UUID) RENAME TO wherego_workspace_base;
CREATE FUNCTION public.wherego_workspace(p_trip UUID) RETURNS JSONB LANGUAGE SQL STABLE SECURITY DEFINER SET search_path='' AS $$
  -- 기존 멤버 접근 검사 뒤 각 일정에 저장한 장소 ID만 포함한다.
  WITH snapshot AS MATERIALIZED (SELECT public.wherego_workspace_base(p_trip) AS data)
  SELECT jsonb_set(data,'{itinerary}',coalesce((SELECT jsonb_agg(item.value || CASE WHEN place.place_id IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('googlePlaceId',place.place_id) END ORDER BY item.position)
    FROM jsonb_array_elements(data->'itinerary') WITH ORDINALITY AS item(value,position)
    LEFT JOIN wherego_private.itinerary_google_places place ON place.schedule_id=(item.value->>'id')::uuid),'[]'::jsonb)) FROM snapshot;
$$;
REVOKE ALL ON FUNCTION public.wherego_workspace_base(UUID),public.wherego_workspace(UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.wherego_workspace(UUID) TO authenticated;
REVOKE ALL ON FUNCTION wherego_private.validate_command_base(TEXT,JSONB),wherego_private.validate_command(TEXT,JSONB),wherego_private.schedule_save_base(UUID,JSONB),wherego_private.schedule_save(UUID,JSONB) FROM PUBLIC,anon,authenticated;
