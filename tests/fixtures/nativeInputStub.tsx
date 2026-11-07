import { forwardRef, useImperativeHandle, useRef } from 'react';
import type {
  TextInput as NativeTextInput,
  TextInputProps,
} from 'react-native';

declare global {
  interface Window {
    inputSyncCommands: { kind: string; text: string }[];
  }
}

window.inputSyncCommands = [];

// 네이티브 IME 대역이 아니라, 어댑터가 요청하는 명시적 값 동기화만 관찰한다.
export const TextInput = forwardRef<NativeTextInput, TextInputProps>(
  function Stub({ defaultValue, onChangeText, testID }, ref) {
    const input = useRef<HTMLTextAreaElement>(null);
    useImperativeHandle(
      ref,
      () =>
        ({
          clear: () => {
            window.inputSyncCommands.push({ kind: 'clear', text: '' });
            input.current!.value = '';
          },
          setNativeProps: ({ text }: { text: string }) => {
            window.inputSyncCommands.push({ kind: 'replace', text });
            input.current!.value = text;
          },
        }) as unknown as NativeTextInput,
      [],
    );
    return (
      <textarea
        ref={input}
        data-testid={testID}
        defaultValue={defaultValue}
        onChange={(event) => onChangeText?.(event.target.value)}
      />
    );
  },
);
