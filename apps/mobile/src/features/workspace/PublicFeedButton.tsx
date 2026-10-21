import { useState, type ReactNode } from 'react';
import { Pressable, type StyleProp, type ViewStyle } from 'react-native';
import {
  publicFeedStyles as s,
  publicFeedColors as c,
} from './publicFeedStyles';

// 시안의 버튼에도 키보드 초점과48 이상 터치 영역을 제공한다.
export default function PublicFeedButton({
  label,
  children,
  onPress,
  style,
  selected,
  expanded,
  disabled = false,
}: {
  label: string;
  children: ReactNode;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  selected?: boolean;
  expanded?: boolean;
  disabled?: boolean;
}) {
  // 초점만 로컬에 보관하고 실제 선택은 상위 상태를 따른다.
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, expanded, disabled }}
      disabled={disabled}
      onPress={onPress}
      onFocus={() => {
        /* 키보드 초점을 표시한다. */ return setFocused(true);
      }}
      onBlur={() => {
        /* 이동한 초점을 해제한다. */ return setFocused(false);
      }}
      style={({ pressed }) => [
        style,
        pressed && s.pressed,
        focused && {
          outlineWidth: 2,
          outlineStyle: 'solid',
          outlineColor: c.primary,
        },
      ]}
    >
      {children}
    </Pressable>
  );
}
