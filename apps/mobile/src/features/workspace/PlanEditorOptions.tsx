import Text from '@/components/AppText';
import type { WorkspaceSnapshot } from '@wherego/domain';
import { View } from 'react-native';
import type { PlanForm } from './forms';
import { DestinationFields } from './TravelInputs';
import { Action } from './ui';
import { styles } from './workspaceStyles';

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
  return (
    <>
      {form.kind === 'schedule' && (
        <View style={styles.card}>
          <Text style={styles.title}>여행 날짜 선택</Text>
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
                label={`${form.values.type === type ? '✓ ' : ''}${{ PLACE: '장소', TRANSPORT: '이동', STAY: '숙소', RESERVATION: '예약', TODO: '할 일', MEMO: '메모' }[type]}`}
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

export function ExpenseOptions({ form, onChange }: EditorOptionProps) {
  return (
    <>
      {form.kind === 'expense' && (
        <View style={styles.row}>
          <Action
            label="실제 지출"
            selected={form.values.isActual === 'true'}
            onPress={() => {
              // 실제 지출로 명시한다.
              onChange('isActual', 'true');
            }}
          />
          <Action
            label="예상 비용"
            selected={form.values.isActual === 'false'}
            onPress={() => {
              // 예상 비용과 실제 지출은 합계를 분리한다.
              onChange('isActual', 'false');
            }}
          />
        </View>
      )}
    </>
  );
}

export function MetadataOptions({ form, onChange }: EditorOptionProps) {
  return (
    <>
      {form.kind === 'metadata' && (
        <DestinationFields values={form.values} onChange={onChange} />
      )}
      {form.kind === 'metadata' && (
        <View>
          <Text>
            여행 단계는 날짜에 맞춰 바뀌어요. 공개할 기록의 정리 여부를 선택해
            주세요.
          </Text>
          <View style={styles.row}>
            {['PLANNED', 'COMPLETED'].map((status) => (
              <Action
                key={status}
                label={
                  status === 'COMPLETED' ? '기록 정리 완료' : '기록 정리 중'
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
