import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { discoveryDestinations } from '@wherego/domain';
import ActionSheet from '@/components/ActionSheet';
import DesignInput from '@/components/DesignInput';
import DesignButton from '@/components/DesignButton';
import Text from '@/components/AppText';
import { t } from '@/features/localization/translate';
import { useLocale } from '@/features/localization/localeState';

// 검색은 여행 생성과 분리하고 실제 가이드가 있는 도시로만 연결한다.
export default function HomeDestinationSearch({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  useLocale();
  const [search, setSearch] = useState('');
  const router = useRouter();
  const query = search.trim().normalize('NFKC').toLocaleLowerCase();
  const cities = discoveryDestinations.filter((city) =>
    `${city.key} ${city.city} ${city.country} ${t(city.city)} ${t(city.country)}`
      .normalize('NFKC')
      .toLocaleLowerCase()
      .includes(query),
  );
  return (
    <ActionSheet visible={visible} title={t('여행지 검색')} onClose={onClose}>
      <DesignInput
        accessibilityLabel={t('여행지 검색어')}
        placeholder={t('나라 또는 도시를 입력하세요')}
        value={search}
        onChangeText={setSearch}
      />
      <Text>{t('가이드가 있는 여행지를 찾아보세요.')}</Text>
      <View style={{ gap: 8 }}>
        {cities.map((city) => (
          <DesignButton
            key={city.key}
            label={`${t(city.country)} · ${t(city.city)}`}
            variant="secondary"
            onPress={() => {
              onClose();
              router.push({
                pathname: '/destinations/[key]',
                params: { key: city.key },
              });
            }}
          />
        ))}
      </View>
      {!cities.length && (
        <Text accessibilityRole="alert">
          {t('일치하는 여행지가 없어요. 다른 이름으로 검색해 주세요.')}
        </Text>
      )}
    </ActionSheet>
  );
}
