import { View, StyleSheet } from 'react-native';
import { discoveryDestinations } from '@wherego/domain';
import Text from '@/components/AppText';
import ActionSheet from '@/components/ActionSheet';
import DesignButton from '@/components/DesignButton';
import { colors } from '@/constants/theme';
import { cityGuides, type CityGuide } from './cityGuides';

// 일정에 넣을 장소는 앱에 이미 수록된 도시 가이드에서만 읽는다.
function guideForTrip(country: string, city: string): CityGuide | undefined {
  // 같은 이름의 다른 나라 도시를 추천하지 않는다.
  const destination = discoveryDestinations.find((item) => {
    // 한글 도시명과 도시 키를 정확히 대조하며 빈 나라만 예외로 허용한다.
    return (
      (!country || country === item.country) &&
      (item.city === city.trim() || item.key === city.trim().toLowerCase())
    );
  });
  return destination ? cityGuides[destination.key] : undefined;
}

// 코스를 미리 읽고 원하는 장소 하나를 저장 전 일정 작성으로 넘긴다.
export default function ScheduleCoursePicker({
  visible,
  country,
  city,
  onClose,
  onSelect,
  onSearch,
}: {
  visible: boolean;
  country: string;
  city: string;
  onClose: () => void;
  onSelect: (place: CityGuide['places'][number]) => void;
  onSearch: () => void;
}) {
  // 시간·최적 동선·좌표를 추정하거나 선택 전에 일정을 저장하지 않는다.
  const guide = guideForTrip(country, city);
  return (
    <ActionSheet title="추천 코스" visible={visible} onClose={onClose}>
      <Text style={s.title}>{city}에서 가볼 곳</Text>
      <Text style={s.meta}>
        {guide
          ? '가고 싶은 장소를 고르면 일정 작성 화면에 채워져요. 방문 시간과 위치를 확인한 뒤 저장해 주세요.'
          : '아직 이 도시의 추천 코스가 없어요. 가고 싶은 장소를 직접 찾아 일정을 시작해 보세요.'}
      </Text>
      {guide?.places.map((place) => (
        <View key={place.title} style={s.place}>
          <Text style={s.title}>{place.title}</Text>
          <Text style={s.meta}>{place.description}</Text>
          <DesignButton
            label="이 장소로 일정 작성"
            accessibilityLabel={`${place.title} 일정 작성`}
            onPress={() => {
              // 선택한 실제 가이드 항목만 임시 폼으로 전달한다.
              return onSelect(place);
            }}
          />
        </View>
      ))}
      {guide && (
        <Text style={s.meta}>
          TripPrint 도시 가이드 · {guide.sources[0]?.label}
        </Text>
      )}
      <DesignButton label="장소 검색으로 추가" onPress={onSearch} />
      <DesignButton
        label="닫기"
        size="chip"
        variant="quiet"
        onPress={onClose}
      />
    </ActionSheet>
  );
}

const s = StyleSheet.create({
  title: {
    fontSize: 16,
    lineHeight: 26,
    fontWeight: '600',
    color: colors.text,
  },
  meta: { fontSize: 14, lineHeight: 22, color: colors.muted },
  place: {
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
});
