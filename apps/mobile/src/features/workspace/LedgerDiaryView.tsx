import Text from '@/components/AppText';
import type {
  WorkspaceMedia,
  WorkspaceSchedule,
  WorkspaceSnapshot,
} from '@wherego/domain';
import { type ImperativeRouter } from 'expo-router';
import { type Dispatch, type SetStateAction } from 'react';
import { View } from 'react-native';
import { LedgerAction } from './LedgerUI';
import PlanDescription from './PlanDescription';
import ReceiptDetails from './ReceiptDetails';
import ServerPhoto from './ServerPhoto';
import { diaryCosts, diarySchedules } from './diary';
import { ledgerStyles as s } from './ledgerTheme';
import { travelDateRange } from './travelDateRange';
// renderDiaryContent이 읽는 값과 실행 가능한 행동의 계약이다.
type RenderDiaryContentProps = {
  snapshot: WorkspaceSnapshot;
  details: {
    photos: WorkspaceMedia[];
    schedules: number;
    places: number;
    receipts: number;
  };
  filter: string;
  setFilter: Dispatch<SetStateAction<string>>;
  wide: boolean;
  userId: string;
  canEdit: boolean;
  router: ImperativeRouter;
};

// 여행 기록 타임라인과 요약 영역을 배치한다.
export function renderDiaryContent({
  snapshot,
  details,
  filter,
  setFilter,
  wide,
  userId,
  canEdit,
  router,
}: RenderDiaryContentProps) {
  // 전달받은 값과 행동을 기존 화면 규격으로 표시한다.

  return (
    <>
      <View style={s.tinted}>
        <Text style={s.meta}>
          {travelDateRange(snapshot.trip.startDate, snapshot.trip.endDate)}
        </Text>
        <View style={s.row}>
          <Text style={s.body}>기록 장소 {details.places}곳</Text>
          <Text style={s.body}>사진 {details.photos.length}장</Text>
          <Text style={s.body}>영수증 {details.receipts}장</Text>
        </View>
        {diaryCosts(snapshot.expenses).map((cost) => {
          // 실제 지출만 통화별로 요약한다.
          return (
            <Text key={cost.currency} style={s.place}>
              {cost.currency} {cost.amount}
            </Text>
          );
        })}
        <Text style={s.meta}>
          원본은 나와 동행자만 볼 수 있어요. 직접 고른 내용만 발견에 공개돼요.
        </Text>
      </View>
      <View style={s.row}>
        {[
          ['all', '전체 기록'],
          ['photos', '사진 모아보기'],
          ['costs', '지출 내역'],
        ].map(([value, label]) => {
          // 화면 유형 선택을 실제 원본 배열에 적용한다.
          return (
            <LedgerAction
              key={value}
              label={label!}
              selected={filter === value}
              onPress={() => {
                // 현재 여행의 읽기 유형만 바꾼다.
                return setFilter(value!);
              }}
            />
          );
        })}
      </View>
      <View
        style={{
          flexDirection: wide ? 'row' : 'column',
          gap: 24,
          alignItems: 'flex-start',
        }}
      >
        {renderDiaryTimeline({
          filter,
          snapshot,
          details,
          userId,
          canEdit,
          router,
          wide,
        })}
        {wide && (
          <View style={[s.tinted, { width: 280 }]}>
            <Text style={s.section}>여행 기록 요약</Text>
            <Text style={s.body}>
              {snapshot.days.length}일 · 일정 {snapshot.itinerary.length}개
            </Text>
            <Text style={s.meta}>
              사진 {details.photos.length}장 · 영수증 {details.receipts}장
            </Text>
            <Text style={s.meta}>
              {snapshot.postId
                ? '발견에 공개 사본이 있어요. 원본 수정은 자동 공개되지 않아요.'
                : '아직 발견에 공개하지 않은 원본이에요.'}
            </Text>
          </View>
        )}
      </View>
      <View style={s.card}>
        <LedgerAction
          label="여행 경비 요약"
          onPress={() => {
            // 같은 여행의 실제 비용 화면을 연다.
            return router.push(`/trips/${snapshot.trip.id}?section=expenses`);
          }}
        />
        {canEdit && (
          <LedgerAction
            label="일정·기록 보완"
            onPress={() => {
              // 일정이 없으면 실제 일정 작성으로 연결한다.
              return router.push(`/trips/${snapshot.trip.id}`);
            }}
          />
        )}
        {snapshot.myRole === 'owner' && snapshot.trip.status !== 'ARCHIVED' && (
          <LedgerAction
            label="공유할 내용 선택"
            primary
            onPress={() => {
              // 공유는 기존 범위 선택/확정 절차를 유지한다.
              return router.push(`/trips/${snapshot.trip.id}?section=share`);
            }}
          />
        )}
      </View>
    </>
  );
}
// renderDiaryTimeline이 읽는 값과 실행 가능한 행동의 계약이다.
type RenderDiaryTimelineProps = {
  filter: string;
  snapshot: WorkspaceSnapshot;
  details: {
    photos: WorkspaceMedia[];
    schedules: number;
    places: number;
    receipts: number;
  };
  userId: string;
  canEdit: boolean;
  router: ImperativeRouter;
  wide: boolean;
};

// 선택한 기록 필터의 날짜별 타임라인을 표시한다.
export function renderDiaryTimeline({
  filter,
  snapshot,
  details,
  userId,
  canEdit,
  router,
  wide,
}: RenderDiaryTimelineProps) {
  // 전달받은 값과 행동을 기존 화면 규격으로 표시한다.

  return (
    <View style={{ flex: 1, width: '100%', gap: 20, minWidth: 0 }}>
      {filter === 'all' &&
        snapshot.days.map((day) => {
          // 날짜와 DAY ID를 보존해 해당 기록만 묶는다.
          const schedules = diarySchedules(snapshot.itinerary, day.id);
          return (
            <View key={day.id} style={{ gap: 16 }}>
              <View style={s.row}>
                <Text accessibilityRole="header" style={s.section}>
                  DAY {day.dayNumber}
                </Text>
                <Text style={s.meta}>
                  {day.tripDate} · {schedules.length}개 장소·일정
                </Text>
              </View>
              {day.planTitle && <Text style={s.place}>{day.planTitle}</Text>}
              {day.planConcept && <Text style={s.body}>{day.planConcept}</Text>}
              {!schedules.length && (
                <Text style={s.meta}>이날 등록한 일정이 없어요.</Text>
              )}
              {schedules.map((item) => {
                // 기록 카드는 예약/메모/실제 비용의 원본 관계를 유지한다.
                const photos = details.photos.filter((photo) => {
                  // 해당 일정에 연결한 사진만 표시한다.
                  return photo.scheduleId === item.id;
                });
                return renderDiaryStop({
                  item,
                  photos,
                  userId,
                  snapshot,
                  canEdit,
                  router,
                });
              })}
            </View>
          );
        })}
      {filter === 'photos' && (
        <>
          {!details.photos.length && (
            <Text style={s.meta}>아직 등록한 여행 사진이 없어요.</Text>
          )}
          <View style={s.row}>
            {details.photos.map((photo) => {
              // 실제 사진만 모아보며 원본 권한은 그대로 검사한다.
              return (
                <View
                  key={photo.id}
                  style={{ width: wide ? '46%' : '100%', flexGrow: 1 }}
                >
                  <ServerPhoto
                    userId={userId}
                    tripId={snapshot.trip.id}
                    mediaId={photo.id}
                  />
                </View>
              );
            })}
          </View>
        </>
      )}
      {filter === 'costs' && (
        <>
          {!snapshot.expenses.some((expense) => {
            // 예상 지출만 있으면 실제 지출 없음으로 표시한다.
            return expense.isActual;
          }) && <Text style={s.meta}>기록한 실제 지출이 없어요.</Text>}
          {snapshot.expenses
            .filter((expense) => {
              // 결제 확정된 비용만 기록 필터에 포함한다.
              return expense.isActual;
            })
            .map((expense) => {
              // 같은 영수증의 자동 지출을 중복 계산하지 않는다.
              return (
                <View key={expense.id} style={s.card}>
                  <Text style={s.place}>{expense.title}</Text>
                  <Text style={s.body}>
                    {expense.currency} {expense.amount}
                  </Text>
                </View>
              );
            })}
        </>
      )}
    </View>
  );
}
// renderDiaryStop이 읽는 값과 실행 가능한 행동의 계약이다.
type RenderDiaryStopProps = {
  item: WorkspaceSchedule;
  photos: WorkspaceMedia[];
  userId: string;
  snapshot: WorkspaceSnapshot;
  canEdit: boolean;
  router: ImperativeRouter;
};

// 일정별 기록·사진·지출 요약을 표시한다.
export function renderDiaryStop({
  item,
  photos,
  userId,
  snapshot,
  canEdit,
  router,
}: RenderDiaryStopProps): import('react').JSX.Element {
  // 전달받은 값과 행동을 기존 화면 규격으로 표시한다.

  return (
    <View key={item.id} style={s.card}>
      <Text style={s.eyebrow}>{item.timeSlot || '시간 미정'}</Text>
      <Text accessibilityRole="header" style={s.section}>
        {item.title}
      </Text>
      {item.address && <Text style={s.meta}>{item.address}</Text>}
      <View style={[s.row, { flexWrap: 'nowrap' }]}>
        {photos.slice(0, 3).map((photo) => {
          // 영수증을 일반 여행 사진으로 보여주지 않는다.
          return (
            <View key={photo.id} style={{ flex: 1, minWidth: 0 }}>
              <ServerPhoto
                userId={userId}
                tripId={snapshot.trip.id}
                mediaId={photo.id}
              />
            </View>
          );
        })}
      </View>
      {item.memo && (
        <View style={s.private}>
          <Text style={s.eyebrow}>나와 동행자만 보는 메모</Text>
          <Text style={s.body}>{item.memo}</Text>
        </View>
      )}
      <PlanDescription
        title={item.title}
        address={item.address}
        content={item.planContent}
      />
      {snapshot.receipts
        .filter((receipt) => {
          // 연결된 실제 영수증만 보여준다.
          return receipt.scheduleId === item.id;
        })
        .map((receipt) => {
          // 상세 품목은 멤버 원본에만 남긴다.
          return (
            <View key={receipt.id} style={s.tinted}>
              <Text style={s.body}>
                {receipt.merchant} · {receipt.currency} {receipt.amount}
              </Text>
              <ReceiptDetails receipt={receipt} />
            </View>
          );
        })}
      {canEdit && (
        <LedgerAction
          label={`사진·메모 보완: ${item.title}`}
          onPress={() => {
            // 기록 전용 편집도 같은 일정 ID로 저장한다.
            return router.push(
              `/record/${snapshot.trip.id}?scheduleId=${item.id}`,
            );
          }}
        />
      )}
    </View>
  );
}
