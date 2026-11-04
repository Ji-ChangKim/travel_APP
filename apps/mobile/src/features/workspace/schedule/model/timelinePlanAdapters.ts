import type { CommunityPost, WorkspaceSnapshot } from '@wherego/domain';
import type {
  TimelineDayGroup,
  TimelinePlanModel,
  TimelineScheduleItem,
} from './timelinePlanTypes';

// 여행 기간의 박·일 문자열을 계산한다.
export function calculateDurationDays(
  startDate: string,
  endDate: string,
): {
  nights: number;
  days: number;
} {
  // UTC 기준 시작일과 종료일 차이로 달력 일수를 계산한다.
  const diffTime = Math.abs(
    Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`),
  );
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  const nights = Math.max(0, diffDays - 1);
  return { nights, days: diffDays };
}

// 실제 내 여행 DB 스냅샷을 나의 계획 타임라인 모델로 변환한다.
export function adaptWorkspaceSnapshotToTimeline(
  snapshot: WorkspaceSnapshot,
): TimelinePlanModel {
  // 실제 확정된 여행 기간과 박수를 계산한다.
  const { nights, days: totalDays } = calculateDurationDays(
    snapshot.trip.startDate,
    snapshot.trip.endDate,
  );

  // 일자별 스케줄과 타임라인 노드를 조립한다.
  const days: TimelineDayGroup[] = snapshot.days.map((day) => {
    // 해당 DAY에 속한 일정만 정렬 순서대로 추출한다.
    const daySchedules = snapshot.itinerary
      .filter((item) => item.dayId === day.id)
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

    // 일정 아이템을 타임라인 항목 규격으로 매핑한다.
    const schedules: TimelineScheduleItem[] = daySchedules.map((item) => {
      // 항공편 연결 여부를 우선 확인한다.
      const isFlight = Boolean(item.flight);
      return {
        id: item.id,
        sortOrder: item.sortOrder,
        type: item.type,
        title: item.title,
        timeSlot: item.timeSlot,
        address: item.address,
        memo: item.memo,
        planContent: item.planContent,
        badgeLabel: isFlight
          ? '항공편'
          : item.type === 'TRANSPORT'
            ? '이동'
            : item.type === 'STAY'
              ? '숙소'
              : '일정',
        flightInfo: isFlight
          ? {
              carrier: item.flight?.number || '항공편',
              flightNumber: item.flight?.number || '',
              departureAirport: item.flight?.departure || '',
              arrivalAirport: item.flight?.arrival || '',
            }
          : undefined,
      };
    });

    // DAY 탭 라벨에 실제 달력 날짜(MM.DD)를 포함한다.
    const dateFormatted = `${Number(day.tripDate.slice(5, 7))}.${Number(day.tripDate.slice(8))}`;

    return {
      id: day.id,
      city: snapshot.trip.destinations?.find(
        (item) => item.id === day.destinationId,
      )?.city,
      dayNumber: day.dayNumber,
      dateText: day.tripDate,
      tabLabel: `DAY ${day.dayNumber} (${dateFormatted})`,
      planTitle: day.planTitle || `DAY ${day.dayNumber} 여행 일정`,
      planConcept: day.planConcept || '일정에 장소와 메모를 추가해보세요.',
      schedules,
      routeSummary: {
        placeCount: schedules.filter((s) => s.type === 'PLACE').length,
        routePathText:
          schedules
            .map((s) => s.title)
            .slice(0, 4)
            .join(' → ') || '등록된 장소 동선',
      },
    };
  });

  return {
    id: snapshot.trip.id,
    revision: snapshot.trip.version,
    mode: 'my',
    title: snapshot.trip.title,
    country: snapshot.trip.country,
    city: snapshot.trip.city,
    periodText: `${snapshot.trip.startDate} - ${snapshot.trip.endDate}`,
    badgeStepText: '내 여행계획',
    badgeDurationText: `${nights}박 ${totalDays}일`,
    guideDescription: `선택한 일정에 따라 ${days.length}개의 DAY가 생성되었습니다. 장소와 메모를 추가해보세요.`,
    executionCtaLabel: '여행 일정 열기',
    days,
  };
}

// 공개 사본의 날짜·장소·소개를 타임라인 표시 모델로 변환한다.
export function adaptCommunityPostToTimeline(
  post: Pick<CommunityPost, 'id' | 'title' | 'body' | 'author' | 'snapshot'> & {
    publishedAt?: string;
  },
  mode: 'footprint' | 'curated',
): TimelinePlanModel {
  // 원본의 기간 일수를 계산한다.
  const { nights, days: totalDays } = calculateDurationDays(
    post.snapshot.startDate,
    post.snapshot.endDate,
  );

  // 선택 공개한 DAY 번호와 날짜만 사용한다.
  const days: TimelineDayGroup[] = (post.snapshot.days || []).map((day) => {
    // 해당 DAY 번호의 일정들을 추출하고 정렬한다.
    const daySchedules = post.snapshot.itinerary
      .filter((item) => item.dayNumber === day.dayNumber)
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

    // 스케줄 항목을 모드별 성격에 맞추어 변환한다.
    const schedules: TimelineScheduleItem[] = daySchedules.map(
      (item, index) => {
        // 입력하지 않은 방문 시간을 추천 시각으로 만들어 채우지 않는다.
        const timeSlotText = item.timeSlot || undefined;

        return {
          id: item.id || `schedule-${day.dayNumber}-${index}`,
          sortOrder: item.sortOrder || index + 1,
          type: item.type || 'PLACE',
          title: item.title,
          timeSlot: timeSlotText,
          address: item.address,
          planContent: item.planContent,
          googlePlaceId: item.googlePlaceId,
          badgeLabel:
            item.type === 'TRANSPORT'
              ? '이동'
              : item.type === 'STAY'
                ? '숙소'
                : '일정',
        };
      },
    );

    // 탭 라벨에는 특정 날짜를 넣지 않고 순수 차수만 표시한다.
    const tabLabel =
      mode === 'curated'
        ? `DAY ${day.dayNumber}`
        : `DAY ${day.dayNumber} (${day.dayNumber}일차)`;

    return {
      id: `day-${day.dayNumber}`,
      city: post.snapshot.destinations?.find(
        (item) => item.id === day.destinationId,
      )?.city,
      travelLegs: post.snapshot.travelLegs?.filter(
        (leg) =>
          daySchedules.some((item) => item.id === leg.fromScheduleId) &&
          daySchedules.some((item) => item.id === leg.toScheduleId),
      ),
      dayNumber: day.dayNumber,
      dateText: day.date,
      tabLabel,
      planTitle: day.planTitle || `DAY ${day.dayNumber} 여행계획`,
      planConcept: day.planConcept || '',
      schedules,
      routeSummary: {
        placeCount: schedules.filter((s) => s.type === 'PLACE').length,
        routePathText:
          schedules
            .map((s) => s.title)
            .slice(0, 4)
            .join(' → ') || '추천 동선',
      },
    };
  });

  // 발자국 모드와 추천 모드의 문구 및 CTA를 차별화한다.
  const isCurated = mode === 'curated';

  return {
    id: post.id,
    revision: post.publishedAt,
    mode,
    title: post.title,
    country: post.snapshot.country,
    city: post.snapshot.city,
    periodText: `${post.snapshot.startDate} - ${post.snapshot.endDate}`,
    badgeStepText: isCurated ? '에디터 픽 · 테마 코스' : '공개된 여행계획',
    badgeDurationText: `${nights}박 ${totalDays}일`,
    guideDescription: post.body || '',
    authorName: post.author,
    executionCtaLabel: isCurated
      ? '이 코스로 내 여행 만들기'
      : '내 여행으로 일정 담기',
    days,
  };
}
