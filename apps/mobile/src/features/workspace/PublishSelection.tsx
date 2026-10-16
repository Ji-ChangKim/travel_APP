import Text from '@/components/AppText';
import { travelDateRange } from './travelDateRange';
import { View } from 'react-native';
import type { WorkspaceSnapshot } from '@wherego/domain';
import { Action, ServerPhoto, styles } from './ui';
import type { PlanForm } from './forms';
import CommunityPlanView from './CommunityPlanView';
import {
  publicationIds,
  publicationIssue,
  publicationPreview,
  togglePublication,
} from './publication';

// 공개 선택과 실제 게시될 일정·사진·통화별 비용을 함께 보여 준다.
export default function PublishSelection({
  form,
  snapshot,
  userId,
  busy,
  onChange,
}: {
  form: PlanForm;
  snapshot: WorkspaceSnapshot;
  userId: string;
  busy: boolean;
  onChange: (key: string, value: string) => void;
}) {
  // 원본에서 비공개 필드를 제거하는 서버 투영을 그대로 사용한다.
  const preview = publicationPreview(snapshot, form.values);
  // 삭제된 선택은 작성한 제목과 본문을 유지하며 다시 고르게 한다.
  const issue = publicationIssue(snapshot, form.values);
  // 미리보기와 선택지는 같은 최신 원본을 따른다.
  return (
    <View style={styles.card}>
      <Text style={styles.title}>공개할 내용 선택</Text>
      <View style={styles.row}>
        <Action
          label="여행계획 공유"
          selected={form.values.kind === 'plan'}
          disabled={busy}
          onPress={() => {
            // 완료 처리 없이 일차별 계획의 공개 내용을 선택한다.
            return onChange('kind', 'plan');
          }}
        />
        <Action
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
          선택한 장소의 계획 설명·추천 메뉴·팁도 함께 공개돼요. 개인적인 내용은
          일정 메모에 남겨 주세요.
        </Text>
      )}
      <Text>
        영수증 원본, 구매 품목, 비공개 메모와 동행 정보는 공개되지 않아요.
        비용을 선택하면 여행 전체의 실제 지출 합계가 통화별로 공개돼요.
      </Text>
      {snapshot.itinerary.map((item) => (
        <Action
          key={item.id}
          label={`${publicationIds(form.values.scheduleIds).includes(item.id) ? '✓ ' : ''}일정: ${item.title}`}
          disabled={busy}
          onPress={() => {
            // 사용자가 선택한 일정만 공개한다.
            return onChange(
              'scheduleIds',
              togglePublication(form.values.scheduleIds || '', item.id),
            );
          }}
        />
      ))}
      {snapshot.media
        .filter((item) => {
          // 영수증 원본은 선택지에서도 제외한다.
          return item.purpose === 'photo';
        })
        .map((item, index) => (
          <Action
            key={item.id}
            label={`${publicationIds(form.values.photoIds).includes(item.id) ? '✓ ' : ''}사진 ${index + 1}`}
            disabled={busy}
            onPress={() => {
              // 일반 사진 하나의 공개 선택만 바꾼다.
              return onChange(
                'photoIds',
                togglePublication(form.values.photoIds || '', item.id),
              );
            }}
          />
        ))}
      <Action
        label={`${form.values.includeCosts === 'true' ? '✓ ' : ''}실제 비용 합계 공개`}
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
          <Text accessibilityRole="alert" style={styles.error}>
            {issue}
          </Text>
          <Action
            label="일정·사진 선택 비우기"
            disabled={busy}
            onPress={() => {
              // 명시적 초기화로 제목·본문·비용 선택은 유지한다.
              return void (onChange('scheduleIds', ''),
              onChange('photoIds', ''));
            }}
          />
        </>
      )}
      {preview && (
        <View accessibilityLabel="실제 공개 내용 미리보기" style={styles.card}>
          <Text style={styles.title}>공개 내용 미리보기</Text>
          <Text>
            {preview.snapshot.country} · {preview.snapshot.city}
          </Text>
          {form.values.kind !== 'plan' && (
            <Text>
              {travelDateRange(
                preview.snapshot.startDate,
                preview.snapshot.endDate,
              )}
            </Text>
          )}
          {form.values.kind !== 'plan' && <Text>{form.values.title}</Text>}
          {form.values.kind !== 'plan' && <Text>{form.values.body}</Text>}
          {form.values.kind === 'plan' && (
            <CommunityPlanView
              key={form.values.scheduleIds}
              post={{
                title: form.values.title || '',
                body: form.values.body || '',
                snapshot: preview.snapshot,
              }}
            />
          )}
          <Text>
            선택 일정 {preview.snapshot.itinerary.length}개 · 사진{' '}
            {preview.photoPaths.length}장
          </Text>
          {!preview.snapshot.itinerary.length && (
            <Text>공개할 일정이 없어요.</Text>
          )}
          {form.values.kind !== 'plan' &&
            preview.snapshot.itinerary.map((item, index) => (
              <View key={index}>
                <Text>
                  {item.date} · {item.timeSlot || '시간 미정'} · {item.title}
                </Text>
                <Text>{item.address || '주소 없음'}</Text>
              </View>
            ))}
          {publicationIds(form.values.photoIds).map((id) => (
            <ServerPhoto
              key={id}
              userId={userId}
              tripId={snapshot.trip.id}
              mediaId={id}
            />
          ))}
          {!preview.photoPaths.length && <Text>공개할 사진이 없어요.</Text>}
          {form.values.includeCosts === 'true' ? (
            Object.entries(preview.snapshot.costs).map(([currency, amount]) => (
              <Text key={currency}>
                공개 실제 비용 · {amount} {currency}
              </Text>
            ))
          ) : (
            <Text>비용은 공개하지 않아요.</Text>
          )}
        </View>
      )}
    </View>
  );
}
