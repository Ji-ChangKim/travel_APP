import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTripStore } from '@/stores/useTripStore';
import { colors } from '@/constants/theme';

// 좌우 4개 일반 탭 메뉴 항목을 정의한다.
const leftItems = [
  {
    label: '홈',
    path: '/(tabs)' as const,
    match: '/',
    icon: 'home-outline' as const,
    activeIcon: 'home' as const,
  },
  {
    label: '일정',
    path: '/(tabs)' as const,
    match: '/schedule',
    icon: 'calendar-outline' as const,
    activeIcon: 'calendar' as const,
  },
];

const rightItems = [
  {
    label: '발자국',
    path: '/(tabs)/footprints' as const,
    match: '/footprints',
    icon: 'map-outline' as const,
    activeIcon: 'map' as const,
  },
  {
    label: 'MY',
    path: '/(tabs)/my' as const,
    match: '/my',
    icon: 'person-outline' as const,
    activeIcon: 'person' as const,
  },
];

// 회원 또는 게스트로 시작한 뒤 하단 5단 내비게이션(중앙 FAB 포함)을 표시한다.
export default function GlobalNavigation() {
  // 안전 영역과 라우터 정보를 하단 메뉴에 연결한다.
  return (
    <NavigationContent
      bottom={useSafeAreaInsets().bottom}
      path={usePathname()}
      router={useRouter()}
      allowed={useTripStore((state) => {
        // 로그인 또는 프로필 설정을 마친 회원과 게스트만 메뉴를 이동한다.
        return Boolean(
          state.currentUser &&
          (state.currentUser.authProvider === 'guest' ||
            state.currentUser.onboardingCompleted),
        );
      })}
    />
  );
}

// 스크롤·키보드·상세 페이지와 독립된 메뉴 영역을 렌더링한다.
function NavigationContent({
  bottom,
  path,
  router,
  allowed,
}: {
  bottom: number;
  path: string;
  router: ReturnType<typeof useRouter>;
  allowed: boolean;
}) {
  // 로그인·인증 복귀·프로필 설정 중에는 하단 메뉴를 렌더링하지 않는다.
  return allowed &&
    path !== '/login' &&
    path !== '/auth/callback' &&
    path !== '/profile-setup' ? (
    <View
      accessibilityLabel="하단 내비게이션"
      style={[styles.container, { paddingBottom: bottom }]}
    >
      {leftItems.map((item) => (
        <TabItem
          key={item.label}
          item={item}
          isSelected={path === item.match}
          onPress={() => {
            // 선택한 탭 경로로 화면을 전환한다.
            return router.replace(item.path);
          }}
        />
      ))}

      <CenterCreateButton
        onPress={() => {
          // 중앙 플로팅 버튼 터치 시 새 여행 계획 생성 화면으로 이동한다.
          return router.push('/new-trip');
        }}
      />

      {rightItems.map((item) => (
        <TabItem
          key={item.label}
          item={item}
          isSelected={path === item.match}
          onPress={() => {
            // 선택한 탭 경로로 화면을 전환한다.
            return router.replace(item.path);
          }}
        />
      ))}
    </View>
  ) : null;
}

// 단일 탭 버튼을 렌더링한다.
function TabItem({
  item,
  isSelected,
  onPress,
}: {
  item: {
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    activeIcon: keyof typeof Ionicons.glyphMap;
  };
  isSelected: boolean;
  onPress: () => void;
}) {
  // 활성/비활성에 맞는 색상과 아이콘을 반환한다.
  const activeColor = '#FF5C39';
  const inactiveColor = colors.muted;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.label} 탭`}
      accessibilityState={{ selected: isSelected }}
      onPress={onPress}
      style={styles.tabButton}
    >
      <Ionicons
        name={isSelected ? item.activeIcon : item.icon}
        size={23}
        color={isSelected ? activeColor : inactiveColor}
      />
      <Text
        style={[
          styles.tabLabel,
          { color: isSelected ? activeColor : inactiveColor },
        ]}
      >
        {item.label}
      </Text>
    </Pressable>
  );
}

// 중앙 돌출형 원형 새 여행 생성 버튼(FAB)을 렌더링한다.
function CenterCreateButton({ onPress }: { onPress: () => void }) {
  // 강조된 코랄 색상과 입체감 있는 그림자가 적용된 중앙 액션 버튼을 반환한다.
  return (
    <View style={styles.fabWrapper}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="새 여행 계획 만들기"
        onPress={onPress}
        style={({ pressed }) => [
          styles.fabButton,
          pressed && styles.fabPressed,
        ]}
      >
        <Ionicons name="add" size={30} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: '#F0F2F5',
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 100,
    elevation: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  tabButton: {
    flex: 1,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  fabWrapper: {
    width: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FF5C39',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -22,
    shadowColor: '#FF5C39',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  fabPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.94 }],
  },
});
