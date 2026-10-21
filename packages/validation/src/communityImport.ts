import { z } from 'zod';
import type { CommunityPost, WorkspaceSnapshot } from '@wherego/domain';
import {
  calendarDateSchema,
  isSupportedTimezone,
  persistedTripCreateSchema,
} from './foundation';
import { communityPostSchema, workspaceSnapshotSchema } from './workspace';
import {
  newTrip,
  WorkspaceModelError,
  type WorkspaceId,
} from './workspaceModel';

// 담는 사람의 여행 시작일과 표시 설정만 입력으로 허용한다.
export const communityImportSchema = z
  .object({
    startDate: calendarDateSchema,
    title: z.string().trim().max(50).optional(),
    timezone: z.string().max(100).refine(isSupportedTimezone),
    defaultCurrency: z.enum(['KRW', 'JPY', 'USD']).default('KRW'),
  })
  .strict();
export type CommunityImportInput = z.infer<typeof communityImportSchema>;

// 공개 기간의 길이를 유지하며 선택한 출발일의 도착일을 계산한다.
export function communityImportEnd(
  post: CommunityPost,
  startDate: string,
): string {
  // 달력 날짜로만 계산해 현지 시각과 일광 절약 시간의 영향을 피한다.
  return shiftedDate(
    startDate,
    dayOffset(post.snapshot.startDate, post.snapshot.endDate),
  );
}

// 공개 내용만 별도 ID·소유권을 가진 편집 가능한 여행으로 변환한다.
export function importCommunityTrip(
  source: CommunityPost,
  values: CommunityImportInput,
  actor: string,
  nickname: string,
  identify: WorkspaceId,
): WorkspaceSnapshot {
  // 원본 객체를 수정하지 않고 공개 계약을 재검증한다.
  const post = communityPostSchema.parse(source);
  if (!post.snapshot.itinerary.length)
    throw new WorkspaceModelError('VALIDATION_FAILED');
  const input = communityImportSchema.parse(values);
  const snapshot = newTrip(
    persistedTripCreateSchema.parse({
      ...input,
      title: input.title || post.title.slice(0, 50),
      country: post.snapshot.country,
      city: post.snapshot.city,
      endDate: communityImportEnd(post, input.startDate),
    }),
    actor,
    nickname,
    identify(),
    identify,
  );
  return workspaceSnapshotSchema.parse({
    ...snapshot,
    days: snapshot.days.map((day) => {
      // 일부 DAY만 공개한 계획도 원래 날짜 간격을 유지한다.
      const published = post.snapshot.days?.find((entry) => {
        // 공개 DAY 번호 대신 실제 날짜와 출발일의 차이를 대조한다.
        return (
          dayOffset(post.snapshot.startDate, entry.date) === day.dayNumber - 1
        );
      });
      return {
        ...day,
        ...(published?.planTitle !== undefined
          ? { planTitle: published.planTitle }
          : {}),
        ...(published?.planConcept !== undefined
          ? { planConcept: published.planConcept }
          : {}),
      };
    }),
    itinerary: post.snapshot.itinerary.map((item, index) => {
      // 개인 메모·결제·사진·항공권 상세는 공개 객체에 있더라도 복사하지 않는다.
      const day = snapshot.days[dayOffset(post.snapshot.startDate, item.date)];
      if (!day) throw new WorkspaceModelError('VALIDATION_FAILED');
      return {
        id: identify(),
        dayId: day.id,
        title: item.title,
        type: item.type || 'PLACE',
        timeSlot: item.timeSlot,
        sortOrder: item.sortOrder || index + 1,
        memo: null,
        address: item.address,
        ...(item.googlePlaceId ? { googlePlaceId: item.googlePlaceId } : {}),
        ...(item.planContent ? { planContent: { ...item.planContent } } : {}),
      };
    }),
  });
}

// 두 달력 날짜 사이의 정수 DAY 간격을 구한다.
function dayOffset(start: string, date: string): number {
  // 음수·범위 밖 값은 호출자의 기간 검증 또는 DAY 조회에서 거부한다.
  return (
    (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) /
    86400000
  );
}

// 출발일에 DAY 간격을 더한 달력 날짜를 만든다.
function shiftedDate(start: string, offset: number): string {
  // 유효하지 않은 입력은 빈 날짜를 만들어 저장하지 않는다.
  return new Date(
    Date.parse(`${calendarDateSchema.parse(start)}T00:00:00Z`) +
      offset * 86400000,
  )
    .toISOString()
    .slice(0, 10);
}
