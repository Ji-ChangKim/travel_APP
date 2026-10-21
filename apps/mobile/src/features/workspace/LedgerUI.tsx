import { ledgerShellStyles as local } from './ledgerShellStyles';
import {
  ledgerActionContainer,
  ledgerActionForeground,
} from './ledgerActionAppearance';
import { useState, type ReactNode } from 'react';
import { Pressable, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Text from '@/components/AppText';
import ScreenHeader from '@/components/ScreenHeader';
import { useAppAccessibility } from '@/features/accessibility/appAccessibility';
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

// 모바일과 태블릿은 같은 실제 화면 내용을 다른 배치로 표시한다.
export function LedgerScreen({
  children,
  title,
  onBack,
}: {
  children: ReactNode;
  title?: string;
  onBack?: () => void;
}) {
  // 상세·작성 화면은 중복 로고나 탐색 메뉴 없이 제목에 집중한다.
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={s.screen}>
      {title && (
        <ScreenHeader
          title={title}
          inlineTitle={Boolean(onBack)}
          onBack={onBack}
        />
      )}
      {children}
    </SafeAreaView>
  );
}
