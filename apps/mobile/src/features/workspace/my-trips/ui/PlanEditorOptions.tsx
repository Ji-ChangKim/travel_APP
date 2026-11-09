import { t } from '@/features/localization/translate';
import { useLocale } from '@/features/localization/localeState';
import Text from '@/components/ui/AppText';
import type { WorkspaceSnapshot } from '@wherego/domain';
import { View } from 'react-native';
import type { PlanForm } from '../../shared/model/forms';
import { DestinationFields } from '../../planning/ui/TravelInputs';
import { Action } from '../../shared/ui/ui';
import { styles } from '../../hub/styles/workspaceStyles';
import {
  resolveExpensePaymentMethod,
  resolveExpenseSplitType,
  setExpensePaymentMeta,
} from '../model/expensePaymentMeta';

type EditorOptionProps = {
  form: PlanForm;
  onChange: (key: string, value: string) => void;
};

export function ScheduleOptions({
  form,
  onChange,
  busy,
  snapshot,
}: EditorOptionProps & {
  busy: boolean;
  snapshot: WorkspaceSnapshot | undefined;
}) {
  useLocale();
  return (
    <>
      {form.kind === 'schedule' && (
        <View style={styles.card}>
          <Text style={styles.title}>{t('여행 날짜 선택')}</Text>
          {snapshot?.days.map((day) => (
            <Action
              key={day.id}
              label={`DAY ${day.dayNumber} · ${day.tripDate}`}
              selected={form.values.dayId === day.id}
              selectionStyle="fill"
              disabled={busy}
              onPress={() => {
                // 수동 날짜 선택에서 기존 일정 연결은 해제한다.
                onChange('dayId', day.id);
              }}
            />
          ))}
        </View>
      )}
      {form.kind === 'schedule' && (
        <View style={styles.row}>
          {['PLACE', 'TRANSPORT', 'STAY', 'RESERVATION', 'TODO', 'MEMO'].map(
            (type) => (
              <Action
                key={type}
                label={`${form.values.type === type ? '✓ ' : ''}${t({ PLACE: '장소', TRANSPORT: '이동', STAY: '숙소', RESERVATION: '예약', TODO: '할 일', MEMO: '메모' }[type] || '')}`}
                disabled={busy}
                onPress={() => {
                  // 일정 유형을 하나 선택한다.
                  onChange('type', type);
                }}
              />
            ),
          )}
        </View>
      )}
    </>
  );
}

const EXPENSE_CATEGORIES = [
  { key: 'food', label: '식비' },
  { key: 'transport', label: '교통' },
  { key: 'stay', label: '숙박' },
  { key: 'activity', label: '관광·액티비티' },
  { key: 'shopping', label: '쇼핑' },
  { key: 'etc', label: '기타' },
] as const;

export function ExpenseOptions({ form, onChange }: EditorOptionProps) {
  useLocale();
  const paymentMethod =
    (form.values.paymentMethod as 'CARD' | 'CASH' | undefined) ||
    resolveExpensePaymentMethod({
      id: form.id,
      title: form.values.title || '',
    });
  const splitType =
    (form.values.splitType as 'SHARED' | 'PERSONAL' | undefined) ||
    resolveExpenseSplitType({ id: form.id, title: form.values.title || '' }, 2);
  return (
    <>
      {form.kind === 'expense' && (
        <View style={styles.card}>
          <Text style={styles.title}>{t('결제 수단')}</Text>
          <View style={styles.row}>
            <Action
              label={`💳 ${t('카드 (Card)')}`}
              selected={paymentMethod === 'CARD'}
              onPress={() => {
                // 카드 결제로 구분한다.
                setExpensePaymentMeta(form.id, { paymentMethod: 'CARD' });
                onChange('paymentMethod', 'CARD');
              }}
            />
            <Action
              label={`💵 ${t('현금 (Cash)')}`}
              selected={paymentMethod === 'CASH'}
              onPress={() => {
                // 현금 결제로 구분한다.
                setExpensePaymentMeta(form.id, { paymentMethod: 'CASH' });
                onChange('paymentMethod', 'CASH');
              }}
            />
          </View>
          <Text style={styles.title}>{t('정산 방식')}</Text>
          <View style={styles.row}>
            <Action
              label={t('공동 정산')}
              selected={splitType === 'SHARED'}
              onPress={() => {
                // 동행자 1/N 공동 정산 항목으로 지정한다.
                setExpensePaymentMeta(form.id, { splitType: 'SHARED' });
                onChange('splitType', 'SHARED');
              }}
            />
            <Action
              label={t('개인 지출')}
              selected={splitType === 'PERSONAL'}
              onPress={() => {
                // 개인 전액 부담 항목으로 지정한다.
                setExpensePaymentMeta(form.id, { splitType: 'PERSONAL' });
                onChange('splitType', 'PERSONAL');
              }}
            />
          </View>
          <Text style={styles.title}>{t('지출 분류')}</Text>
          <View style={styles.row}>
            {EXPENSE_CATEGORIES.map((cat) => (
              <Action
                key={cat.key}
                label={t(cat.label)}
                size="chip"
                selected={(form.values.category || 'etc') === cat.key}
                onPress={() => {
                  // 지출 카테고리를 선택한다.
                  onChange('category', cat.key);
                }}
              />
            ))}
          </View>
          <Text style={styles.title}>{t('지출 구분')}</Text>
          <View style={styles.row}>
            <Action
              label={t('실제 지출')}
              selected={form.values.isActual === 'true'}
              onPress={() => {
                // 실제 지출로 명시한다.
                onChange('isActual', 'true');
              }}
            />
            <Action
              label={t('예상 비용')}
              selected={form.values.isActual === 'false'}
              onPress={() => {
                // 예상 비용과 실제 지출은 합계를 분리한다.
                onChange('isActual', 'false');
              }}
            />
          </View>
        </View>
      )}
    </>
  );
}

export function MetadataOptions({ form, onChange }: EditorOptionProps) {
  useLocale();
  return (
    <>
      {form.kind === 'metadata' && (
        <DestinationFields values={form.values} onChange={onChange} />
      )}
      {form.kind === 'metadata' && (
        <View>
          <Text>
            {t(
              '여행 단계는 날짜에 맞춰 바뀌어요. 공개할 기록의 정리 여부를 선택해 주세요.',
            )}
          </Text>
          <View style={styles.row}>
            {['PLANNED', 'COMPLETED'].map((status) => (
              <Action
                key={status}
                label={
                  status === 'COMPLETED'
                    ? t('기록 정리 완료')
                    : t('기록 정리 중')
                }
                selected={
                  status === 'COMPLETED'
                    ? form.values.status === status
                    : form.values.status !== 'COMPLETED'
                }
                selectionStyle="fill"
                onPress={() => {
                  // 종료 여부는 소유자가 명시적으로 확인한다.
                  onChange('status', status);
                }}
              />
            ))}
          </View>
        </View>
      )}
    </>
  );
}
