import { t } from '@/features/localization/translate';
import { useLocale } from '@/features/localization/localeState';
import { Pressable, StyleSheet, View } from 'react-native';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import DesignButton from '@/components/ui/DesignButton';
import ActionSheet from '@/components/ui/ActionSheet';
import type { TripIconName } from '@/components/icons/TripIcon';
import Text from '@/components/ui/AppText';
import { colors } from '@/constants/theme';
import { useAppAccessibility } from '@/features/accessibility/appAccessibility';
import { workspaceSections } from '../../shared/model/presentation';

const sectionIcons: Record<string, TripIconName> = {
  itinerary: 'checklist-outline',
  map: 'map-outline',
  expenses: 'receipt-scan-outline',
};

// 핵심 두 영역(여행 계획·가계부)을 좌측 캡슐 탭으로, 공유를 우측 캡슐 버튼으로 표시한다.
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
      style={s.navRow}
    >
      <View style={s.leftGroup}>
        {workspaceSections.slice(0, 2).map(([key, label]) => (
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
      <SectionButton
        icon="share-outline"
        label={t('공유')}
        selected={selected === 'share'}
        onPress={() => {
          /* 우측 공유 캡슐을 누르면 여행 공유 영역을 연다. */ return onSelect(
            'share',
          );
        }}
      />
    </View>
  );
}

// 캡슐형 필(Pill) 버튼으로 활성 탭을 코랄 색상으로 강조한다.
function SectionButton({
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
  useAppAccessibility();
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
          s.pill,
          selected && s.selectedPill,
          pressed && s.pressed,
          focused && s.focused,
        ];
      }}
    >
      <Text style={[s.label, selected && s.selectedLabel]}>{t(label)}</Text>
    </Pressable>
  );
}

const moreSectionIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
  map: 'map-outline',
  photos: 'images-outline',
  checklist: 'checkbox-outline',
  companions: 'people-outline',
  share: 'share-social-outline',
};

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
  onDeleteOrLeave,
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
  onDeleteOrLeave?: () => void;
  disabled: boolean;
}) {
  useLocale();
  // 기존 소유자 권한에 맞는 항목만 표시한다.
  return (
    <ActionSheet title={t('여행 더보기')} visible={visible} onClose={onClose}>
      <Text accessibilityRole="header" style={s.groupHeader}>
        {t('여행 기능')}
      </Text>
      {workspaceSections
        .slice(2)
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
            icon={(color) => (
              <Ionicons
                name={moreSectionIcons[key] || 'albums-outline'}
                size={18}
                color={color}
              />
            )}
            onPress={() => {
              /* 선택한 보조 화면으로 이동한다. */ return onSelect(key);
            }}
          />
        ))}
      <Text accessibilityRole="header" style={s.groupHeader}>
        {t('여행 관리')}
      </Text>
      {owner && (
        <>
          <DesignButton
            label={t('여행 정보 / 기록 정리')}
            disabled={disabled}
            icon={(color) => (
              <Ionicons name="create-outline" size={18} color={color} />
            )}
            onPress={onEditInfo}
          />
          <DesignButton
            label={t('여행 기간 변경')}
            disabled={disabled}
            icon={(color) => (
              <Ionicons name="calendar-outline" size={18} color={color} />
            )}
            onPress={onEditPeriod}
          />
          <DesignButton
            label={t('여행 도시 관리')}
            disabled={disabled}
            icon={(color) => (
              <Ionicons name="location-outline" size={18} color={color} />
            )}
            onPress={onEditDestinations}
          />
        </>
      )}
      {onDeleteOrLeave && (
        <DesignButton
          label={owner ? t('여행 삭제') : t('여행 나가기')}
          variant="danger"
          disabled={disabled}
          icon={(color) => (
            <Ionicons
              name={owner ? 'trash-outline' : 'exit-outline'}
              size={18}
              color={color}
            />
          )}
          onPress={onDeleteOrLeave}
        />
      )}
    </ActionSheet>
  );
}

const s = StyleSheet.create({
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    width: '100%',
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  pill: {
    minHeight: 48,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 9999,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedPill: {
    backgroundColor: colors.brandCoral,
    borderColor: colors.brandCoral,
  },
  pressed: { opacity: 0.88 },
  focused: { outlineColor: colors.focus, outlineWidth: 2, outlineOffset: 2 },
  label: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  selectedLabel: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  groupHeader: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 2,
  },
});
