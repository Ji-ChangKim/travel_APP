import { t } from '@/features/localization/translate';
import { useLocale } from '@/features/localization/localeState';
import { View, StyleSheet } from 'react-native';
import Text from '@/components/AppText';
import ActionSheet from '@/components/ActionSheet';
import DesignButton from '@/components/DesignButton';
import { colors } from '@/constants/theme';
import { guideForTrip, type CityGuide } from '../../cityGuides';

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
  useLocale();
  // 시간·최적 동선·좌표를 추정하거나 선택 전에 일정을 저장하지 않는다.
  const guide = guideForTrip(country, city);
  return (
    <ActionSheet title={t('추천 코스')} visible={visible} onClose={onClose}>
      <Text style={s.title}>
        {city}
        {t('에서 가볼 곳')}
      </Text>
      <Text style={s.meta}>
        {guide
          ? t(
              '가고 싶은 장소를 고르면 일정 작성 화면에 채워져요. 방문 시간과 위치를 확인한 뒤 저장해 주세요.',
            )
          : t(
              '아직 이 도시의 추천 코스가 없어요. 가고 싶은 장소를 직접 찾아 일정을 시작해 보세요.',
            )}
      </Text>
      {guide?.places.map((place) => (
        <View key={place.title} style={s.place}>
          <Text style={s.title}>{place.title}</Text>
          <Text style={s.meta}>{place.description}</Text>
          <DesignButton
            label={t('이 장소로 일정 작성')}
            accessibilityLabel={t('{p0} 일정 작성', { p0: place.title })}
            onPress={() => {
              // 선택한 실제 가이드 항목만 임시 폼으로 전달한다.
              return onSelect(place);
            }}
          />
        </View>
      ))}
      {guide && (
        <Text style={s.meta}>
          {t('TripPrint 도시 가이드 ·')} {guide.sources[0]?.label}
        </Text>
      )}
      <DesignButton label={t('장소 검색으로 추가')} onPress={onSearch} />
      <DesignButton
        label={t('닫기')}
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
