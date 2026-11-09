import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ScreenHeader from '@/components/navigation/ScreenHeader';
import TripPrintLoading from '@/components/feedback/TripPrintLoading';
import DesignButton from '@/components/ui/DesignButton';
import Text from '@/components/ui/AppText';
import { useLocale } from '@/features/localization/localeState';
import { t } from '@/features/localization/translate';
import { useDefaultProfileEntry } from '../manager/useDefaultProfileEntry';
import { profileSetupStyles as s } from '../styles/profileSetupStyles';

// 이전 주소로 들어와도 개인정보 입력을 다시 요구하지 않는다.
export default function ProfileSetupScreen() {
  useLocale();
  const { error, retry, back } = useDefaultProfileEntry();
  return (
    <SafeAreaView style={s.screen}>
      <ScreenHeader title={t('계정 확인')} onBack={back} />
      {error ? (
        <View style={s.content}>
          <Text accessibilityRole="alert" style={s.error}>
            {t('계정을 확인하지 못했어요. 다시 시도해 주세요.')}
          </Text>
          <DesignButton
            label={t('다시 시도')}
            onPress={retry}
            variant="primary"
          />
          <DesignButton label={t('로그인 화면으로')} onPress={back} />
        </View>
      ) : (
        <TripPrintLoading message={t('계정을 확인하고 있어요')} />
      )}
    </SafeAreaView>
  );
}
