import { onGnbScroll } from '@/components/navigation/navigationScroll';
import Text from '@/components/ui/AppText';
import ScreenHeader from '@/components/navigation/ScreenHeader';
import { colors } from '@/constants/theme';
import { t } from '@/features/localization/translate';
import { Action } from '@/features/workspace/shared/ui/ui';
import { RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MemberProfileCard from './MemberProfileCard';
import {
  MyAccountArchiveMenu,
  MyAccountGuestNotice,
  MyAccountSettingsMenu,
} from './MyAccountMenus';
import { renderAccountStatistics } from './MyAccountStatistics';
import { styles } from '../styles/myAccountStyles';
import type { MyAccountViewProps } from '../model/myAccountTypes';

// MY에서는 계정 표시·내 기록·설정만 제공하고 개인정보 입력은 요구하지 않는다.
export function renderAccountContent({
  largeText,
  currentUser,
  userId,
  router,
  serverTrips,
}: MyAccountViewProps) {
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}>
      <ScreenHeader
        title="MY"
        actions={[
          { label: t('설정'), onPress: () => router.push('/settings') },
        ]}
      />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        onScroll={onGnbScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={
              Boolean(userId) &&
              !serverTrips.isPending &&
              serverTrips.isRefetching
            }
            onRefresh={() => {
              if (userId) void serverTrips.refetch();
            }}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        <MemberProfileCard
          largeText={largeText}
          currentUser={currentUser}
          userId={userId}
        />
        <MyAccountGuestNotice currentUser={currentUser} router={router} />
        {renderAccountStatistics({ userId, serverTrips, router })}
        {userId && serverTrips.isError && (
          <View style={styles.card}>
            <Text accessibilityRole="alert" style={styles.settingDesc}>
              {t('여행 통계를 불러오지 못했어요. 다시 시도해 주세요.')}
            </Text>
            <Action
              label={t('여행 통계 다시 불러오기')}
              onPress={() => {
                void serverTrips.refetch();
              }}
            />
          </View>
        )}
        {userId && serverTrips.isPending && (
          <Text style={styles.settingDesc}>
            {t('나의 여행을 불러오고 있어요.')}
          </Text>
        )}
        <MyAccountArchiveMenu router={router} />
        <MyAccountSettingsMenu router={router} />
      </ScrollView>
    </SafeAreaView>
  );
}
export { renderAccountProfile } from './AccountProfileCard';
export { styles } from '../styles/myAccountStyles';
