import { onGnbScroll } from '@/components/navigation/navigationScroll';
import ScreenHeader from '@/components/navigation/ScreenHeader';
import { colors } from '@/constants/theme';
import { t } from '@/features/localization/translate';
import { RefreshControl, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MemberProfileCard from './MemberProfileCard';
import { MyAccountGuestNotice, MyAccountSettingsMenu } from './MyAccountMenus';
import { styles } from '../styles/myAccountStyles';
import type { MyAccountViewProps } from '../model/myAccountTypes';

// MY에서는 1.타이틀 / 2.프로필(이미지·닉네임) / 3.계정 연동 / 4.설정 / 5.앱 버전 정보만 간결하게 표시한다.
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
        <MyAccountSettingsMenu router={router} />
      </ScrollView>
    </SafeAreaView>
  );
}
export { renderAccountProfile } from './AccountProfileCard';
export { styles } from '../styles/myAccountStyles';
