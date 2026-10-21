import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter, useSegments } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Text from '@/components/AppText';
import { designTokens, colors } from '@/constants/theme';
import { useTopModal } from '@/features/accessibility/modalLayers';
import { requestScheduleExit } from '@/features/workspace/scheduleExitGuard';
import { hasGlobalNavigation } from './navigationPolicy';
import {
  isNavigationSelected,
  navigationItems,
  type NavigationItem,
} from './navigationModel';

const gnb = designTokens.navigation.gnb;

// 최상위 화면의 탐색 메뉴를 하단 안전 영역에 맞춰 한 번만 배치한다.
export default function GlobalNavigation() {
  // 모달 뒤의 메뉴는 읽기와 터치를 함께 차단한다.
  const modal = useTopModal();
  const path = usePathname();
  const router = useRouter();
  const bottom = useSafeAreaInsets().bottom;
  const starting = useSegments().join('/') === '';
  const pending = useRef<string | null>(null);
  const blocked = Boolean(modal && (modal.strict || modal.native));
  // 새 경로를 받은 뒤에만 다음 이동을 받아 빠른 중복 누름을 막는다.
  useEffect(() => {
    // 라우트 반영이 끝나면 다음 사용자 이동을 받을 수 있게 한다.
    pending.current = null;
  }, [path]);
  return !starting && hasGlobalNavigation(path) && !(modal && !modal.strict) ? (
    <View
      testID="global-navigation"
      accessibilityLabel="하단 내비게이션"
      accessibilityElementsHidden={blocked}
      importantForAccessibility={blocked ? 'no-hide-descendants' : 'auto'}
      aria-hidden={blocked}
      pointerEvents={blocked ? 'none' : 'auto'}
      style={[styles.container, { paddingBottom: Math.max(bottom, 4) }]}
    >
      {navigationItems.map((item) => (
        <NavigationButton
          key={item.key}
          item={item}
          selected={!item.isAction && isNavigationSelected(path, item.match)}
          onPress={() => {
            // 활성 탭 재선택은 검색 조건과 스크롤을 그대로 보존한다.
            return pending.current || isNavigationSelected(path, item.match)
              ? undefined
              : requestScheduleExit(() => {
                  // 이탈 승인을 받은 이동만 잠그고 실제 목적지로 보낸다.
                  pending.current = path;
                  return item.isAction
                    ? router.push(item.path)
                    : router.navigate(item.path);
                });
          }}
        />
      ))}
    </View>
  ) : null;
}

// 아이콘 공간과 글꼴 굵기는 선택·눌림 여부와 관계없이 유지한다.
function NavigationButton({
  item,
  selected,
  onPress,
}: {
  item: NavigationItem;
  selected: boolean;
  onPress: () => void;
}) {
  // 색과 초점 테두리만 변경해 선택 시 주변 메뉴가 움직이지 않게 한다.
  const [focused, setFocused] = useState(false);
  const foreground = item.isAction
    ? gnb.actionLabel
    : selected
      ? gnb.selectedForeground
      : gnb.foreground;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={item.isAction ? item.label : item.label + ' 탭'}
      accessibilityState={item.isAction ? undefined : { selected }}
      aria-selected={item.isAction ? undefined : selected}
      onPress={onPress}
      onFocus={() => {
        // 키보드 탐색으로 도착한 항목의 초점을 표시한다.
        return setFocused(true);
      }}
      onBlur={() => {
        // 다른 컨트롤로 이동한 초점 표시를 해제한다.
        return setFocused(false);
      }}
      style={({ pressed }) => [
        styles.item,
        !item.isAction && pressed && styles.pressed,
        focused && styles.focused,
      ]}
    >
      {({ pressed }) => {
        // 중앙 생성 행동은 선택 상태 없이 누름 색만 표현한다.
        return (
          <>
            <View testID="navigation-icon-slot" style={styles.iconSlot}>
              <View
                style={
                  item.isAction
                    ? [styles.action, pressed && styles.actionPressed]
                    : [styles.chip, selected && styles.selectedChip]
                }
              >
                <Ionicons
                  name={selected ? item.activeIcon : item.icon}
                  size={item.isAction ? gnb.actionIconSize : gnb.iconSize}
                  color={item.isAction ? gnb.actionForeground : foreground}
                />
              </View>
            </View>
            <Text
              variant="navigation"
              style={[styles.label, { color: foreground }]}
            >
              {item.label}
            </Text>
          </>
        );
      }}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: gnb.background,
    borderTopWidth: 1,
    borderTopColor: gnb.border,
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingHorizontal: 4,
    zIndex: 100,
    elevation: 12,
    overflow: 'visible',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },
  item: {
    flex: 1,
    minWidth: 48,
    minHeight: gnb.minimumHeight,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 2,
  },
  pressed: { backgroundColor: gnb.pressedBackground },
  focused: {
    outlineColor: colors.focus,
    outlineWidth: designTokens.accessibility.focusOutlineWidth,
    outlineOffset: -2,
  },
  iconSlot: {
    height: gnb.actionSize + gnb.actionOffset,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  chip: {
    width: gnb.chipWidth,
    height: gnb.chipHeight,
    borderRadius: gnb.chipRadius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedChip: { backgroundColor: gnb.selectedBackground },
  label: {
    alignSelf: 'stretch',
    textAlign: 'center',
    fontSize: designTokens.typography.navigation.size,
    lineHeight: designTokens.typography.navigation.lineHeight,
    fontWeight: String(designTokens.typography.navigation.weight) as '600',
    letterSpacing: -0.3,
  },
  action: {
    width: gnb.actionSize,
    height: gnb.actionSize,
    borderRadius: gnb.actionSize / 2,
    position: 'absolute',
    top: gnb.actionOffset,
    backgroundColor: gnb.actionBackground,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: gnb.actionBackground,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
  },
  actionPressed: { backgroundColor: gnb.actionPressedBackground },
});
