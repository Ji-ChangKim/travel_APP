import Text from '@/components/AppText';
import DesignButton from '@/components/DesignButton';
import DesignInput from '@/components/DesignInput';
import { TextInput, View, type KeyboardTypeOptions } from 'react-native';
import { useRef, type ReactNode } from 'react';
import { FormAnchor, focusFormInput, useFormScope } from './InputFeedback';
import TripIcon, { type TripIconName } from '@/components/icons/TripIcon';
import { scheduleStyles as s } from './scheduleTheme';

// 일정 화면의 행동 하나를 충분한 터치 영역과 함께 제공한다.
export function ScheduleButton({
  label,
  icon,
  onPress,
  disabled = false,
  primary = false,
  selected,
  selectionStyle,
  accessibilityLabel,
  allowWhileLocked = false,
}: {
  label: string;
  icon?: TripIconName;
  onPress: () => void;
  disabled?: boolean;
  primary?: boolean;
  selected?: boolean;
  selectionStyle?: 'check' | 'fill';
  accessibilityLabel?: string;
  allowWhileLocked?: boolean;
}) {
  // 선택 여부와 처리 중 상태를 보조기기에도 전달한다.
  return (
    <DesignButton
      label={label}
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      disabled={(useFormScope().locked && !allowWhileLocked) || disabled}
      variant={primary ? 'primary' : 'secondary'}
      selected={selected}
      selectionStyle={selectionStyle}
      icon={
        icon
          ? (color) => {
              // 선택 아이콘은 실제 버튼 글자색과 같은 대비를 갖는다.
              return <TripIcon name={icon} size={18} color={color} />;
            }
          : undefined
      }
    />
  );
}

// 시각 라벨과 기존 접근성 이름을 함께 유지하는 입력을 제공한다.
export function ScheduleField({
  label,
  accessibilityLabel = label,
  value,
  onChange,
  multiline = false,
  keyboardType,
  placeholder,
  disabled = false,
}: {
  label: string;
  accessibilityLabel?: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  keyboardType?: KeyboardTypeOptions;
  placeholder?: string;
  disabled?: boolean;
}) {
  // 실제 입력만 부모 폼에 전달한다.
  return (
    <BoundScheduleField
      label={label}
      accessibilityLabel={accessibilityLabel}
      value={value}
      onChange={onChange}
      multiline={multiline}
      keyboardType={keyboardType}
      placeholder={placeholder}
      disabled={useFormScope().locked || disabled}
      input={useRef<TextInput>(null)}
    />
  );
}

// 일정 입력의 초점과 잠금 상태를 공통 폼에 연결한다.
function BoundScheduleField({
  input,
  ...props
}: Parameters<typeof ScheduleField>[0] & {
  accessibilityLabel: string;
  input: React.RefObject<TextInput | null>;
}) {
  // 스키마 오류의 이름은 기존 접근성 라벨과 일치시킨다.
  return (
    <FormAnchor
      name={props.accessibilityLabel}
      focus={() => {
        /* 오류 이동 시에만 일정 입력 참조를 읽는다. */ return focusFormInput(
          input,
        );
      }}
    >
      <Text style={s.label}>{props.label}</Text>
      <DesignInput
        inputRef={input}
        editable={!props.disabled}
        accessibilityState={{ disabled: props.disabled }}
        accessibilityLabel={props.accessibilityLabel}
        value={props.value}
        onChangeText={props.onChange}
        multiline={props.multiline}
        keyboardType={props.keyboardType}
        placeholder={props.placeholder}
        autoCapitalize="none"
        style={[
          s.input,
          props.multiline && { minHeight: 88, textAlignVertical: 'top' },
        ]}
      />
    </FormAnchor>
  );
}

// 연관된 입력과 설명을 하나의 카드로 묶는다.
export function ScheduleSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: TripIconName;
  children: ReactNode;
}) {
  // 제목과 내용의 읽는 순서를 유지한다.
  return (
    <View style={s.card}>
      <View style={s.row}>
        {icon && <TripIcon name={icon} size={20} />}
        <Text style={s.title}>{title}</Text>
      </View>
      {children}
    </View>
  );
}
