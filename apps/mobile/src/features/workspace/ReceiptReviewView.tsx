import Text from '@/components/AppText';
import type { WorkspaceSnapshot } from '@wherego/domain';
import { View } from 'react-native';
import { LedgerAction as Action } from './LedgerUI';
import { DateField } from './TravelInputs';
import type { PlanForm } from './forms';
import { ledgerStyles as l } from './ledgerTheme';
import { Field } from './ui';
// renderReceiptItems이 읽는 값과 실행 가능한 행동의 계약이다.
type RenderReceiptItemsProps = {
  form: PlanForm;
  onChange: (key: string, value: string) => void;
};

// 영수증 품목과 합계 차이 안내를 표시한다.
export function renderReceiptItems({
  form,
  onChange,
}: RenderReceiptItemsProps) {
  // 전달받은 값과 행동을 기존 화면 규격으로 표시한다.

  return (
    <View style={l.card}>
      <Field
        label="영수증 상호"
        value={form.values.merchant || ''}
        onChange={(value) => {
          // 상호 후보 하나를 수정한다.
          return onChange('merchant', value);
        }}
      />
      <Field
        label="지역명·주소"
        value={form.values.address || ''}
        onChange={(value) => {
          // 인쇄된 주소를 확인·수정한다.
          return onChange('address', value);
        }}
      />
      <DateField
        label="실제 결제 날짜"
        mode="date"
        value={form.values.transactionDate || ''}
        onChange={(value) => {
          // 날짜 수정은 연결 DAY도 다시 계산한다.
          return onChange('transactionDate', value);
        }}
      />
      <DateField
        label="실제 결제 시간"
        mode="time"
        value={form.values.transactionTime || ''}
        onChange={(value) => {
          // 입장 시간과 구분한 결제 시간을 수정한다.
          return onChange('transactionTime', value);
        }}
      />
      <Field
        label="금액"
        value={form.values.amount || ''}
        onChange={(value) => {
          // 합계만 수정하며 메뉴 금액을 자동 덮어쓰지 않는다.
          return onChange('amount', value);
        }}
      />
      <Field
        label="구매 내역"
        value={form.values.details || ''}
        multiline
        onChange={(value) => {
          // 필요할 때만 추가 메모를 남긴다.
          return onChange('details', value);
        }}
      />
    </View>
  );
}
// renderReceiptSummary이 읽는 값과 실행 가능한 행동의 계약이다.
type RenderReceiptSummaryProps = {
  form: PlanForm;
  snapshot: WorkspaceSnapshot;
  busy: boolean;
  onChange: (key: string, value: string) => void;
  onRetry: () => void;
};

// 인식한 영수증의 결제 정보를 표시한다.
export function renderReceiptSummary({
  form,
  snapshot,
  busy,
  onChange,
  onRetry,
}: RenderReceiptSummaryProps) {
  // 전달받은 값과 행동을 기존 화면 규격으로 표시한다.

  return (
    <View style={l.card}>
      <Text style={l.section}>
        {form.values.receiptStatus === 'manual'
          ? '직접 확인할 내용'
          : '사진에서 읽은 내용이에요'}
      </Text>
      <Text style={l.meta}>
        {form.values.receiptStatus === 'manual'
          ? '영수증 정보를 입력하고 확인하면 장소와 실제 지출이 함께 기록돼요.'
          : '맞게 읽었는지 확인하면 장소와 실제 지출이 함께 기록돼요.'}
      </Text>
      <Text style={l.section}>{form.values.merchant || '상호 확인 필요'}</Text>
      <Text>{form.values.address || '주소를 읽지 못했어요'}</Text>
      <Text>
        결제 일시 · {form.values.transactionDate || '날짜 확인 필요'}{' '}
        {form.values.transactionTime}
      </Text>
      <Text style={l.section}>
        결제 합계 · {form.values.amount || '금액 확인 필요'}{' '}
        {form.values.currency}
      </Text>
      <Text>
        {snapshot.days.find((day) => {
          // 인식 날짜와 연결된 DAY를 표시한다.
          return day.id === form.values.dayId;
        })
          ? `DAY ${
              snapshot.days.find((day) => {
                // 표시할 날짜 번호 하나를 선택한다.
                return day.id === form.values.dayId;
              })!.dayNumber
            }에 기록돼요`
          : '결제 날짜가 여행 기간과 맞는지 확인해 주세요.'}
      </Text>
      {(JSON.parse(form.values.warnings || '[]') as string[])
        .filter((warning) => {
          // 합계·통화 안내는 수정된 값으로 다시 계산하므로 오래된 인식 경고를 반복하지 않는다.
          return !/메뉴 금액과 결제 합계|통화를 읽지 못|영수증은 읽었지만/.test(
            warning,
          );
        })
        .map((warning: string, index: number) => (
          <Text key={index} style={l.meta}>
            {warning}
          </Text>
        ))}
      <Action
        label={
          form.values.receiptEditing === 'true'
            ? '수정 마치기'
            : '인식 내용 수정'
        }
        disabled={busy}
        onPress={() => {
          // 전체 정보를 다시 적지 않고 잘못 읽은 항목만 수정하도록 연다.
          return onChange(
            'receiptEditing',
            form.values.receiptEditing === 'true' ? 'false' : 'true',
          );
        }}
      />
      {form.values.receiptOperation !== 'update' && (
        <Action
          label="다시 스캔하기"
          disabled={busy}
          variant="quiet"
          onPress={onRetry}
        />
      )}
    </View>
  );
}
