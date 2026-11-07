import { t } from '@/features/localization/translate';
import Text from '@/components/ui/AppText';
import type { WorkspaceSnapshot } from '@wherego/domain';
import { View } from 'react-native';
import { LedgerAction as Action } from '../../my-trips/ui/LedgerUI';
import { DateField } from '../../planning/ui/TravelInputs';
import type { PlanForm } from '../../shared/model/forms';
import { trackWorkspaceEvent } from '../../shared/model/workspaceAnalytics';
import { ledgerStyles as l } from '../../my-trips/styles/ledgerTheme';
import { Field } from '../../shared/ui/ui';
// renderReceiptItems이 읽는 값과 실행 가능한 행동의 계약이다.
type RenderReceiptItemsProps = {
  form: PlanForm;
  snapshot?: WorkspaceSnapshot;
  busy?: boolean;
  onChange: (key: string, value: string) => void;
};

// 영수증 기반 일정 추가에서 핵심 정보(장소 이름·장소 주소·사용 금액 여부 및 DAY 선택)를 표시한다.
export function renderReceiptItems({
  form,
  snapshot,
  busy = false,
  onChange,
}: RenderReceiptItemsProps) {
  const recordAmount = form.values.amount !== '0';

  return (
    <View style={l.card}>
      <Text style={l.section}>{t('방문 장소 · 지출 정보 확인')}</Text>
      <Text style={l.meta}>
        {t(
          '여행 중이나 여행 후에 방문한 장소 이름, 주소, 사용 금액을 확인해 일정에 남겨보세요.',
        )}
      </Text>
      <Field
        label="영수증 상호"
        placeholder={t('방문한 장소 이름을 입력해 주세요')}
        value={form.values.merchant || ''}
        onChange={(value) => {
          // 장소 이름(상호) 후보 하나를 수정한다.
          return onChange('merchant', value);
        }}
      />
      <Field
        label="지역명·주소"
        placeholder={t('장소 주소를 입력해 주세요')}
        value={form.values.address || ''}
        onChange={(value) => {
          // 인쇄된 장소 주소를 확인·수정한다.
          return onChange('address', value);
        }}
      />

      {snapshot && snapshot.days.length > 0 && (
        <View style={{ gap: 8 }}>
          <Text style={l.section}>{t('어느 날 일정에 추가할까요?')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {snapshot.days.map((day) => {
              const selected =
                form.values.dayId === day.id ||
                form.values.transactionDate === day.tripDate;
              return (
                <Action
                  key={day.id}
                  label={`DAY ${day.dayNumber} (${day.tripDate.slice(5)})`}
                  selected={selected}
                  disabled={busy}
                  onPress={() => {
                    // 선택한 DAY의 날짜로 영수증 방문 일자를 맞춘다.
                    onChange('transactionDate', day.tripDate);
                    onChange('newReceiptPlace', 'true');
                  }}
                />
              );
            })}
          </View>
        </View>
      )}

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

      <View style={{ gap: 8 }}>
        <Text style={l.section}>{t('사용 금액 기록 여부')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Action
            label={t('사용 금액 함께 남기기')}
            selected={recordAmount}
            disabled={busy}
            onPress={() => {
              trackWorkspaceEvent('receipt_amount_mode', {
                mode: 'with_amount',
              });
              if (form.values.amount === '0') {
                onChange('amount', '');
              }
            }}
          />
          <Action
            label={t('장소만 일정에 남기기')}
            selected={!recordAmount}
            disabled={busy}
            onPress={() => {
              // 금액 없이 방문 장소만 남길 때는 0원으로 설정하고 기본 통화를 지정한다.
              trackWorkspaceEvent('receipt_amount_mode', {
                mode: 'place_only',
              });
              onChange('amount', '0');
              if (!['KRW', 'JPY', 'USD'].includes(form.values.currency || '')) {
                onChange('currency', snapshot?.trip.defaultCurrency || 'KRW');
              }
            }}
          />
        </View>
      </View>

      <Field
        label="금액"
        placeholder={t('사용한 금액을 입력해 주세요')}
        value={form.values.amount || ''}
        onChange={(value) => {
          // 합계만 수정하며 메뉴 금액을 자동 덮어쓰지 않는다.
          return onChange('amount', value);
        }}
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {(['KRW', 'JPY', 'USD'] as const).map((currency) => (
          <Action
            key={currency}
            label={currency}
            selected={form.values.currency === currency}
            disabled={busy}
            onPress={() => onChange('currency', currency)}
          />
        ))}
      </View>
      <Field
        label="구매 내역"
        placeholder={t('주문한 메뉴나 메모할 내용을 남겨보세요 (선택)')}
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
          ? t('직접 확인할 내용')
          : t('사진에서 읽은 내용이에요')}
      </Text>
      <Text style={l.meta}>
        {form.values.receiptStatus === 'manual'
          ? t(
              '영수증 정보를 입력하고 확인하면 장소와 실제 지출이 함께 기록돼요.',
            )
          : t('맞게 읽었는지 확인하면 장소와 실제 지출이 함께 기록돼요.')}
      </Text>
      <Text style={l.section}>
        {form.values.merchant || t('상호 확인 필요')}
      </Text>
      <Text>{form.values.address || t('주소를 읽지 못했어요')}</Text>
      <Text>
        {t('결제 일시 ·')} {form.values.transactionDate || t('날짜 확인 필요')}{' '}
        {form.values.transactionTime}
      </Text>
      <Text style={l.section}>
        {t('결제 합계 ·')} {form.values.amount || t('금액 확인 필요')}{' '}
        {form.values.currency}
      </Text>
      <Text>
        {snapshot.days.find((day) => {
          // 인식 날짜와 연결된 DAY를 표시한다.
          return day.id === form.values.dayId;
        })
          ? t('DAY {p0}에 기록돼요', {
              p0: snapshot.days.find((day) => {
                // 표시할 날짜 번호 하나를 선택한다.
                return day.id === form.values.dayId;
              })!.dayNumber,
            })
          : t('결제 날짜가 여행 기간과 맞는지 확인해 주세요.')}
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
            ? t('수정 마치기')
            : t('인식 내용 수정')
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
          label={t('다시 스캔하기')}
          disabled={busy}
          variant="quiet"
          onPress={onRetry}
        />
      )}
    </View>
  );
}
