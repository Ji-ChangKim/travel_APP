import { Pressable, StyleSheet, View } from 'react-native';
import { useState } from 'react';
import DesignButton from '@/components/DesignButton';
import ActionSheet from '@/components/ActionSheet';
import Text from '@/components/AppText';
import { colors } from '@/constants/theme';
import { workspaceSections } from './presentation';

// 핵심 세 영역만 고정하고 부가 기능은 헤더 메뉴에서 연다.
export function TripSectionNavigation({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (section: string) => void;
}) {
  // 보조 영역을 열었을 때 핵심 탭을 선택한 것처럼 표시하지 않는다.
  return (
    <View
      accessibilityLabel="여행 작업 영역"
      testID="trip-section-navigation"
      style={s.nav}
    >
      {workspaceSections.slice(0, 3).map(([key, label]) => (
        <SectionButton
          key={key}
          label={label}
          selected={selected === key}
          onPress={() => {
            /* 실제 영역 하나만 연다. */ return onSelect(key);
          }}
        />
      ))}
    </View>
  );
}

// 고정 내비게이션은 체크 아이콘 대신 밑줄로 선택을 표시한다.
function SectionButton({
  label,
  accessibilityLabel = label,
  selected,
  onPress,
}: {
  label: string;
  accessibilityLabel?: string;
  selected: boolean;
  onPress: () => void;
}) {
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
      <Text style={s.label}>{label}</Text>
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
  // 기존 소유자 권한에 맞는 항목만 표시한다.
  return (
    <ActionSheet title="여행 더보기" visible={visible} onClose={onClose}>
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
            label={label}
            selected={key === selected}
            onPress={() => {
              /* 선택한 보조 화면으로 이동한다. */ return onSelect(key);
            }}
          />
        ))}
      {owner && (
        <>
          <Text accessibilityRole="header" style={s.label}>
            여행 관리
          </Text>
          <DesignButton
            label="여행 정보 / 기록 정리"
            disabled={disabled}
            onPress={onEditInfo}
          />
          <DesignButton
            label="여행 기간 변경"
            disabled={disabled}
            onPress={onEditPeriod}
          />
          <DesignButton
            label="여행 도시 관리"
            disabled={disabled}
            onPress={onEditDestinations}
          />
        </>
      )}
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
  nav: { flexDirection: 'row', gap: 6, width: '100%' },
  tab: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    paddingHorizontal: 4,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  selected: {
    backgroundColor: colors.selectedSurface,
    borderBottomColor: colors.text,
  },
  pressed: { backgroundColor: colors.surfaceMuted },
  focused: { outlineColor: colors.focus, outlineWidth: 2, outlineOffset: 2 },
  label: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '600',
    textAlign: 'center',
  },
});
