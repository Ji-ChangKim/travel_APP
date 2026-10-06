import { Text, View } from 'react-native';
import type { WorkspaceSnapshot } from '@wherego/domain';
import HaruState from '@/components/HaruState';
import { Action, Field, styles } from './ui';
import { DateField } from './TravelInputs';
import type { PlanForm } from './forms';
import { receiptItems, changedReceiptItem } from './receiptFlow';

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
      <View style={styles.card}>
        <Text style={styles.title}>
          {form.values.receiptStatus === 'manual'
            ? '직접 확인할 내용'
            : '사진에서 읽은 내용이에요'}
        </Text>
        <Text style={styles.subtitle}>
          맞게 읽었는지 확인하면 장소와 실제 지출이 함께 기록돼요.
        </Text>
        <Text style={styles.title}>
          {form.values.merchant || '상호 확인 필요'}
        </Text>
        <Text>{form.values.address || '주소를 읽지 못했어요'}</Text>
        <Text>
          결제 일시 · {form.values.transactionDate || '날짜 확인 필요'}{' '}
          {form.values.transactionTime}
        </Text>
        <Text style={styles.title}>
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
        {JSON.parse(form.values.warnings || '[]').map(
          (warning: string, index: number) => (
            <Text key={index} style={styles.subtitle}>
              {warning}
            </Text>
          ),
        )}
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
        <Action
          label="다시 스캔하기"
          disabled={busy}
          variant="quiet"
          onPress={onRetry}
        />
      </View>
      {(form.values.receiptEditing === 'true' ||
        form.values.receiptStatus === 'manual') && (
        <View style={styles.card}>
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
      )}
      <View style={styles.card}>
        <Text style={styles.title}>메뉴·구매 내역</Text>
        {receiptItems(form.values.items).length === 0 && (
          <Text>메뉴를 읽지 못했어요. 원본 사진을 확인해 주세요.</Text>
        )}
        {receiptItems(form.values.items).map((item, index) => (
          <View key={index} style={{ gap: 6, paddingVertical: 8 }}>
            <Text style={styles.title}>{item.name}</Text>
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
