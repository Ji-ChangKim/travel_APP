import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { communityPostSchema } from '@wherego/validation';
import { requestSignal } from '@wherego/api-client';
import HaruState from '@/components/HaruState';
import { Action } from './ui';
import { apiBaseUrl } from './service';
import { adaptCommunityPostToTimeline } from './timelinePlanAdapters';
import PlanDetailTimelineView from './PlanDetailTimelineView';
import PublicPlanExecution from './PublicPlanExecution';
import PlanAttachments from './PlanAttachments';

// 실제 DB에 승인 등록된 북큐슈 추천 일정의 공식 UUID다.
const DEFAULT_CURATED_POST_ID = 'dac90238-8825-4359-93b1-bd43c946f757';

// 실제 DB에 등록된 추천 여행 코스를 조회해 테마 최적 동선으로 렌더링한다.
export default function CuratedPlanDetailScreen() {
  // 경로 매개변수로 지정된 추천 계획 ID 또는 기본 공식 추천 일정을 조회한다.
  const params = useLocalSearchParams<{ planId?: string }>();
  const postId = params.planId || DEFAULT_CURATED_POST_ID;

  // 추천 계획 DB 데이터를 조회한다.
  const query = useQuery({
    queryKey: ['curated-recommendation-timeline', postId],
    queryFn: ({ signal }) => {
      // 서버의 공개 게시물 엔드포인트에서 실제 등록된 추천 여행을 읽는다.
      return fetch(
        `${apiBaseUrl()}/public/community/${encodeURIComponent(postId)}`,
        { signal: requestSignal(signal) },
      ).then(parseCuratedResponse);
    },
    retry: false,
  });

  // 추천 코스를 내 여행으로 바로 생성하는 훅을 연결한다.

  // 로딩 상태를 표시한다.
  if (query.isPending) {
    return (
      <HaruState kind="loading" title="추천 여행 코스를 불러오는 중이에요." />
    );
  }

  // 오류 상태를 처리한다.
  if (query.isError || !query.data) {
    return (
      <HaruState
        kind="error"
        title="추천 여행을 불러오지 못했어요"
        description="연결 상태를 확인하고 다시 시도해 주세요."
      >
        <Action
          label="다시 불러오기"
          loading={query.isFetching}
          onPress={() => query.refetch()}
        />
      </HaruState>
    );
  }

  // 실제 DB 객체를 테마 추천 타임라인 모델로 변환한다.
  const timelineData = adaptCommunityPostToTimeline(query.data, 'curated');

  return (
    <PlanDetailTimelineView
      data={timelineData}
      bottomAction={
        <PublicPlanExecution title={query.data.title} postId={postId} />
      }
      extraContent={
        <PlanAttachments
          snapshot={query.data.snapshot}
          photoPaths={query.data.photoPaths}
        />
      }
    />
  );
}

// 추천 게시물 응답을 파싱하고 검증한다.
async function parseCuratedResponse(response: Response) {
  // Zod 검증을 거친 실제 데이터만 반환한다.
  return response.ok
    ? z.object({ data: communityPostSchema }).parse(await response.json()).data
    : Promise.reject(new Error('추천 일정을 불러오지 못했어요.'));
}
