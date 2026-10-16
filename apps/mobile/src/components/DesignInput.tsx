import { useAppAccessibility } from '@/features/accessibility/appAccessibility';
import { useContext, useState, type Ref } from 'react';
import {
  Platform,
  StyleSheet,
  TextInput,
  type TextInputProps,
} from 'react-native';
import { colors, radii, typography } from '@/constants/theme';
import { AppFontsReady } from './AppFontProvider';

type Props = TextInputProps & { inputRef?: Ref<TextInput> };

// 공통 입력에 읽기 쉬운 본문과 명확한 초점 테두리를 적용한다.
export default function DesignInput(props: Props) {
  // 입력의 초점 상태만 로컬에서 관리한다.
  return (
    <InputView
      {...props}
      focusState={useState(false)}
      fontsReady={useContext(AppFontsReady)}
    />
  );
}

// 전달받은 입력 동작과 ref는 그대로 유지한다.
function InputView({
  inputRef,
  fontsReady,
  focusState: [focused, setFocused],
  style,
  ...props
}: Props & {
  focusState: [boolean, (value: boolean) => void];
  fontsReady: boolean;
}) {
  const { fontScale } = useAppAccessibility();
  // 비활성 입력은 투명도를 낮추지 않고 배경과 실제 편집 상태로 구분한다.
  return (
    <TextInput
      {...props}
      ref={inputRef}
      placeholderTextColor={colors.muted}
      onFocus={(event) => {
        // 초점 표시와 기존 초점 알림을 함께 전달한다.
        return void (setFocused(true), props.onFocus?.(event));
      }}
      onBlur={(event) => {
        // 초점 해제와 기존 검증 알림을 함께 전달한다.
        return void (setFocused(false), props.onBlur?.(event));
      }}
      style={[
        s.input,
        fontsReady && { fontFamily: 'TripPrintRegular' },
        style,
        Platform.OS === 'web' && {
          fontSize:
            (StyleSheet.flatten(style)?.fontSize ??
              typography.bodyMedium.size) * fontScale,
          lineHeight:
            (StyleSheet.flatten(style)?.lineHeight ??
              typography.bodyMedium.lineHeight) * fontScale,
        },
        focused && s.focused,
        props.editable === false && s.disabled,
      ]}
    />
  );
}

const s = StyleSheet.create({
  input: {
    minHeight: 48,
    padding: 12,
    borderRadius: radii.input,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: typography.bodyMedium.size,
    lineHeight: typography.bodyMedium.lineHeight,
  },
  focused: {
    borderColor: colors.focus,
    outlineColor: colors.focus,
    outlineWidth: 2,
    outlineOffset: 2,
  },
  disabled: { backgroundColor: colors.disabledSurface, color: colors.muted },
});
