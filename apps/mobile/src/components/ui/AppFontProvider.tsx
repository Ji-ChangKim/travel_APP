import { useLocale } from '@/features/localization/localeState';
import { createContext, type ReactNode } from 'react';
import { useFonts } from 'expo-font';

export const AppFontsReady = createContext(false);

// 언어 전환 시 화면이 깜박이지 않도록 한·영·일 글꼴을 함께 준비한다.
export default function AppFontProvider({ children }: { children: ReactNode }) {
  useLocale();
  // 공식 Regular·Bold 파일을 포함하며 Semibold 역할은 제공되는 Bold에 연결한다.
  return (
    <FontView
      state={useFonts({
        TripPrintRegular: require('../../../assets/fonts/line-seed/line-seed-ko-regular.ttf'),
        TripPrintSemibold: require('../../../assets/fonts/line-seed/line-seed-ko-bold.ttf'),
        TripPrintBold: require('../../../assets/fonts/line-seed/line-seed-ko-bold.ttf'),
        TripPrintRegularEN: require('../../../assets/fonts/line-seed/line-seed-en-regular.ttf'),
        TripPrintSemiboldEN: require('../../../assets/fonts/line-seed/line-seed-en-bold.ttf'),
        TripPrintBoldEN: require('../../../assets/fonts/line-seed/line-seed-en-bold.ttf'),
        TripPrintRegularJP: require('../../../assets/fonts/line-seed/line-seed-ja-regular.ttf'),
        TripPrintSemiboldJP: require('../../../assets/fonts/line-seed/line-seed-ja-bold.ttf'),
        TripPrintBoldJP: require('../../../assets/fonts/line-seed/line-seed-ja-bold.ttf'),
        TripPrintLogo: require('../../../assets/brand/tripprint-v1/fonts/Poppins-Bold.ttf'),
        GoogleSignInMedium: require('../../../assets/fonts/google-sign-in/google-sans-medium.ttf'),
        GoogleSignInKorean: require('../../../assets/fonts/google-sign-in/noto-sans-kr-medium.ttf'),
        GoogleSignInJapanese: require('../../../assets/fonts/google-sign-in/noto-sans-jp-medium.ttf'),
      })}
    >
      {children}
    </FontView>
  );
}

// 글꼴 조회 중에도 시스템 글꼴로 첫 화면을 즉시 표시하고 로드 후 교체한다.
function FontView({
  state: [ready, error],
  children,
}: {
  state: ReturnType<typeof useFonts>;
  children: ReactNode;
}) {
  useLocale();
  return (
    <AppFontsReady.Provider value={Boolean(ready && !error)}>
      {children}
    </AppFontsReady.Provider>
  );
}
