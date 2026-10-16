import { useAppAccessibility } from '@/features/accessibility/appAccessibility';
import { createContext, useContext } from 'react';
import {
  Platform,
  StyleSheet,
  Text as NativeText,
  type TextProps,
} from 'react-native';
import { colors, typography } from '@/constants/theme';
import { AppFontsReady } from './AppFontProvider';

const TextAncestor = createContext(false);
type Props = TextProps & { variant?: 'body' | 'navigation' };

// 스타일이 없는 본문에도 공통 글자색과 행간을 적용한다.
export default function AppText(props: Props) {
  // 중첩 글자는 부모의 크기를 상속해 로고와 강조 문구가 줄어들지 않게 한다.
  return (
    <TextView
      {...props}
      nested={useContext(TextAncestor)}
      fontsReady={useContext(AppFontsReady)}
    />
  );
}

// 텍스트 자식에게 상속 여부만 전달한다.
function TextView({
  nested,
  fontsReady,
  style,
  variant = 'body',
  ...props
}: Props & { nested: boolean; fontsReady: boolean }) {
  const { fontScale } = useAppAccessibility();
  // 큰 글자는 보존하고 작은 안내와 중첩 날짜에도 최소 크기를 적용한다.
  return (
    <TextAncestor.Provider value>
      <NativeText
        {...props}
        style={[
          !nested && s.body,
          style,
          nested &&
            StyleSheet.flatten(style)?.fontSize !== undefined && {
              fontSize:
                textSize(style, variant) *
                (Platform.OS === 'web' ? fontScale : 1),
              lineHeight:
                textLineHeight(style, variant) *
                (Platform.OS === 'web' ? fontScale : 1),
            },
          !nested && {
            fontSize: textSize(style, variant),
            lineHeight: textLineHeight(style, variant),
          },
          !nested && fontsReady && { fontFamily: textFont(style) },
          !nested &&
            Platform.OS === 'web' && {
              fontSize: textSize(style, variant) * fontScale,
              lineHeight: textLineHeight(style, variant) * fontScale,
            },
        ]}
      />
    </TextAncestor.Provider>
  );
}

// 별도 행간이 없는 큰 글자도 위아래가 잘리지 않게 한다.
function textLineHeight(
  style: TextProps['style'],
  variant: Props['variant'],
): number {
  // 작은 안내를 키울 때 행간도 함께 확보하고 메뉴만 20px을 허용한다.
  return Math.max(
    StyleSheet.flatten(style)?.lineHeight ??
      Math.max(
        textSize(style, variant) >= 16 ? typography.bodyMedium.lineHeight : 20,
        Math.ceil(textSize(style, variant) * 1.4),
      ),
    variant === 'navigation'
      ? typography.navigation.lineHeight
      : typography.bodySmall.lineHeight,
  );
}

// 보조 정보는 14px 이상이며 짧은 하단 메뉴만 13px을 허용한다.
function textSize(
  style: TextProps['style'],
  variant: Props['variant'],
): number {
  // 화면별 큰 글자 크기를 유지하고 작게 지정한 글자만 올린다.
  return Math.max(
    StyleSheet.flatten(style)?.fontSize ?? typography.bodyMedium.size,
    variant === 'navigation'
      ? typography.navigation.size
      : typography.bodySmall.size,
  );
}

// 등록된 실제 글꼴 파일에 맞춰 본문과 강조 굵기를 구분한다.
function textFont(style: TextProps['style']): string {
  // 숫자 굵기와 bold 표기를 모두 같은 강조 글꼴에 연결한다.
  return (
    StyleSheet.flatten(style)?.fontFamily ||
    (Number(StyleSheet.flatten(style)?.fontWeight) >= 700 ||
    StyleSheet.flatten(style)?.fontWeight === 'bold'
      ? 'TripPrintBold'
      : Number(StyleSheet.flatten(style)?.fontWeight) >= 600
        ? 'TripPrintSemibold'
        : 'TripPrintRegular')
  );
}

const s = StyleSheet.create({
  body: {
    color: colors.text,
    fontSize: typography.bodyMedium.size,
    lineHeight: typography.bodyMedium.lineHeight,
    fontWeight: '400',
  },
});
