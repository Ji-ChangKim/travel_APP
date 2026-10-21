import Text from '@/components/AppText';
import type {
  CommunityPost,
  WorkspaceDay,
  WorkspaceSchedule,
  WorkspaceSnapshot,
} from '@wherego/domain';
import { View } from 'react-native';
import PlanDetailTimelineView from './PlanDetailTimelineView';
import PlanAttachments from './PlanAttachments';
import { adaptCommunityPostToTimeline } from './timelinePlanAdapters';
import { LedgerAction } from './LedgerUI';
import ServerPhoto from './ServerPhoto';
import type { PlanForm } from './forms';
import { ledgerStyles as l } from './ledgerTheme';
import {
  publicationIds,
  togglePublication,
  togglePublicationDay,
} from './publication';
import { travelDateRange } from './travelDateRange';
import { styles } from './workspaceStyles';
// renderPublicationSelection이 읽는 값과 실행 가능한 행동의 계약이다.
type RenderPublicationSelectionProps = {
  mode: string;
  form: PlanForm;
  busy: boolean;
  onChange: (key: string, value: string) => void;
  snapshot: WorkspaceSnapshot;
  userId: string;
  issue: string;
  emptyPlan: boolean;
  preview: Pick<CommunityPost, 'snapshot' | 'photoPaths'> | null;
};

// 공개 선택과 공개 범위 안내를 배치한다.
export function renderPublicationSelection({
  mode,
  form,
  busy,
  onChange,
  snapshot,
  userId,
  issue,
  emptyPlan,
  preview,
}: RenderPublicationSelectionProps) {
  // 전달받은 값과 행동을 기존 화면 규격으로 표시한다.

  return (
    <View style={{ gap: 20 }}>
      {mode !== 'preview' && (
        <>
          {mode === 'both' && (
            <Text style={styles.title}>공개할 내용 선택</Text>
          )}
          <View style={styles.row}>
            <LedgerAction
              label="여행계획 공유"
              selected={form.values.kind === 'plan'}
              disabled={busy}
              onPress={() => {
                // 완료 처리 없이 일차별 계획의 공개 내용을 선택한다.
                return onChange('kind', 'plan');
              }}
            />
            <LedgerAction
              label="여행기록 공유"
              selected={form.values.kind !== 'plan'}
              disabled={busy || snapshot.trip.status !== 'COMPLETED'}
              onPress={() => {
                // 실제 여행기록은 기존 정리 완료 조건을 유지한다.
                return onChange('kind', 'record');
              }}
            />
          </View>
          {form.values.kind === 'plan' && (
            <Text>
              선택한 장소의 계획 설명·추천 메뉴·팁도 함께 공개돼요. 개인적인
              내용은 일정 메모에 남겨 주세요.
            </Text>
          )}
          {snapshot.days.map((day) => {
            // 공개 선택은 실제 DAY와 일정의 저장 관계로 묶는다.
            const items = snapshot.itinerary.filter((item) => {
              // 다른 DAY의 일정과 설명을 섞지 않는다.
              return item.dayId === day.id;
            });
            return items.length
              ? renderPublicationChoices({ day, items, form, busy, onChange })
              : null;
          })}
          {snapshot.media
            .filter((item) => {
              // 영수증 원본은 선택지에서도 제외한다.
              return item.purpose === 'photo';
            })
            .map((item, index) => {
              /* 현재 항목의 표시 또는 선택값만 갱신한다. */ return (
                <View key={item.id} style={l.card}>
                  <ServerPhoto
                    userId={userId}
                    tripId={snapshot.trip.id}
                    mediaId={item.id}
                  />
                  <LedgerAction
                    label={`사진 ${index + 1}`}
                    checked={publicationIds(form.values.photoIds).includes(
                      item.id,
                    )}
                    disabled={busy}
                    onPress={() => {
                      // 일반 사진 하나의 공개 선택만 바꾼다.
                      return onChange(
                        'photoIds',
                        togglePublication(form.values.photoIds || '', item.id),
                      );
                    }}
                  />
                </View>
              );
            })}
          <LedgerAction
            label="여행 전체 실제 지출 합계 공개"
            checked={form.values.includeCosts === 'true'}
            disabled={busy}
            onPress={() => {
              // 예상 비용은 제외하고 실제 지출 공개 여부만 바꾼다.
              return onChange(
                'includeCosts',
                form.values.includeCosts === 'true' ? 'false' : 'true',
              );
            }}
          />
          {issue && (
            <>
              <Text
                accessibilityRole={emptyPlan ? undefined : 'alert'}
                style={emptyPlan ? styles.subtitle : styles.error}
              >
                {issue}
              </Text>
              {!emptyPlan && (
                <LedgerAction
                  label="일정·사진 선택 비우기"
                  disabled={busy}
                  onPress={() => {
                    // 명시적 초기화로 제목·본문·비용 선택은 유지한다.
                    return void (onChange('scheduleIds', ''),
                    onChange('photoIds', ''));
                  }}
                />
              )}
            </>
          )}
        </>
      )}
      {mode !== 'selection' &&
        preview &&
        renderPublicationPreview({ mode, form, preview, snapshot, userId })}
    </View>
  );
}
// renderPublicationPreview이 읽는 값과 실행 가능한 행동의 계약이다.
type RenderPublicationPreviewProps = {
  mode: string;
  form: PlanForm;
  preview: Pick<CommunityPost, 'snapshot' | 'photoPaths'>;
  snapshot: WorkspaceSnapshot;
  userId: string;
};

// 실제 공개 사본의 미리보기를 표시한다.
export function renderPublicationPreview({
  mode,
  form,
  preview,
  snapshot,
  userId,
}: RenderPublicationPreviewProps): import('react').ReactNode {
  // 전달받은 값과 행동을 기존 화면 규격으로 표시한다.

  return (
    <View accessibilityLabel="실제 공개 내용 미리보기" style={{ gap: 20 }}>
      {mode === 'both' && <Text style={styles.title}>공개 내용 미리보기</Text>}
      {form.values.kind !== 'plan' && (
        <Text>
          {preview.snapshot.country} · {preview.snapshot.city}
        </Text>
      )}
      {form.values.kind !== 'plan' && (
        <Text>
          {travelDateRange(
            preview.snapshot.startDate,
            preview.snapshot.endDate,
          )}
        </Text>
      )}
      {mode === 'both' && form.values.kind !== 'plan' && (
        <Text>{snapshot.trip.title}</Text>
      )}
      {form.values.kind !== 'plan' && <Text>{form.values.body}</Text>}
      {form.values.kind === 'plan' && (
        <PlanDetailTimelineView
          showTitle={mode === 'both'}
          key={form.values.scheduleIds}
          embedded
          preview={{ tripId: snapshot.trip.id, userId }}
          extraContent={
            <PlanAttachments
              snapshot={preview.snapshot}
              preview={{
                tripId: snapshot.trip.id,
                userId,
                mediaIds: publicationIds(form.values.photoIds),
              }}
            />
          }
          data={adaptCommunityPostToTimeline(
            {
              id: snapshot.postId || snapshot.trip.id,
              author:
                snapshot.members.find((member) => member.isMe)?.nickname || '',
              title: snapshot.trip.title,
              body: form.values.body || '',
              snapshot: preview.snapshot,
            },
            'footprint',
          )}
        />
      )}
      <Text>
        선택 일정 {preview.snapshot.itinerary.length}개 · 사진{' '}
        {preview.photoPaths.length}장
      </Text>
      {!preview.snapshot.itinerary.length && <Text>공개할 일정이 없어요.</Text>}
      {form.values.kind !== 'plan' &&
        preview.snapshot.itinerary.map((item, index) => {
          /* 현재 항목의 표시 또는 선택값만 갱신한다. */ return (
            <View key={index}>
              <Text>
                {item.date} · {item.timeSlot || '시간 미정'} · {item.title}
              </Text>
              <Text>{item.address || '주소 없음'}</Text>
            </View>
          );
        })}
      {form.values.kind !== 'plan' &&
        publicationIds(form.values.photoIds).map((id) => {
          /* 현재 항목의 표시 또는 선택값만 갱신한다. */ return (
            <ServerPhoto
              key={id}
              userId={userId}
              tripId={snapshot.trip.id}
              mediaId={id}
            />
          );
        })}
      {!preview.photoPaths.length && <Text>공개할 사진이 없어요.</Text>}
      {form.values.kind !== 'plan' &&
        (form.values.includeCosts === 'true' ? (
          Object.entries(preview.snapshot.costs).map(([currency, amount]) => {
            /* 현재 항목의 표시 또는 선택값만 갱신한다. */ return (
              <Text key={currency}>
                공개 실제 비용 · {amount} {currency}
              </Text>
            );
          })
        ) : (
          <Text>비용은 공개하지 않아요.</Text>
        ))}
    </View>
  );
}
// renderPublicationChoices이 읽는 값과 실행 가능한 행동의 계약이다.
type RenderPublicationChoicesProps = {
  day: WorkspaceDay;
  items: WorkspaceSchedule[];
  form: PlanForm;
  busy: boolean;
  onChange: (key: string, value: string) => void;
};

// 공개할 일정과 사진 선택을 표시한다.
export function renderPublicationChoices({
  day,
  items,
  form,
  busy,
  onChange,
}: RenderPublicationChoicesProps): import('react').JSX.Element | null {
  // 전달받은 값과 행동을 기존 화면 규격으로 표시한다.

  return (
    <View key={day.id} style={l.card}>
      <Text style={l.section}>
        DAY {day.dayNumber} · {day.planTitle || day.tripDate}
      </Text>
      <Text style={l.meta}>
        {
          items.filter((item) => {
            // 실제 선택값으로만 공개 건수를 계산한다.
            return publicationIds(form.values.scheduleIds).includes(item.id);
          }).length
        }{' '}
        / {items.length}개 일정 선택
      </Text>
      <LedgerAction
        label={`DAY ${day.dayNumber} 일정 전체 ${items.every((item) => publicationIds(form.values.scheduleIds).includes(item.id)) ? '해제' : '선택'}`}
        disabled={busy}
        onPress={() => {
          // 날짜 단위 명시적 선택은 사진과 비용 공개 선택을 바꾸지 않는다.
          return onChange(
            'scheduleIds',
            togglePublicationDay(
              form.values.scheduleIds || '',
              items.map((item) => item.id),
            ),
          );
        }}
      />
      {items.map((item) => {
        // 다중 선택은 고정 체크 공간과 같은 원본 설명을 사용한다.
        return (
          <View key={item.id} style={l.tinted}>
            <LedgerAction
              label={`일정: ${item.title}`}
              checked={publicationIds(form.values.scheduleIds).includes(
                item.id,
              )}
              disabled={busy}
              onPress={() => {
                // 사용자가 누른 항목만 공개 선택에 반영한다.
                return onChange(
                  'scheduleIds',
                  togglePublication(form.values.scheduleIds || '', item.id),
                );
              }}
            />
            {item.planContent?.description && (
              <Text style={l.meta}>
                {item.planContent.description.slice(0, 160)}
                {item.planContent.description.length > 160 ? '…' : ''}
              </Text>
            )}
            <Text style={l.meta}>
              {item.timeSlot || '시간 미정'} · 개인 메모는 공개하지 않아요.
            </Text>
          </View>
        );
      })}
    </View>
  );
}
