import Text from '@/components/AppText';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { colors, radii, typography } from '@/constants/theme';

type Variant = 'primary' | 'secondary' | 'danger' | 'quiet';
interface Props {
  label: string;
  accessibilityLabel?: string;
  onPress: () => void;
  variant?: Variant;
  selected?: boolean;
  checked?: boolean;
  expanded?: boolean;
  disabled?: boolean;
  loading?: boolean;
  size?: 'default' | 'chip' | 'icon' | 'day';
  icon?: (color: string) => ReactNode;
}

// 주요·보조·위험 행동의 표시 상태를 한 컴포넌트에서 통일한다.
export default function DesignButton(props: Props) {
  // 초점 상태는 각 버튼 안에서만 유지한다.
  return <ButtonView {...props} focusState={useState(false)} />;
}

// 버튼의 의미와 실제 잠금 상태에 맞는 글자색을 선택한다.
function foreground(props: Props, pressed = false): string {
  // 비활성 상태를 선택이나 주요 행동보다 먼저 처리한다.
  return props.disabled
    ? colors.muted
    : props.variant === 'danger'
      ? colors.danger
      : props.selected
        ? colors.selected
        : props.variant === 'primary'
          ? pressed
            ? colors.actionPressedForeground
            : colors.actionForeground
          : props.variant === 'quiet'
            ? colors.secondary
            : colors.text;
}

// 색 외에도 체크·초점 테두리·실제 disabled 속성으로 상태를 전달한다.
function ButtonView({
  focusState: [focused, setFocused],
  ...props
}: Props & { focusState: [boolean, (value: boolean) => void] }) {
  // 코랄 버튼은 눌림 배경과 전경을 함께 바꾸어 대비를 유지한다.
  return (
    <Pressable
      accessibilityRole={props.checked === undefined ? 'button' : 'checkbox'}
      accessibilityLabel={props.accessibilityLabel || props.label}
      aria-selected={props.selected}
      aria-checked={props.checked}
      aria-expanded={props.expanded}
      aria-busy={props.loading}
      accessibilityState={{
        disabled: Boolean(props.disabled || props.loading),
        selected: props.selected,
        checked: props.checked,
        expanded: props.expanded,
        busy: props.loading,
      }}
      disabled={props.disabled || props.loading}
      onPress={props.onPress}
      onFocus={() => {
        // 키보드와 보조기기 초점을 표시한다.
        return setFocused(true);
      }}
      onBlur={() => {
        // 다른 컨트롤로 이동하면 초점 표시를 해제한다.
        return setFocused(false);
      }}
      style={({ pressed }) => {
        // 주요 행동과 선택 상태를 서로 다른 토큰으로 표시한다.
        return [
          s.button,
          props.checked !== undefined && s.checkbox,
          props.variant === 'primary' && s.primary,
          props.variant === 'quiet' && s.quiet,
          props.variant === 'danger' && s.danger,
          props.size === 'chip' && s.chip,
          props.size === 'icon' && s.icon,
          props.size === 'day' && s.day,
          pressed && s.pressed,
          pressed && props.variant === 'primary' && s.primaryPressed,
          props.selected && s.selected,
          pressed && props.selected && s.pressed,
          props.disabled && s.disabled,
          focused && s.focused,
        ];
      }}
    >
      {({ pressed }) => {
        // 실제 누름 상태를 글자와 아이콘에도 같은 값으로 전달한다.
        return <ButtonContents {...props} pressed={pressed} />;
      }}
    </Pressable>
  );
}

// 로딩·선택·아이콘·라벨을 같은 상태별 전경색으로 표시한다.
function ButtonContents(props: Props & { pressed: boolean }) {
  // 비활성은 읽히는 회색을 유지하고 로딩은 기본 버튼 색을 보존한다.
  return (
    <>
      {props.loading ? (
        <ActivityIndicator
          color={foreground(props, props.pressed)}
          size="small"
        />
      ) : props.selected && props.size !== 'day' ? (
        <Text
          accessible={false}
          style={[s.label, { color: foreground(props, props.pressed) }]}
        >
          ✓
        </Text>
      ) : props.icon ? (
        <View accessible={false}>
          {props.icon(foreground(props, props.pressed))}
        </View>
      ) : null}
      {props.label ? (
        <Text
          style={[
            s.label,
            (props.size === 'chip' || props.size === 'day') && s.compactLabel,
            { color: foreground(props, props.pressed) },
          ]}
        >
          {props.label}
        </Text>
      ) : null}
    </>
  );
}

const s = StyleSheet.create({
  button: {
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primary: {
    minHeight: 52,
    backgroundColor: colors.actionPrimary,
    borderColor: colors.text,
  },
  checkbox: { justifyContent: 'flex-start' },
  chip: {
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.pill,
  },
  icon: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  day: {
    minHeight: 44,
    paddingHorizontal: 0,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    gap: 0,
  },
  compactLabel: { fontSize: 14, lineHeight: 22, fontVariant: ['tabular-nums'] },
  primaryPressed: {
    backgroundColor: colors.actionPressed,
    borderColor: colors.text,
  },
  quiet: { backgroundColor: 'transparent', borderColor: 'transparent' },
  danger: { backgroundColor: colors.dangerSoft, borderColor: colors.danger },
  selected: {
    backgroundColor: colors.selectedSurface,
    borderColor: colors.selected,
  },
  pressed: { backgroundColor: colors.surfaceMuted },
  disabled: {
    backgroundColor: colors.disabledSurface,
    borderColor: colors.border,
  },
  focused: {
    borderColor: colors.focus,
    outlineColor: colors.focus,
    outlineWidth: 2,
    outlineOffset: 2,
  },
  label: {
    fontSize: typography.labelLarge.size,
    lineHeight: typography.labelLarge.lineHeight,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'center',
  },
});
