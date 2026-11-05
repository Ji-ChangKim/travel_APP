import { t } from '@/features/localization/translate';
import { useLocale } from '@/features/localization/localeState';
import { Pressable, StyleSheet, View } from 'react-native';
import { useState } from 'react';
import DesignButton from '@/components/ui/DesignButton';
import ActionSheet from '@/components/ui/ActionSheet';
import TripIcon, { type TripIconName } from '@/components/icons/TripIcon';
import Text from '@/components/ui/AppText';
import { colors } from '@/constants/theme';
import { useAppAccessibility } from '@/features/accessibility/appAccessibility';
import { workspaceSections } from '../../shared/model/presentation';

const sectionIcons: Record<string, TripIconName> = {
  itinerary: 'checklist-outline',
  map: 'map-outline',
  expenses: 'receipt-scan-outline',
};

// 핵심 세 영역(일정·지도·비용)을 세그먼트 탭으로 고정하고 부가 기능은 더보기에서 연다.
export function TripSectionNavigation({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (section: string) => void;
}) {
  useLocale();
  // 보조 영역을 열었을 때 핵심 탭을 선택한 것처럼 표시하지 않는다.
  return (
    <View
      accessibilityLabel={t('여행 작업 영역')}
      testID="trip-section-navigation"
      style={s.nav}
    >
      {workspaceSections.slice(0, 3).map(([key, label]) => (
        <SectionButton
          key={key}
          icon={sectionIcons[key] || 'checklist-outline'}
          label={t(label)}
          selected={selected === key}
          onPress={() => {
            /* 실제 영역 하나만 연다. */ return onSelect(key);
          }}
        />
      ))}
    </View>
  );
}

// 세그먼트 트랙 안에서 활성 탭을 입체 카드로 강조해 표시한다.
function SectionButton({
  icon,
  label,
  accessibilityLabel = label,
  selected,
  onPress,
}: {
  icon: TripIconName;
  label: string;
  accessibilityLabel?: string;
  selected: boolean;
  onPress: () => void;
}) {
  useLocale();
  const { largeText } = useAppAccessibility();
  // 일반 버튼과 같은 눌림·초점 토큰을 사용한다.
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected }}
      aria-selected={selected}
      onPress={onPress}
      onFocus={() => {
        /* 초점 테두리를 표시한다. */ return setFocused(true);
      }}
      onBlur={() => {
        /* 이동한 초점을 해제한다. */ return setFocused(false);
      }}
      style={({ pressed }) => {
        /* 선택과 실제 눌림 상태를 함께 표시한다. */ return [
          s.tab,
          selected && s.selected,
          pressed && s.pressed,
          focused && s.focused,
        ];
      }}
    >
      {!largeText && (
        <TripIcon
          name={icon}
          size={16}
          color={selected ? colors.brandCoral : colors.muted}
        />
      )}
      <Text style={[s.label, selected && s.selectedLabel]}>{t(label)}</Text>
    </Pressable>
  );
}

// 보조 기능은 요청했을 때만 화면 아래에서 선택하게 한다.
export function TripMoreMenu({
  visible,
  owner,
  selected,
  onSelect,
  onClose,
  onEditInfo,
  onEditPeriod,
  onEditDestinations,
  disabled,
}: {
  visible: boolean;
  owner: boolean;
  selected: string;
  onSelect: (section: string) => void;
  onClose: () => void;
  onEditInfo: () => void;
  onEditPeriod: () => void;
  onEditDestinations: () => void;
  disabled: boolean;
}) {
  useLocale();
  // 기존 소유자 권한에 맞는 항목만 표시한다.
  return (
    <ActionSheet title={t('여행 더보기')} visible={visible} onClose={onClose}>
      {workspaceSections
        .slice(3)
        .filter(([key]) => {
          /* 공개 관리의 소유자 제한을 유지한다. */ return (
            key !== 'share' || owner
          );
        })
        .map(([key, label]) => (
          <DesignButton
            key={key}
            label={t(label)}
            selected={key === selected}
            onPress={() => {
              /* 선택한 보조 화면으로 이동한다. */ return onSelect(key);
            }}
          />
        ))}
      {owner && (
        <>
          <Text accessibilityRole="header" style={s.label}>
            {t('여행 관리')}
          </Text>
          <DesignButton
            label={t('여행 정보 / 기록 정리')}
            disabled={disabled}
            onPress={onEditInfo}
          />
          <DesignButton
            label={t('여행 기간 변경')}
            disabled={disabled}
            onPress={onEditPeriod}
          />
          <DesignButton
            label={t('여행 도시 관리')}
            disabled={disabled}
            onPress={onEditDestinations}
          />
        </>
      )}
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
  nav: {
    flexDirection: 'row',
    gap: 4,
    width: '100%',
    padding: 4,
    borderRadius: 14,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tab: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    paddingHorizontal: 6,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  selected: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  pressed: { backgroundColor: colors.selectedSurface },
  focused: { outlineColor: colors.focus, outlineWidth: 2, outlineOffset: 2 },
  label: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '600',
    textAlign: 'center',
  },
  selectedLabel: {
    color: colors.secondary,
    fontWeight: '700',
  },
});
