import Text from '@/components/AppText';
import type { WorkspaceSnapshot } from '@wherego/domain';
import { View } from 'react-native';
import type { PlanForm } from './forms';
import { publicationPreview } from './publication';
import { ledgerStyles as l } from './ledgerTheme';

export default function PublishSummary({
  form,
  snapshot,
}: {
  form: PlanForm;
  snapshot: WorkspaceSnapshot;
}) {
  const chosen = publicationPreview(snapshot, form.values);
  return (
    <View style={[l.card, { width: 300 }]}>
      <Text style={l.section}>공개 범위 요약</Text>
      <Text style={l.place}>{snapshot.trip.title}</Text>
      <Text style={l.meta}>
        선택 일정 {chosen?.snapshot.itinerary.length || 0}개 · 사진{' '}
        {chosen?.photoPaths.length || 0}장
      </Text>
      {form.values.body ? <Text style={l.body}>{form.values.body}</Text> : null}
      <View style={l.tinted}>
        <Text style={l.body}>
          개인 메모·예약번호·동행 정보·영수증 원본과 품목은 공개하지 않아요.
        </Text>
      </View>
      <Text style={l.section}>공개 지출</Text>
      {form.values.includeCosts === 'true' &&
      chosen &&
      Object.entries(chosen.snapshot.costs).length ? (
        Object.entries(chosen.snapshot.costs).map(([currency, amount]) => {
          // 원화 환산이나 예시 비용 없이 선택된 실제 통화 합계만 표시한다.
          return (
            <Text key={currency} style={l.body}>
              {currency} {amount}
            </Text>
          );
        })
      ) : (
        <Text style={l.meta}>공개할 지출 합계가 없어요.</Text>
      )}
      <Text style={l.meta}>
        미리보기에서 내용을 확인한 뒤 공개해 주세요. 원본을 수정해도 공개 사본이
        자동으로 바뀌지는 않아요.
      </Text>
    </View>
  );
}
