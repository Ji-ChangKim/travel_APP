import { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import Constants from 'expo-constants';
import StartupUpdateNotice from '@/features/startup/ui/StartupUpdateNotice';
import BiBackground from '@/features/startup/ui/BiBackground';
import Text from '@/components/ui/AppText';

// 로컬 검수 빌드에만 임시 연결하는 UI 시험 자료다. 실제 정책·로그인 성공을 대체하지 않는다.
export default function EntryNoticePreview() {
  const { kind } = useLocalSearchParams<{ kind?: string }>();
  const [visible, setVisible] = useState(true);
  const [retries, setRetries] = useState(0);
  const mode = kind === 'optional' || kind === 'blocked' ? kind : 'required';
  return (
    <View style={{ flex: 1 }}>
      <BiBackground />
      <Text testID="notice-preview-result" style={{ opacity: 0 }}>
        {visible ? `retries:${retries}` : 'continued'}
      </Text>
      <StartupUpdateNotice
        visible={visible}
        decision={{ kind: mode, action: mode === 'blocked' ? 'none' : 'store' }}
        currentVersion={Constants.expoConfig?.version}
        onRetry={() => setRetries((value) => value + 1)}
        onContinue={() => setVisible(false)}
      />
    </View>
  );
}
