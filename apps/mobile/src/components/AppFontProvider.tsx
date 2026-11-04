import { t } from '@/features/localization/translate';
import { useLocale } from '@/features/localization/localeState';
import { createContext, type ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useFonts } from 'expo-font';
import { colors } from '@/constants/theme';

export const AppFontsReady = createContext(false);

// 언어 전환 시 화면이 깜박이지 않도록 한·영·일 글꼴을 함께 준비한다.
export default function AppFontProvider({ children }: { children: ReactNode }) {
  useLocale();
  // 공식 Regular·Bold 파일을 포함하며 Semibold 역할은 제공되는 Bold에 연결한다.
  return (
    <FontView
      state={useFonts({
        TripPrintRegular: require('../../assets/fonts/line-seed/line-seed-ko-regular.ttf'),
        TripPrintSemibold: require('../../assets/fonts/line-seed/line-seed-ko-bold.ttf'),
        TripPrintBold: require('../../assets/fonts/line-seed/line-seed-ko-bold.ttf'),
        TripPrintRegularEN: require('../../assets/fonts/line-seed/line-seed-en-regular.ttf'),
        TripPrintSemiboldEN: require('../../assets/fonts/line-seed/line-seed-en-bold.ttf'),
        TripPrintBoldEN: require('../../assets/fonts/line-seed/line-seed-en-bold.ttf'),
        TripPrintRegularJP: require('../../assets/fonts/line-seed/line-seed-ja-regular.ttf'),
        TripPrintSemiboldJP: require('../../assets/fonts/line-seed/line-seed-ja-bold.ttf'),
        TripPrintBoldJP: require('../../assets/fonts/line-seed/line-seed-ja-bold.ttf'),
        TripPrintLogo: require('../../assets/brand/tripprint-v1/fonts/Poppins-Bold.ttf'),
        GoogleSignInMedium: require('../../assets/fonts/google-sign-in/google-sans-medium.ttf'),
        GoogleSignInKorean: require('../../assets/fonts/google-sign-in/noto-sans-kr-medium.ttf'),
        GoogleSignInJapanese: require('../../assets/fonts/google-sign-in/noto-sans-jp-medium.ttf'),
      })}
    >
      {children}
    </FontView>
  );
}

// 글꼴 조회 실패 시에도 시스템 글꼴로 앱을 사용할 수 있게 한다.
function FontView({
  state: [ready, error],
  children,
}: {
  state: ReturnType<typeof useFonts>;
  children: ReactNode;
}) {
  useLocale();
  // 처음 읽는 화면에서 글꼴이 뒤늦게 바뀌는 현상을 줄인다.
  return ready || error ? (
    <AppFontsReady.Provider value={ready}>{children}</AppFontsReady.Provider>
  ) : (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        justifyContent: 'center',
      }}
    >
      <ActivityIndicator
        color={colors.primary}
        accessibilityLabel={t('화면을 준비하는 중')}
      />
    </View>
  );
}
