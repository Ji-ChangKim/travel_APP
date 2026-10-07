import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTripStore } from '@/stores/useTripStore';
import { colors } from '@/constants/theme';

const items = [
  {
    label: '홈',
    path: '/(tabs)' as const,
    match: '/',
    icon: 'home-outline' as const,
  },
  {
    label: '발자국',
    path: '/(tabs)/footprints' as const,
    match: '/footprints',
    icon: 'footsteps-outline' as const,
  },
  {
    label: '커뮤니티',
    path: '/(tabs)/community' as const,
    match: '/community',
    icon: 'people-outline' as const,
  },
  {
    label: '마이',
    path: '/(tabs)/my' as const,
    match: '/my',
    icon: 'person-outline' as const,
  },
];

// 전체 화면 스택 밖에서 하단 내비게이션을 항상 유지한다.
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
  // 로그인 전에도 메뉴를 노출하며 선택이 필요한 상태에서는 이동만 제한한다.
  return (
    <View
      accessibilityLabel="하단 내비게이션"
      style={{
        backgroundColor: colors.surface,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingBottom: bottom,
        flexDirection: 'row',
        zIndex: 100,
        elevation: 20,
      }}
    >
      {items.map((item) => (
        // 현재 페이지를 읽을 수 있는 선택 상태와 넓은 터치 영역을 제공한다.
        <Pressable
          key={item.label}
          accessibilityRole="button"
          accessibilityLabel={`${item.label} 탭`}
          accessibilityState={{
            disabled: !allowed,
            selected: path === item.match,
          }}
          disabled={!allowed}
          onPress={() => {
            // 같은 탭 재선택 시에도 상세 화면을 닫고 탭의 첫 화면으로 이동한다.
            return router.replace(item.path);
          }}
          style={{
            flex: 1,
            height: 60,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 3,
            opacity: allowed ? 1 : 0.55,
          }}
        >
          <Ionicons
            name={item.icon}
            size={23}
            color={path === item.match ? colors.accent : colors.muted}
          />
          <Text
            style={{
              fontSize: 11,
              fontWeight: '600',
              color: path === item.match ? colors.accent : colors.muted,
            }}
          >
            {item.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
