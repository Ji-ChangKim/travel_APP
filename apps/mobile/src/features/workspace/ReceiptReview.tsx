import Text from '@/components/AppText';
import HaruState from '@/components/HaruState';
import type { WorkspaceSnapshot } from '@wherego/domain';
import { View } from 'react-native';
import { LedgerAction as Action } from './LedgerUI';
import { renderReceiptItems, renderReceiptSummary } from './ReceiptReviewView';
import type { PlanForm } from './forms';
import { ledgerStyles as l } from './ledgerTheme';
import { changedReceiptItem, receiptItems } from './receiptFlow';
import { Field } from './ui';

// 사진에서 인식한 후보를 먼저 보여주고 틀린 항목만 수정하도록 안내한다.
export default function ReceiptReview({
  form,
  snapshot,
  busy,
  onChange,
  onRetry,
  onPhoto,
}: {
  form: PlanForm;
  snapshot: WorkspaceSnapshot;
  busy: boolean;
  onChange: (key: string, value: string) => void;
  onRetry: () => void;
  onPhoto: () => void;
}) {
  // 인식 대기·실패를 자동 등록 가능한 결과와 구분한다.
  return form.values.receiptStatus === 'loading' ? (
    <HaruState
      kind="loading"
      title="영수증을 읽고 있어요"
      description="장소, 결제 일시, 메뉴와 합계를 찾고 있어요."
    />
  ) : form.values.receiptStatus === 'error' ? (
    <HaruState
      kind="error"
      title="영수증을 읽지 못했어요"
      description={
        form.values.receiptError ||
        '글자가 선명하게 보이도록 촬영해 주세요. 원본 사진은 보관되어 있어요.'
      }
    >
      <Action
        label="다시 스캔하기"
        disabled={busy}
        variant="primary"
        onPress={onRetry}
      />
      <Action label="다른 영수증 사진 선택" disabled={busy} onPress={onPhoto} />
      <Action
        label="직접 입력으로 계속"
        disabled={busy}
        variant="quiet"
        onPress={() => {
          // 사용자가 선택한 경우에만 수동 입력을 제공한다.
          return onChange('receiptStatus', 'manual');
        }}
      />
    </HaruState>
  ) : (
    <>
      {renderReceiptSummary({ form, snapshot, busy, onChange, onRetry })}
      {(form.values.receiptEditing === 'true' ||
        form.values.receiptStatus === 'manual') &&
        renderReceiptItems({ form, onChange })}
      <View style={l.card}>
        <Text style={l.section}>메뉴·구매 내역</Text>
        {receiptItems(form.values.items).length === 0 && (
          <Text>메뉴를 읽지 못했어요. 원본 사진을 확인해 주세요.</Text>
        )}
        {receiptItems(form.values.items).map((item, index) => (
          <View key={index} style={{ gap: 6, paddingVertical: 8 }}>
            <Text style={l.section}>{item.name}</Text>
            <Text>
              {item.quantity === null ? '수량 확인 필요' : `${item.quantity}개`}{' '}
              · 단가 {item.unitPrice || '확인 필요'} · 금액{' '}
              {item.amount || '확인 필요'} {form.values.currency}
            </Text>
            {form.values.receiptEditing === 'true' &&
              ['name', 'quantity', 'unitPrice', 'amount'].map((key) => (
                <Field
                  key={key}
                  label={`${index + 1}번 메뉴 ${{ name: '이름', quantity: '수량', unitPrice: '단가', amount: '금액' }[key]}`}
                  value={String(item[key as keyof typeof item] ?? '')}
                  onChange={(value) => {
                    // 해당 메뉴의 선택 필드만 고친다.
                    return onChange(
                      'items',
                      changedReceiptItem(
                        form.values.items || '[]',
                        index,
                        key,
                        value,
                      ),
                    );
                  }}
                />
              ))}
          </View>
        ))}
      </View>
    </>
  );
}
