import Text from '@/components/AppText';
import type { WorkspaceSnapshot } from '@wherego/domain';
import { receiptDuplicateReview } from '@wherego/validation';
import { useState } from 'react';
import { View } from 'react-native';
import type { PlanForm } from './forms';
import { LedgerAction } from './LedgerUI';
import { ledgerStyles as l } from './ledgerTheme';
import ReceiptDetails from './ReceiptDetails';

// 비교는 같은 폼에서 열어 입력을 보존하고 확정 중복과 유사 후보를 구분한다.
export default function ReceiptDuplicates({
  form,
  snapshot,
  busy,
  onChange,
}: {
  form: PlanForm;
  snapshot: WorkspaceSnapshot;
  busy: boolean;
  onChange: (key: string, value: string) => void;
}) {
  const [opened, setOpened] = useState('');
  const review = receiptDuplicateReview(snapshot, form.id, form.values);
  if (review.exact)
    return (
      <View style={l.card}>
        <Text style={l.section}>이미 등록한 영수증이에요</Text>
        <Text>
          같은 원본으로 새 결제를 만들 수 없어요. 기존 기록을 확인한 뒤 돌아가
          주세요.
        </Text>
        <ReceiptDetails receipt={review.exact} />
      </View>
    );
  if (!review.candidates.length) return null;
  return (
    <View style={l.card}>
      <Text style={l.section}>비슷한 결제 기록이 있어요</Text>
      {review.candidates.map((candidate) => (
        <View key={candidate.id} style={{ gap: 12 }}>
          <Text>
            {candidate.title} · {candidate.date}
          </Text>
          <Text>
            {candidate.amount} {candidate.currency}
          </Text>
          <Text style={l.meta}>{candidate.reason}</Text>
          <LedgerAction
            label={
              opened === candidate.id ? '기존 기록 접기' : '기존 기록 보기'
            }
            disabled={busy}
            onPress={() =>
              setOpened(opened === candidate.id ? '' : candidate.id)
            }
          />
          {opened === candidate.id &&
            (candidate.kind === 'receipt' ? (
              <ReceiptDetails
                receipt={snapshot.receipts.find(
                  (item) => item.id === candidate.id,
                )!}
              />
            ) : (
              <Text>
                직접 입력한 실제 지출이에요. 이 화면에서는 기존 지출을 바꾸거나
                삭제하지 않아요.
              </Text>
            ))}
        </View>
      ))}
      <LedgerAction
        label="별도 결제로 계속"
        disabled={busy}
        selected={form.values.duplicateAccepted === review.fingerprint}
        onPress={() => onChange('duplicateAccepted', review.fingerprint)}
      />
      <Text style={l.meta}>
        같은 결제라면 등록을 취소해 주세요. 별도 결제로 저장해도 기존 기록은
        유지돼요.
      </Text>
    </View>
  );
}
