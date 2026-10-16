import type { ReactNode } from 'react';
import { View } from 'react-native';
import DesignButton from '@/components/DesignButton';

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
    <DesignButton
      label={label}
      disabled={disabled}
      loading={busy}
      onPress={onPress}
      variant={
        variant === 'primary'
          ? 'primary'
          : variant === 'quiet'
            ? 'quiet'
            : 'secondary'
      }
      icon={
        icon || trailing
          ? () => {
              // 공급자 원본 아이콘과 보조 표시를 그대로 유지한다.
              return (
                <View style={{ flexDirection: 'row', gap: 4 }}>
                  {icon}
                  {trailing}
                </View>
              );
            }
          : undefined
      }
    />
  );
}
