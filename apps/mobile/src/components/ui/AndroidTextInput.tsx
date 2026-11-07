import {
  forwardRef,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { TextInput, type TextInputProps } from 'react-native';

// Android IME가 편집 중인 문자열과 커서를 매 키 입력마다 JS에서 덮어쓰지 않는다.
export default forwardRef<TextInput, TextInputProps>(function AndroidTextInput(
  { value, defaultValue, onChangeText, ...props },
  forwardedRef,
) {
  const input = useRef<TextInput>(null);
  const initial = useRef(value ?? defaultValue ?? '');
  const nativeValue = useRef(initial.current);
  const [, refresh] = useState(0);
  useImperativeHandle(forwardedRef, () => input.current!, []);
  useLayoutEffect(() => {
    // 지우기·초안 복원·blur 정규화처럼 외부에서 바뀐 값만 명시적으로 동기화한다.
    if (value !== undefined && value !== nativeValue.current) {
      nativeValue.current = value;
      if (value === '') input.current?.clear();
      else input.current?.setNativeProps({ text: value });
    }
  });
  return (
    <TextInput
      {...props}
      ref={input}
      defaultValue={initial.current}
      onChangeText={(text) => {
        nativeValue.current = text;
        onChangeText?.(text);
        // 부모가 같은 값으로 편집을 거부한 경우에도 원래 controlled 계약을 확인한다.
        refresh((revision) => revision + 1);
      }}
    />
  );
});
