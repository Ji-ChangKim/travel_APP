import { StyleSheet, View } from 'react-native';
import Text from '@/components/AppText';
import DesignButton from '@/components/DesignButton';
import HaruState from '@/components/HaruState';
import { colors } from '@/constants/theme';

// 빈 날짜에서 실제로 시작할 수 있는 두 경로만 안내한다.
export default function TripScheduleEmpty({
  canCreate,
  disabled,
  onCourse,
  onSearch,
}: {
  canCreate: boolean;
  disabled: boolean;
  onCourse: () => void;
  onSearch: () => void;
}) {
  // 읽기 전용에서는 작성 행동을 숨기고 아직 일정이 없다는 결과만 알린다.
  return (
    <View style={s.cards}>
      <HaruState
        kind="empty"
        compact
        title={
          canCreate ? '첫 장소부터 정해 볼까요?' : '이날은 등록된 일정이 없어요'
        }
        description={
          canCreate
            ? '편한 방법으로 시작해요.'
            : '동행이 일정을 추가하면 여기에서 확인할 수 있어요.'
        }
      />
      {canCreate && (
        <View style={s.cards} testID="schedule-empty-guides">
          <View style={s.card}>
            <Text style={s.body}>
              도시 가이드에서 가고 싶은 장소를 골라 보세요.
            </Text>
            <DesignButton
              label="추천 코스 불러오기"
              disabled={disabled}
              onPress={onCourse}
            />
          </View>
          <View style={s.card}>
            <Text style={s.body}>
              장소명을 검색하거나 지도 링크로 일정을 작성해요.
            </Text>
            <DesignButton
              label="장소 검색으로 추가"
              disabled={disabled}
              onPress={onSearch}
            />
          </View>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  cards: { width: '100%', gap: 12 },
  card: {
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
  body: { fontSize: 14, lineHeight: 22, color: colors.muted },
});
