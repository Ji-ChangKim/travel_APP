import { colors } from '@/constants/theme';
import { SvgXml } from 'react-native-svg';
import { tripprintIcons, type TripIconName } from './tripprint-icons';

export type { TripIconName } from './tripprint-icons';

// 디자인 원본의 벡터를 웹과 네이티브에서 같은 모양으로 표시한다.
export default function TripIcon({
  name,
  size = 24,
  color = colors.text,
}: {
  name: TripIconName;
  size?: number;
  color?: string;
}) {
  // 접근성 이름은 아이콘을 사용하는 버튼과 본문이 담당한다.
  return (
    <SvgXml
      xml={iconXml(name, color)}
      width={size}
      height={size}
      color={color}
      accessible={false}
    />
  );
}

// 원본 벡터는 보존하고 화면에서 쓰는 보조 채색만 v2 토큰에 맞춘다.
function iconXml(name: TripIconName, foreground: string): string {
  // 진한 포인트는 전경색을, 연한 포인트는 중립 배경색을 따른다.
  return tripprintIcons[name].replace(
    /#(?:ff6b57|203247|fff1ef|8fd3e8|ffc857)/gi,
    (value) => {
      // 아이콘의 형태와 선·투명도는 원본 그대로 유지한다.
      return /#(?:ff6b57|203247)/i.test(value)
        ? foreground
        : colors.surfaceMuted;
    },
  );
}
