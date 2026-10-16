import { useTopModal } from '@/features/accessibility/modalLayers';
import Text from '@/components/AppText';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter, useSegments } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTripStore } from '@/stores/useTripStore';
import { colors } from '@/constants/theme';
import { requestScheduleExit } from '@/features/workspace/scheduleExitGuard';
import { hasGlobalNavigation } from './navigationPolicy';

// 하루 UI Kit의 다섯 메뉴를 실제 기존 경로에 연결한다.
const items = [
  {
    label: '홈',
    path: '/(tabs)',
    match: '/',
    icon: 'home-outline',
    activeIcon: 'home',
  },
  {
    label: '내 여행',
    path: '/plans',
    match: '/plans',
    icon: 'calendar-outline',
    activeIcon: 'calendar',
  },
  {
    label: '발자국',
    path: '/(tabs)/footprints',
    match: '/footprints',
    icon: 'footsteps-outline',
    activeIcon: 'footsteps',
  },
  {
    label: '커뮤니티',
    path: '/(tabs)/community',
    match: '/community',
    icon: 'people-outline',
    activeIcon: 'people',
  },
  {
    label: 'MY',
    path: '/(tabs)/my',
    match: '/my',
    icon: 'person-outline',
    activeIcon: 'person',
  },
] as const;

// 인증·안전 영역·작성 이탈 보호를 그대로 유지한다.
export default function GlobalNavigation() {
  // 현재 라우트와 계정의 접근 상태만 메뉴에 전달한다.
  return (
    <NavigationContent
      bottom={useSafeAreaInsets().bottom}
      path={usePathname()}
      starting={useSegments().join('/') === ''}
      router={useRouter()}
      allowed={useTripStore((state) => {
        // 게스트와 가입을 마친 사용자에게 기존 여행 메뉴를 제공한다.
        return Boolean(
          state.currentUser &&
          (state.currentUser.authProvider === 'guest' ||
            state.currentUser.onboardingCompleted),
        );
      })}
    />
  );
}

// 최상위 탐색 화면에서만 같은 위치의 메뉴를 제공한다.
function NavigationContent({
  bottom,
  path,
  router,
  allowed,
  starting,
}: {
  bottom: number;
  path: string;
  router: ReturnType<typeof useRouter>;
  allowed: boolean;
  starting: boolean;
}) {
  const modal = useTopModal();
  const blocked = Boolean(modal && (modal.strict || modal.native));
  // 상세·작성 화면은 메뉴를 숨기고 선택 시트 뒤의 메뉴 조작도 막는다.
  return !starting && hasGlobalNavigation(path) && !(modal && !modal.strict) ? (
    <View
      accessibilityLabel="하단 내비게이션"
      accessibilityElementsHidden={blocked}
      importantForAccessibility={blocked ? 'no-hide-descendants' : 'auto'}
      aria-hidden={blocked}
      pointerEvents={blocked ? 'none' : 'auto'}
      style={[styles.container, { paddingBottom: bottom }]}
    >
      {items
        .filter((item) => {
          // 로그인 전 공개 탐색 범위를 확장하지 않는다.
          return allowed || item.match === '/' || item.match === '/community';
        })
        .map((item) => (
          <TabItem
            key={item.label}
            item={item}
            isSelected={selectedPath(path, item.match)}
            onPress={() => {
              // 저장하지 않은 일정은 기존 이탈 확인을 통과한 뒤 이동한다.
              return requestScheduleExit(() => {
                // 새 데이터를 만들지 않고 선택한 기존 화면으로 이동한다.
                return router.replace(item.path);
              });
            }}
          />
        ))}
    </View>
  ) : null;
}

// 여행 상세와 다이어리도 각각의 상위 메뉴에 선택 표시를 유지한다.
function selectedPath(path: string, match: string): boolean {
  // 정확한 경로와 해당 메뉴에 속하는 상세 경로만 비교한다.
  return (
    path === match ||
    (match === '/plans' &&
      (path.startsWith('/trips/') || path === '/new-trip')) ||
    (match === '/footprints' && path.startsWith('/diary/'))
  );
}

// 선택한 메뉴는 옅은 코랄 바탕과 네이비 글자·아이콘으로 표시한다.
function TabItem({
  item,
  isSelected,
  onPress,
}: {
  item: (typeof items)[number];
  isSelected: boolean;
  onPress: () => void;
}) {
  // 색상과 선택 속성을 함께 제공하고 최소 44px의 조작 영역을 보장한다.
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.label} 탭`}
      accessibilityState={{ selected: isSelected }}
      aria-selected={isSelected}
      onPress={onPress}
      style={({ pressed }) => {
        // 누름은 글자 투명도 대신 옅은 선택 배경으로 표시한다.
        return [
          styles.tabButton,
          (isSelected || pressed) && styles.selectedTab,
        ];
      }}
    >
      <Ionicons
        name={isSelected ? item.activeIcon : item.icon}
        size={23}
        color={isSelected ? colors.text : colors.muted}
      />
      <Text
        variant="navigation"
        style={[
          styles.tabLabel,
          { color: isSelected ? colors.text : colors.muted },
        ]}
      >
        {item.label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingHorizontal: 4,
    paddingTop: 4,
    zIndex: 100,
    elevation: 12,
  },
  tabButton: {
    flex: 1,
    minHeight: 60,
    paddingVertical: 8,
    paddingHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderRadius: 12,
  },
  selectedTab: { backgroundColor: colors.selectedSurface },
  tabLabel: {
    width: '100%',
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
  },
});
