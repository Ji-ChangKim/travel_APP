import { useCallback, useState } from 'react';
import { useFocusEffect, useIsFocused } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { getHomeTips } from '@wherego/api-client';
import { View } from 'react-native';
import Text from '@/components/AppText';
import DesignButton from '@/components/DesignButton';
import { useLocale } from '@/features/localization/localeState';
import { t } from '@/features/localization/translate';
import { apiBaseUrl } from './service';
import { homeTravelStyles as s } from './homeTravelStyles';

// 발행된 서버 팁만 표시하며 빈 결과·통신 실패를 예시 문구로 채우지 않는다.
export default function HaruDailyTip() {
  const language = useLocale();
  const focused = useIsFocused();
  const [visit, setVisit] = useState(0);
  useFocusEffect(
    useCallback(() => {
      setVisit((value) => value + 1);
    }, []),
  );
  const query = useQuery({
    queryKey: ['home-tips', language],
    queryFn: ({ signal }) => getHomeTips(apiBaseUrl(), language, signal),
    enabled: focused,
    retry: false,
    staleTime: 60000,
  });
  if (query.isError)
    return (
      <View style={s.tip}>
        <Text style={s.body}>{t('여행 팁을 불러오지 못했어요.')}</Text>
        <DesignButton
          label={t('다시 시도')}
          variant="quiet"
          onPress={() => void query.refetch()}
        />
      </View>
    );
  if (!query.data?.length) return null;
  const tip = query.data[visit % query.data.length]!;
  return (
    <View style={s.tip} testID="haru-daily-tip">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Text style={{ fontSize: 13 }} accessible={false}>
          💡
        </Text>
        <Text style={s.tipTitle}>{t('하루의 여행 팩트 팁')}</Text>
      </View>
      <Text style={s.body}>{tip.text}</Text>
    </View>
  );
}
