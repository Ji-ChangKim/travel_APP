import { ledgerShellStyles as local } from './ledgerShellStyles';
import {
  ledgerActionContainer,
  ledgerActionForeground,
} from './ledgerActionAppearance';
import { useState, type ReactNode } from 'react';
import { Image, Pressable, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, usePathname, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Text from '@/components/AppText';
import ScreenHeader from '@/components/ScreenHeader';
import { useAppAccessibility } from '@/features/accessibility/appAccessibility';
import { requestScheduleExit } from './scheduleExitGuard';
import { useFormScope } from './InputFeedback';
import {
  ledgerColors as c,
  ledgerStyles as s,
  ledgerLayout,
} from './ledgerTheme';

// 시안의 넓은 화면은 실제 가용 폭과 글자 배율로만 전환한다.
export function useLedgerWide(): boolean {
  // 큰 글자는 두 열에 가두지 않고 모바일과 같은 한 열로 읽는다.
  const { width } = useWindowDimensions();
  const { largeText } = useAppAccessibility();
  return width >= ledgerLayout.breakpoint && !largeText;
}

// 신규 시안의 행동도 처리 중 잠금과 선택 의미를 유지한다.
export function LedgerAction({
  label,
  accessibilityLabel,
  onPress,
  primary = false,
  quiet = false,
  selected,
  checked,
  disabled = false,
  loading = false,
  variant,
  allowWhileLocked = false,
}: {
  label: string;
  accessibilityLabel?: string;
  onPress: () => void;
  primary?: boolean;
  quiet?: boolean;
  selected?: boolean;
  checked?: boolean;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'quiet' | 'danger' | 'destructive';
  allowWhileLocked?: boolean;
}) {
  // 단일 선택은 채움, 다중 선택은 고정된 체크 공간을 사용한다.
  const [focused, setFocused] = useState(false);
  const scope = useFormScope();
  const emphasized =
    primary ||
    variant === 'primary' ||
    variant === 'danger' ||
    variant === 'destructive';
  const blocked = disabled || loading || (scope.locked && !allowWhileLocked);
  const filled = emphasized || (selected && checked === undefined);
  return (
    <Pressable
      accessibilityRole={checked === undefined ? 'button' : 'checkbox'}
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{
        disabled: blocked,
        busy: loading,
        selected,
        checked,
      }}
      aria-selected={selected}
      aria-checked={checked}
      aria-busy={loading}
      disabled={blocked}
      onPress={onPress}
      onFocus={() => {
        // 키보드 초점도 가시적인 경계로 표시한다.
        return setFocused(true);
      }}
      onBlur={() => {
        // 초점이 떠난 버튼의 강조만 해제한다.
        return setFocused(false);
      }}
      style={({ pressed }) => {
        // 누르기/선택 전후 경계 두께와 글꼴은 고정한다.
        return [
          local.button,
          ledgerActionContainer({
            emphasized,
            blocked,
            filled: Boolean(filled),
            checked,
            quiet: quiet || variant === 'quiet',
            focused,
            pressed,
          }),
        ];
      }}
    >
      {checked !== undefined && (
        <Ionicons
          name={checked ? 'checkbox' : 'square-outline'}
          size={24}
          color={c.ink}
        />
      )}
      <Text
        style={[
          local.buttonText,
          { color: ledgerActionForeground(blocked, Boolean(filled)) },
        ]}
      >
        {loading ? '처리 중…' : label}
      </Text>
    </Pressable>
  );
}

const destinations: {
  label: string;
  path: Href;
  match: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { label: '홈', path: '/(tabs)', match: '/', icon: 'home-outline' },
  {
    label: '내 여행',
    path: '/plans',
    match: '/plans',
    icon: 'calendar-outline',
  },
  {
    label: '발자국',
    path: '/(tabs)/footprints',
    match: '/footprints',
    icon: 'footsteps-outline',
  },
  {
    label: '발견',
    path: '/(tabs)/community',
    match: '/community',
    icon: 'compass-outline',
  },
  { label: 'MY', path: '/(tabs)/my', match: '/my', icon: 'person-outline' },
];

// 시안의 로고 자리에는 앱에 포함된 원본 로고만 사용한다.
export function LedgerBrand() {
  // 외부 예시 로고나 가짜 사용자 사진은 가져오지 않는다.
  return (
    <Image
      source={require('../../../assets/brand/tripprint-v1/TripPrint_logo-horizontal_1024x320.png')}
      resizeMode="contain"
      accessibilityLabel="TripPrint 트립프린트"
      style={{ width: 132, height: 42 }}
    />
  );
}

// 모바일과 태블릿은 같은 실제 화면 내용을 다른 배치로 표시한다.
export function LedgerScreen({
  children,
  title,
  onBack,
  action,
}: {
  children: ReactNode;
  title?: string;
  onBack?: () => void;
  action?: ReactNode;
}) {
  // 기기 회전과 글자 확대 시에도 저장 상태를 복제하지 않는다.
  const wide = useLedgerWide();
  const router = useRouter();
  const path = usePathname();
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={s.screen}>
      <View style={{ flex: 1, flexDirection: 'row' }}>
        {wide && (
          <View style={local.sidebar}>
            <LedgerBrand />
            {destinations.map((item) => {
              // 사이드바는 실제 기존 목적지와 이탈 보호를 사용한다.
              return (
                <LedgerAction
                  key={item.label}
                  label={item.label}
                  selected={
                    path === item.match ||
                    (item.match === '/footprints' && path.startsWith('/diary/'))
                  }
                  onPress={() => {
                    // 편집 초안을 버리지 않고 기존 보호 절차를 거친다.
                    return requestScheduleExit(() => router.replace(item.path));
                  }}
                />
              );
            })}
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={local.brandBar}>
            {!wide ? (
              <LedgerBrand />
            ) : (
              <Text style={s.meta}>여행의 순간을 기록해요</Text>
            )}
            <LedgerAction
              label="MY"
              quiet
              onPress={() => {
                // 실제 계정 화면으로 이동한다.
                return requestScheduleExit(() => router.push('/(tabs)/my'));
              }}
            />
          </View>
          {title && (
            <ScreenHeader
              title={title}
              inlineTitle={Boolean(onBack)}
              onBack={onBack}
              right={action}
            />
          )}
          {children}
        </View>
      </View>
    </SafeAreaView>
  );
}
