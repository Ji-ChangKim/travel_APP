import Text from '@/components/ui/AppText';
import { colors } from '@/constants/theme';
import { t } from '@/features/localization/translate';
import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';
import { styles as accountStyles } from '../styles/myAccountStyles';
import type { AccountRetirementController } from '../manager/useAccountRetirement';
// 현재 연결된 계정과 계정 종류별 안내를 표시한다.
export default function AccountConnectionCard({
  user,
}: Pick<AccountRetirementController, 'user'>) {
  return user ? (
    <View style={accountStyles.section}>
      <Text style={accountStyles.sectionTitle}>{t('연결된 계정')}</Text>
      <View style={accountStyles.listCard}>
        <View style={accountStyles.listRow}>
          <View style={accountStyles.listIconBox}>
            <Ionicons
              name={
                user.authProvider === 'guest'
                  ? 'phone-portrait-outline'
                  : 'logo-google'
              }
              size={20}
              color={colors.primary}
            />
          </View>
          <View style={accountStyles.listTextGroup}>
            <Text style={accountStyles.listTitle}>{user.nickname}</Text>
            <Text style={accountStyles.listSubtitle}>
              {user.authProvider === 'guest'
                ? t(
                    '현재 기기 전용 게스트 계정으로 이용 중이에요. Google 계정의 탈퇴를 진행하려면 해당 계정으로 로그인해 주세요.',
                  )
                : t('현재 연결된 Google 계정의 보관 및 탈퇴 정책을 안내해요.')}
            </Text>
          </View>
          <Text style={accountStyles.listValue}>
            {user.authProvider === 'guest'
              ? t('게스트 계정')
              : t('Google 계정')}
          </Text>
        </View>
      </View>
    </View>
  ) : null;
}
