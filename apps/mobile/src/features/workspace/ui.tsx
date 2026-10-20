import { styles } from './workspaceStyles';
import Text from '@/components/AppText';
import { colors } from '@/constants/theme';
import DesignButton from '@/components/DesignButton';
import DesignInput from '@/components/DesignInput';
import type { TextInput } from 'react-native';
import { useRef } from 'react';
import { FormAnchor, focusFormInput, useFormScope } from './InputFeedback';

// 폼과 읽기 화면에 공통 버튼을 표시한다.
export function Action({
  label,
  accessibilityLabel,
  onPress,
  disabled = false,
  variant = 'secondary',
  selected,
  selectionStyle,
  checked,
  allowWhileLocked = false,
  loading = false,
  size,
}: {
  label: string;
  accessibilityLabel?: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger' | 'destructive' | 'quiet';
  selected?: boolean;
  selectionStyle?: 'check' | 'fill';
  checked?: boolean;
  allowWhileLocked?: boolean;
  loading?: boolean;
  size?: 'default' | 'chip' | 'icon' | 'day' | 'header';
}) {
  // 처리 중 중복 클릭을 실제 disabled 상태로 차단한다.
  return (
    <DesignButton
      label={label}
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      disabled={
        (useFormScope().locked && !allowWhileLocked && !loading) || disabled
      }
      variant={variant}
      selected={selected}
      selectionStyle={selectionStyle}
      checked={checked}
      loading={loading}
      size={size}
    />
  );
}
// 접근성 이름을 가진 입력 필드 하나를 표시한다.
export function Field({
  label,
  value,
  onChange,
  multiline = false,
  disabled = false,
  placeholder,
  inputMode = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  disabled?: boolean;
  placeholder?: string;
  inputMode?: 'text' | 'numeric';
}) {
  // 화면의 라벨과 테스트·스크린리더 이름을 일치시킨다.
  return (
    <BoundField
      label={label}
      value={value}
      onChange={onChange}
      multiline={multiline}
      placeholder={placeholder}
      inputMode={inputMode}
      disabled={useFormScope().locked || disabled}
      input={useRef<TextInput>(null)}
    />
  );
}

// 입력값과 오류 표시를 같은 초점 대상에 연결한다.
function BoundField({
  label,
  value,
  onChange,
  multiline,
  disabled,
  input,
  placeholder,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline: boolean;
  disabled: boolean;
  input: React.RefObject<TextInput | null>;
  placeholder?: string;
  inputMode: 'text' | 'numeric';
}) {
  // 저장 중에는 실제 입력창도 편집할 수 없게 한다.
  return (
    <FormAnchor
      name={label}
      focus={() => {
        /* 오류 이동 시에만 입력 참조를 읽는다. */ return focusFormInput(input);
      }}
    >
      <Text style={styles.label}>{label}</Text>
      <DesignInput
        inputRef={input}
        editable={!disabled}
        accessibilityState={{ disabled }}
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        multiline={multiline}
        placeholder={placeholder}
        inputMode={inputMode}
        placeholderTextColor={colors.muted}
        style={[styles.input, multiline && { minHeight: 90 }]}
        autoCapitalize="none"
      />
    </FormAnchor>
  );
}
