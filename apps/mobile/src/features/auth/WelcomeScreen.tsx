import { Image, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Text from '@/components/AppText';
import { t } from '@/features/localization/translate';
import { useLocale } from '@/features/localization/localeState';
import { useAuthReady } from './AuthBridge';
import GoogleLogin from './GoogleLogin';
import LoginButton from './LoginButton';
import useLoginController from './useLoginController';
import { welcomeStyles as styles } from './welcomeStyles';

// 첫 시작과 목적이 있는 인증 화면을 나눠 저장·초대의 복귀 정보를 보존한다.
export default function WelcomeScreen() {
  useLocale();
  const router = useRouter();
  const controller = useLoginController();
  const ready = useAuthReady((state) => state.ready);
  const member = Boolean(
    controller.currentUser && controller.currentUser.authProvider !== 'guest',
  );
  const locked = !ready || controller.busy;
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.brand} testID="welcome-brand">
          <Image
            source={require('../../../assets/brand/tripprint-v1/tripprint-app-icon-source.png')}
            style={styles.symbol}
            resizeMode="contain"
            accessible={false}
          />
          <Text style={styles.caption}>{t('나만의 여행 기록')}</Text>
          <Image
            source={require('../../../assets/brand/tripprint-v1/tripprint-wordmark-en.png')}
            style={styles.wordmark}
            resizeMode="contain"
            accessibilityLabel="TripPrint"
          />
          <View>
            <Text style={styles.description}>
              {t('여행의 순간을 간직하고')}
            </Text>
            <Text style={styles.description}>
              {t('나만의 발자취를 남겨보세요')}
            </Text>
          </View>
        </View>
        <View style={styles.actions}>
          <GoogleLogin
            presentation="welcome"
            busy={controller.operation === 'google'}
            disabled={locked || member}
            onPress={controller.startGoogle}
          />
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
          <Text style={styles.note}>
            {t('계획을 저장할 때 로그인할 수 있어요.')}
          </Text>
          {controller.error ? (
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
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
