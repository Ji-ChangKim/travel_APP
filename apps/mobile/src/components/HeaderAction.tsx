import { Ionicons } from '@expo/vector-icons';
import DesignButton from './DesignButton';
import { designTokens } from '@/constants/theme';

const icons = {
  back: 'arrow-back',
  close: 'close',
  more: 'ellipsis-horizontal',
  search: 'search-outline',
  account: 'person-outline',
  add: 'add',
} as const;

// 헤더 행동의 의미·아이콘·크기·눌림·초점·잠금을 공통 버튼에 연결한다.
export default function HeaderAction({
  icon,
  label,
  onPress,
  disabled,
  expanded,
}: {
  icon: keyof typeof icons;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  expanded?: boolean;
}) {
  // 아이콘 그림과 실제 터치 영역을 분리하고 결과를 읽기 이름으로 제공한다.
  return (
    <DesignButton
      label=""
      accessibilityLabel={label}
      variant="quiet"
      size="icon"
      disabled={disabled}
      expanded={expanded}
      onPress={onPress}
      icon={(color) => {
        // 모든 헤더 아이콘은 승인된 동일 크기와 상태색을 사용한다.
        return (
          <Ionicons
            name={icons[icon]}
            size={designTokens.navigation.headerIconSize}
            color={color}
          />
        );
      }}
    />
  );
}
