import { Animated, Image, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import Text from '@/components/AppText';
import { t } from '@/features/localization/translate';
import { useLocale } from '@/features/localization/localeState';
import { useAuthReady } from './AuthBridge';
import GoogleLogin from './GoogleLogin';
import LoginButton from './LoginButton';
import useLoginController from './useLoginController';
import { useWelcomeMotion } from './useWelcomeMotion';
import { welcomeStyles as styles } from './welcomeStyles';

export default function WelcomeScreen() {
  useLocale();
  const router = useRouter();
  const controller = useLoginController();
  const {
    done,
    onLayout,
    onSourceMount,
    onTargetMount,
    symbolStyle,
    wordmarkStyle,
    googleStyle,
    guestStyle,
    versionStyle,
  } = useWelcomeMotion();
  const ready = useAuthReady((state) => state.ready);
  const member = Boolean(
    controller.currentUser && controller.currentUser.authProvider !== 'guest',
  );
  const locked = !ready || controller.busy || !done;
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.stage} onLayout={onLayout} testID="welcome-stage">
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.brand} testID="welcome-brand">
            <View
              ref={onTargetMount}
              collapsable={false}
              style={{ opacity: done ? 1 : 0 }}
            >
              <Image
                source={require('../../../assets/brand/tripprint-v1/tripprint-app-icon-source.png')}
                style={styles.symbol}
                resizeMode="contain"
                accessible={false}
              />
            </View>
            <Animated.View style={wordmarkStyle}>
              <Image
                source={require('../../../assets/brand/tripprint-v1/tripprint-wordmark-en.png')}
                style={styles.wordmark}
                resizeMode="contain"
                accessibilityLabel="TripPrint"
              />
            </Animated.View>
          </View>
          <View
            style={styles.actions}
            pointerEvents={done ? 'auto' : 'none'}
            aria-hidden={!done}
            accessibilityElementsHidden={!done}
            importantForAccessibility={done ? 'auto' : 'no-hide-descendants'}
          >
            <Animated.View style={googleStyle} testID="welcome-google-entrance">
              <GoogleLogin
                presentation="welcome"
                busy={controller.operation === 'google'}
                disabled={locked || member}
                onPress={controller.startGoogle}
              />
            </Animated.View>
            <Animated.View style={guestStyle} testID="welcome-guest-entrance">
              <LoginButton
                label={member ? t('이어서 시작하기') : t('게스트로 시작하기')}
                variant="primary"
                disabled={locked}
                busy={
                  controller.operation === 'guest' ||
                  controller.operation === 'continue'
                }
                onPress={
                  controller.currentUser
                    ? controller.continueSession
                    : controller.startGuest
                }
              />
            </Animated.View>
            {controller.error && (
              <>
                <Text style={styles.error} accessibilityRole="alert">
                  {t(controller.error)}
                </Text>
                <LoginButton
                  label={t('다른 방법으로 로그인')}
                  disabled={locked}
                  onPress={() => router.push('/login')}
                />
              </>
            )}
          </View>
          <Animated.View style={versionStyle}>
            {Constants.expoConfig?.version && (
              <Text style={styles.version}>
                {t('버전 {version}', { version: Constants.expoConfig.version })}
              </Text>
            )}
          </Animated.View>
        </ScrollView>
        {!done && (
          <View
            style={styles.overlay}
            pointerEvents="none"
            aria-hidden
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <View
              ref={onSourceMount}
              collapsable={false}
              style={styles.introSymbol}
            >
              <Animated.View
                style={[styles.fillSymbol, symbolStyle]}
                testID="welcome-moving-logo"
              >
                <Image
                  source={require('../../../assets/brand/tripprint-v1/tripprint-app-icon-source.png')}
                  style={styles.fillSymbol}
                  resizeMode="contain"
                  accessible={false}
                />
              </Animated.View>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
