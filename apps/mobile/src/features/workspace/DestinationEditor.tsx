import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ScreenHeader from '@/components/ScreenHeader';
import Text from '@/components/AppText';
import type { WorkspaceSnapshot } from '@wherego/domain';
import type { PlanForm } from './forms';
import DestinationCollection from './DestinationCollection';
import { destinationDraftItems } from './destinationForms';
import { Action } from './ui';
import { styles } from './workspaceStyles';

// 도시 입력과 DAY 배정만 편집하며 공통 헤더와 저장 보호를 따른다.
export default function DestinationEditor({
  form,
  snapshot,
  locked,
  busy,
  error,
  onChange,
  onSave,
  onClose,
  conflicted,
  onReload,
}: {
  form: PlanForm;
  snapshot: WorkspaceSnapshot;
  locked: boolean;
  busy: boolean;
  error: string;
  onChange: (key: string, value: string) => void;
  onSave: () => void;
  onClose: () => void;
  conflicted: boolean;
  onReload: () => void;
}) {
  // 삭제 전에 해당 도시를 쓰는 날짜가 남아 있는지 확인한다.
  const items = destinationDraftItems(form.values.destinations);
  const assignments = JSON.parse(form.values.assignments || '[]') as {
    dayId: string;
    destinationId: string;
  }[];
  return (
    <SafeAreaView style={styles.modal}>
      <ScreenHeader title="여행 도시 관리" onBack={onClose} disabled={locked} />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text>
          도시를 추가하고 날짜마다 머무를 여행지를 골라 주세요. 첫 번째 도시가
          여행의 대표 여행지가 돼요.
        </Text>
        <DestinationCollection
          items={items}
          values={form.values}
          disabled={locked}
          onChange={onChange}
          onItemsChange={(next) =>
            onChange('destinations', JSON.stringify(next))
          }
          canRemove={(id) =>
            items.length > 1 &&
            !assignments.some((entry) => entry.destinationId === id)
          }
        />
        {snapshot.days.map((day) => (
          <View key={day.id} style={styles.card}>
            <Text style={styles.title}>
              DAY {day.dayNumber} · {day.tripDate}
            </Text>
            <View style={styles.row}>
              {items.map((item) => (
                <Action
                  key={item.id}
                  label={`DAY ${day.dayNumber} ${item.city}`}
                  selected={
                    assignments.find((entry) => entry.dayId === day.id)
                      ?.destinationId === item.id
                  }
                  selectionStyle="fill"
                  disabled={locked}
                  onPress={() =>
                    onChange(
                      'assignments',
                      JSON.stringify(
                        assignments.map((entry) =>
                          entry.dayId === day.id
                            ? { ...entry, destinationId: item.id }
                            : entry,
                        ),
                      ),
                    )
                  }
                />
              ))}
            </View>
          </View>
        ))}
        <Text style={styles.subtitle}>
          도시를 바꿔도 입력한 일정 시각과 항공권은 유지돼요. 해당 날짜의 현지
          시간을 확인해 주세요.
        </Text>
        {error && (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        )}
        {conflicted ? (
          <Action
            label="최신 여행 다시 불러오기"
            allowWhileLocked
            onPress={onReload}
          />
        ) : (
          <Action
            label={busy ? '저장 중…' : '여행 도시 저장'}
            variant="primary"
            loading={busy}
            allowWhileLocked
            onPress={onSave}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
