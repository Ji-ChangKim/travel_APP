import Text from '@/components/AppText';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { colors, radii, typography, designTokens } from '@/constants/theme';

type Variant = 'primary' | 'secondary' | 'danger' | 'destructive' | 'quiet';
interface Props {
  label: string;
  accessibilityLabel?: string;
  onPress: () => void;
  variant?: Variant;
  selected?: boolean;
  selectionStyle?: 'check' | 'fill';
  checked?: boolean;
  expanded?: boolean;
  disabled?: boolean;
  loading?: boolean;
  size?: 'default' | 'chip' | 'icon' | 'day' | 'header';
  icon?: (color: string) => ReactNode;
}

// 주요·보조·위험 행동의 표시 상태를 한 컴포넌트에서 통일한다.
export default function DesignButton(props: Props) {
  // 단일 선택은 채움색으로 표시하고 다중 체크는 별도 checked 상태를 사용한다.
  return (
    <ButtonView
      {...props}
      selectionStyle={
        props.checked === undefined ? props.selectionStyle || 'fill' : 'check'
      }
      focusState={useState(false)}
    />
  );
}

// 버튼의 의미와 실제 잠금 상태에 맞는 글자색을 선택한다.
function foreground(props: Props, pressed = false): string {
  // 비활성 상태를 선택이나 주요 행동보다 먼저 처리한다.
  return props.disabled
    ? colors.muted
    : props.variant === 'destructive'
      ? colors.textLight
      : props.variant === 'danger'
        ? colors.danger
        : props.selected
          ? props.selectionStyle === 'fill'
            ? colors.selectedFillText
            : colors.selected
          : props.variant === 'primary'
            ? pressed
              ? colors.actionPressedForeground
              : colors.actionForeground
            : props.variant === 'quiet'
              ? props.size === 'icon' || props.size === 'header'
                ? colors.text
                : colors.secondary
              : colors.text;
}

// 선택 방식과 초점 테두리·실제 disabled 속성으로 상태를 전달한다.
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
          props.variant === 'destructive' && s.destructive,
          props.size === 'chip' && s.chip,
          props.size === 'icon' && s.icon,
          props.size === 'day' && s.day,
          props.size === 'header' && s.header,
          pressed && s.pressed,
          pressed && props.variant === 'primary' && s.primaryPressed,
          props.selected && s.selected,
          pressed && props.selected && s.pressed,
          props.selected && props.selectionStyle === 'fill' && s.selectedFill,
          pressed &&
            props.selected &&
            props.selectionStyle === 'fill' &&
            s.selectedFillPressed,
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
      {(props.selected !== undefined || props.checked !== undefined) &&
      props.selectionStyle !== 'fill' &&
      props.size !== 'day' ? (
        <SelectionIndicator {...props} />
      ) : props.loading ? (
        <ActivityIndicator
          color={foreground(props, props.pressed)}
          size="small"
        />
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
            props.selected &&
              props.selectionStyle === 'fill' &&
              s.selectedLabel,
            { color: foreground(props, props.pressed) },
          ]}
        >
          {props.label}
        </Text>
      ) : null}
    </>
  );
}

// 선택 전에도 같은 체크 공간을 확보해 버튼과 주변 항목의 크기를 유지한다.
function SelectionIndicator(props: Props & { pressed: boolean }) {
  // 투명한 같은 글자가 글꼴 확대까지 따라가며 실제 표시만 겹쳐 바꾼다.
  return (
    <View
      accessible={false}
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        s.indicator,
        props.checked !== undefined && s.checkIndicator,
        props.checked && s.checkedIndicator,
      ]}
    >
      <Text accessible={false} style={[s.label, { opacity: 0 }]}>
        ✓
      </Text>
      <View pointerEvents="none" style={s.indicatorContent}>
        {props.loading ? (
          <ActivityIndicator
            color={foreground(props, props.pressed)}
            size="small"
          />
        ) : props.selected || props.checked ? (
          <Text
            accessible={false}
            style={[
              s.label,
              {
                color: props.checked
                  ? colors.surface
                  : foreground(props, props.pressed),
              },
            ]}
          >
            ✓
          </Text>
        ) : props.icon ? (
          props.icon(foreground(props, props.pressed))
        ) : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  indicator: { flexShrink: 0 },
  checkIndicator: {
    minWidth: 24,
    minHeight: 24,
    borderWidth: 1,
    borderRadius: 4,
    borderColor: colors.borderStrong,
  },
  checkedIndicator: { backgroundColor: colors.text, borderColor: colors.text },
  indicatorContent: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
    minHeight: designTokens.accessibility.minimumTouchTarget,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.pill,
  },
  icon: {
    flexShrink: 0,
    minHeight: designTokens.accessibility.minimumTouchTarget,
    minWidth: designTokens.accessibility.minimumTouchTarget,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  header: {
    flexShrink: 0,
    minWidth: designTokens.accessibility.minimumTouchTarget,
    minHeight: designTokens.accessibility.minimumTouchTarget,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  day: {
    minHeight: designTokens.accessibility.minimumTouchTarget,
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
  destructive: { backgroundColor: colors.danger, borderColor: colors.danger },
  selected: {
    backgroundColor: colors.selectedSurface,
    borderColor: colors.selected,
  },
  selectedFill: {
    backgroundColor: colors.selectedFill,
    borderColor: colors.selectedFill,
  },
  selectedFillPressed: {
    backgroundColor: colors.primaryPressed,
    borderColor: colors.primaryPressed,
  },
  selectedLabel: { textDecorationLine: 'underline' },
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
