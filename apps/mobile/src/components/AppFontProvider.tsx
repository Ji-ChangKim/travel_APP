import { createContext, type ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useFonts } from 'expo-font';
import { colors } from '@/constants/theme';

export const AppFontsReady = createContext(false);

// 로그인부터 기록 화면까지 동일한 한글 글꼴을 준비한다.
export default function AppFontProvider({ children }: { children: ReactNode }) {
  // 기존 앱에 포함된 글꼴만 사용하고 새 패키지를 추가하지 않는다.
  return (
    <FontView
      state={useFonts({
        TripPrintRegular: require('../../assets/fonts/pretendard-regular.otf'),
        TripPrintSemibold: require('../../assets/fonts/pretendard-semibold.otf'),
        TripPrintBold: require('../../assets/fonts/pretendard-bold.otf'),
        TripPrintLogo: require('../../assets/brand/tripprint-v1/fonts/Poppins-Bold.ttf'),
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
        accessibilityLabel="화면을 준비하는 중"
      />
    </View>
  );
}
