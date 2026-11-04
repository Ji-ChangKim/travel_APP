import { Platform, BackHandler, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import CenteredNoticeModal from '@/components/ui/CenteredNoticeModal';
import DesignButton from '@/components/ui/DesignButton';
import Text from '@/components/ui/AppText';
import { colors, radii, typography } from '@/constants/theme';
import { useLocale } from '@/features/localization/localeState';
import { t } from '@/features/localization/translate';
import type { UpdateDecision } from '../model/updatePolicy';
import { logPlayStoreClick } from '../manager/playStoreAction';

type Props = {
  visible: boolean;
  decision: UpdateDecision;
  currentVersion?: string;
  busy?: boolean;
  onRetry: () => void;
  onContinue?: () => void;
};

// 설치 가능 여부의 판단은 기존 정책에 맡기고 실제로 가능한 선택만 표시한다.
export default function StartupUpdateNotice({
  visible,
  decision,
  currentVersion,
  busy = false,
  onRetry,
  onContinue,
}: Props) {
  useLocale();
  const blocked = decision.kind === 'blocked';
  const optional = decision.kind === 'optional';
  return (
    <CenteredNoticeModal
      visible={visible}
      priority={120}
      title={t(blocked ? '업데이트 확인 안내' : '앱 업데이트 안내')}
      paragraphs={
        blocked
          ? [
              t('설치할 수 있는 버전을 확인하지 못했어요.'),
              t('잠시 후 다시 확인해 주세요.'),
            ]
          : optional
            ? [
                t('새로운 TripPrint가 준비됐어요.'),
                t('업데이트하거나 현재 버전으로 시작할 수 있어요.'),
              ]
            : [
                t('안정적인 서비스 이용을 위해'),
                t('최신 버전으로 업데이트가 필요해요.'),
              ]
      }
      onClose={optional && !busy ? onContinue : undefined}
    >
      {currentVersion && !blocked && (
        <View style={styles.versions} testID="entry-version-comparison">
          <View style={styles.versionItem}>
            <Text style={styles.version}>{t('현재 버전')}</Text>
            <Text style={styles.version}>{currentVersion}</Text>
          </View>
          <Text style={styles.version} accessible={false}>
            →
          </Text>
          <Text style={styles.latest}>{t('최신 버전')}</Text>
        </View>
      )}
      <DesignButton
        label={t(blocked ? '다시 확인' : 'Google Play 스토어로 이동')}
        variant="primary"
        disabled={busy}
        loading={busy}
        onPress={blocked ? onRetry : logPlayStoreClick}
        icon={
          blocked
            ? undefined
            : (color) => (
                <Ionicons
                  name="logo-google-playstore"
                  color={color}
                  size={20}
                />
              )
        }
      />
      {optional && onContinue && (
        <DesignButton
          label={t('현재 버전으로 시작')}
          onPress={onContinue}
          disabled={busy}
        />
      )}
      {!optional && Platform.OS === 'android' && (
        <DesignButton label={t('앱 닫기')} onPress={BackHandler.exitApp} />
      )}
    </CenteredNoticeModal>
  );
}

const styles = StyleSheet.create({
  versions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.tagBlue,
    borderRadius: radii.badge,
    padding: 12,
  },
  versionItem: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 4,
    maxWidth: '100%',
    flexShrink: 1,
  },
  version: {
    fontSize: typography.bodySmall.size,
    lineHeight: typography.bodySmall.lineHeight,
    color: colors.textSecondary,
    maxWidth: '100%',
    flexShrink: 1,
    textAlign: 'center',
  },
  latest: {
    fontSize: typography.bodySmall.size,
    lineHeight: typography.bodySmall.lineHeight,
    fontWeight: '700',
    color: colors.secondary,
    maxWidth: '100%',
    flexShrink: 1,
    textAlign: 'center',
  },
});
