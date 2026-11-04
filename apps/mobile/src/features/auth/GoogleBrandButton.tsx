import { useContext, useState } from 'react';
import {
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { AppFontsReady } from '@/components/AppFontProvider';
import { useAppAccessibility } from '@/features/accessibility/appAccessibility';
import { useLocale } from '@/features/localization/localeState';
import { t } from '@/features/localization/translate';

type Props = { disabled: boolean; busy: boolean; onPress: () => void };

// Google 버튼의 공급자 규격을 일반 앱 버튼의 색·글꼴과 분리한다.
export default function GoogleBrandButton({ disabled, busy, onPress }: Props) {
  const language = useLocale();
  const [focused, setFocused] = useState(false);
  const fontsReady = useContext(AppFontsReady);
  const { fontScale } = useAppAccessibility();
  const scale = Platform.OS === 'web' ? fontScale : 1;
  const primaryFont = fontsReady ? 'GoogleSignInMedium' : undefined;
  const localFont = fontsReady
    ? language === 'ja'
      ? 'GoogleSignInJapanese'
      : 'GoogleSignInKorean'
    : undefined;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('Google 계정으로 계속')}
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[
        styles.button,
        Platform.OS === 'ios' && styles.ios,
        focused && styles.focused,
      ]}
    >
      {({ pressed }) => (
        <>
          <Image
            source={require('../../../assets/brand/tripprint-v1/Google_G.png')}
            style={styles.icon}
            resizeMode="contain"
            accessible={false}
          />
          <Text
            style={[
              styles.label,
              {
                fontFamily: primaryFont,
                fontSize: 14 * scale,
                lineHeight: 20 * scale,
              },
            ]}
          >
            {language === 'en' ? (
              'Continue with Google'
            ) : (
              <>
                <Text>Google</Text>
                <Text style={{ fontFamily: localFont }}>
                  {language === 'ja' ? ' で続行' : ' 계정으로 계속'}
                </Text>
              </>
            )}
          </Text>
          {pressed && <View pointerEvents="none" style={styles.pressed} />}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    padding: 12,
    gap: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#747775',
    backgroundColor: '#FFFFFF',
  },
  ios: { paddingHorizontal: 16, gap: 12 },
  focused: {
    outlineStyle: 'solid',
    outlineWidth: 2,
    outlineColor: '#1F1F1F',
    outlineOffset: 3,
  },
  icon: { width: 20, height: 20, backgroundColor: '#FFFFFF', flexShrink: 0 },
  label: { color: '#1F1F1F', fontWeight: '500', flex: 1, textAlign: 'center' },
  pressed: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    borderRadius: 4,
    backgroundColor: '#303030',
    opacity: 0.12,
  },
});
