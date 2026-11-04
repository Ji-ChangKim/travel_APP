import Text from '@/components/AppText';
import { useAppAccessibility } from '@/features/accessibility/appAccessibility';
import { useLocale } from '@/features/localization/localeState';
import { t } from '@/features/localization/translate';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import HomeDestinationSearch from './HomeDestinationSearch';
import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { homeLandingStyles as s } from './homeLandingStyles';
import { homeColors as colors } from './homeTheme';

interface Props {
  ready: boolean;
  onCreate: () => void;
}

// 홈의 공통 첫 화면은 여행 보유 여부와 관계없이 브랜드와 주요 입구를 보여준다.
export default function HomeLanding({ ready, onCreate }: Props) {
  useLocale();
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);
  const { largeText } = useAppAccessibility();
  const shortcuts = [
    { label: '새 여행 만들기', icon: 'add-circle-outline', action: onCreate },
    {
      label: '내 여행',
      icon: 'bag-handle-outline',
      action: () => router.push('/(tabs)/plans'),
    },
    {
      label: '여행지 검색',
      icon: 'search-outline',
      action: () => setSearchOpen(true),
    },
    {
      label: '초대 참여',
      icon: 'people-outline',
      action: () => router.push('/invite'),
    },
  ] as const;
  return (
    <View style={s.section}>
      <View testID="home-quick-menu" style={s.quickMenu}>
        {shortcuts.map((shortcut) => (
          <Pressable
            key={shortcut.label}
            accessibilityRole="button"
            accessibilityLabel={t(shortcut.label)}
            accessibilityState={{ disabled: !ready }}
            disabled={!ready}
            onPress={shortcut.action}
            style={({ pressed }) => [
              s.shortcut,
              largeText && s.wideShortcut,
              pressed && s.pressed,
              !ready && s.disabled,
            ]}
          >
            <View style={s.shortcutIcon}>
              <Ionicons name={shortcut.icon} size={24} color={colors.primary} />
            </View>
            <Text style={s.shortcutLabel}>{t(shortcut.label)}</Text>
          </Pressable>
        ))}
      </View>
      <HomeDestinationSearch
        visible={searchOpen}
        onClose={() => setSearchOpen(false)}
      />
    </View>
  );
}
