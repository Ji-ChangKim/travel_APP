import { useState, type ReactNode } from 'react';
import { Pressable, type StyleProp, type ViewStyle } from 'react-native';
import { myTripsColors } from './myTripsStyles';

// 시안의 보이는 크기를 유지하면서 작은 칩의 상하 터치 영역을 넓힌다.
export default function MyTripsButton({
  label,
  children,
  onPress,
  style,
  selected,
  compact = false,
  disabled = false,
}: {
  label: string;
  children: ReactNode;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  selected?: boolean;
  compact?: boolean;
  disabled?: boolean;
}) {
  // 키보드 초점만 로컬 상태로 보관하고 데이터 변경은 전달받은 행동에 맡긴다.
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      aria-selected={selected}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={compact ? { top: 10, bottom: 10 } : undefined}
      onFocus={() => {
        /* 초점을 표시한다. */ return setFocused(true);
      }}
      onBlur={() => {
        /* 이동한 초점을 해제한다. */ return setFocused(false);
      }}
      style={({ pressed }) => [
        style,
        pressed && { opacity: 0.8 },
        focused && {
          outlineWidth: 2,
          outlineColor: myTripsColors.primary,
          outlineStyle: 'solid',
        },
      ]}
    >
      {children}
    </Pressable>
  );
}
