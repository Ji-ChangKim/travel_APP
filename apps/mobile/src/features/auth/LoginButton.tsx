import type { ReactNode } from 'react';
import { Pressable, Text } from 'react-native';
import { loginStyles as styles } from './loginStyles';

// 인증 화면의 버튼을 터치 상태와 접근성 정보에 맞춰 표시한다.
export default function LoginButton({
  label,
  onPress,
  disabled = false,
  busy = false,
  variant = 'quiet',
  icon,
  trailing,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  variant?: 'google' | 'email' | 'primary' | 'quiet';
  icon?: ReactNode;
  trailing?: ReactNode;
}) {
  // 로딩 중에도 버튼의 이름과 터치 영역을 유지한다.
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, busy }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => {
        // 눌림과 비활성 상태를 각각 시각적으로 구분한다.
        return [
          styles.button,
          styles[`${variant}Button`],
          disabled && styles.disabled,
          pressed && styles.pressed,
        ];
      }}
    >
      {icon}
      <Text
        style={[
          styles.buttonText,
          variant === 'google' && styles.googleText,
          variant === 'email' && styles.emailText,
          variant === 'primary' && styles.primaryText,
        ]}
      >
        {label}
      </Text>
      {trailing}
    </Pressable>
  );
}
