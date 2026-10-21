import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { communityPostSchema, foundationUuidSchema } from '@wherego/validation';
import { requestSignal } from '@wherego/api-client';
import HaruState from '@/components/HaruState';
import { Action } from './ui';
import { apiBaseUrl } from './service';
import { adaptCommunityPostToTimeline } from './timelinePlanAdapters';
import PlanDetailTimelineView from './PlanDetailTimelineView';
import PublicPlanExecution from './PublicPlanExecution';
import PlanAttachments from './PlanAttachments';

// 실제 커뮤니티 공개 DB에서 발자국 계획을 조회해 일정 없는 타임라인으로 렌더링한다.
export default function FootprintPlanDetailScreen() {
  // 경로 매개변수에서 공개 게시물 ID를 읽는다.
  const { postId = '' } = useLocalSearchParams<{ postId?: string }>();

  // 유효한 UUID인지 검증한다.
  const validId = foundationUuidSchema.safeParse(postId).success;

  // 공개 커뮤니티 게시물 DB를 조회한다.
  const query = useQuery({
    queryKey: ['public-community-post-timeline', postId],
    enabled: validId,
    queryFn: ({ signal }) => {
      // 서버의 실제 공개 게시물 엔드포인트에서 데이터를 조회한다.
      return fetch(
        `${apiBaseUrl()}/public/community/${encodeURIComponent(postId)}`,
        { signal: requestSignal(signal) },
      ).then(parseCommunityPost);
    },
    retry: false,
  });

  // 일정 담기 훅을 연결한다.

  // 로딩 상태를 표시한다.
  if (query.isPending && validId) {
    return (
      <HaruState
        kind="loading"
        title="공개된 발자국 여행을 불러오는 중이에요."
      />
    );
  }

  // 오류 상태를 처리한다.
  if (!validId || query.isError || !query.data) {
    return (
      <HaruState
        kind="error"
        title="발자국 여행을 불러오지 못했어요"
        description="네트워크 연결을 확인하거나 발자국 탭에서 다른 여행을 둘러보세요."
      >
        {validId && (
          <Action
            label="다시 불러오기"
            loading={query.isFetching}
            onPress={() => query.refetch()}
          />
        )}
      </HaruState>
    );
  }

  // 실제 DB 객체를 일정 없는 발자국 타임라인 모델로 변환한다.
  const timelineData = adaptCommunityPostToTimeline(query.data, 'footprint');

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

// 공개 게시물 응답을 검증하고 파싱한다.
async function parseCommunityPost(response: Response) {
  // 정상 응답만 Zod 스키마로 검증해 반환한다.
  return response.ok
    ? z.object({ data: communityPostSchema }).parse(await response.json()).data
    : Promise.reject(new Error('공개 여행을 찾을 수 없어요.'));
}
