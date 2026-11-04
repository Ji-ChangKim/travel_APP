import { TouchableOpacity } from 'react-native';
import Text from '@/components/AppText';
import { useLocale } from '@/features/localization/localeState';
import { trailStyles as styles } from './trailStyles';

// 공통 접근성 버튼을 렌더링한다.
export function TrailAction({
  label,
  onPress,
  disabled = false,
  secondary = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
}) {
  useLocale();
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.button,
        secondary && styles.secondary,
        disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.buttonText, secondary && styles.secondaryText]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}
