import Text from '@/components/ui/AppText';
import { colors } from '@/constants/theme';
import { t } from '@/features/localization/translate';
import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';
import { styles } from '../styles/myAccountStyles';
import type { AccountRetirementController } from '../manager/useAccountRetirement';

// 외부 공급자는 서버가 확인한 종류만 표시하고 이메일은 본인 화면에만 둔다.
export default function AccountConnectionCard({
  user,
  management,
}: Pick<AccountRetirementController, 'user' | 'management'>) {
  if (!user) return null;
  const guest = user.authProvider === 'guest';
  const google = management?.account.accountType === 'google_member';
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t('현재 이용 방식')}</Text>
      <View style={styles.card}>
        <View style={styles.profileCardHeader}>
          <Ionicons
            name={
              guest
                ? 'phone-portrait-outline'
                : google
                  ? 'logo-google'
                  : 'person-outline'
            }
            size={24}
            color={colors.primary}
            accessible={false}
          />
          <View style={styles.profileInfo}>
            <Text style={styles.userName}>
              {user.nickname.trim() || t('여행자')}
            </Text>
            <Text style={styles.settingDesc}>
              {t(guest ? '게스트 계정' : google ? 'Google 계정' : '회원 계정')}
            </Text>
          </View>
        </View>
        {google && management.account.email ? (
          <Text style={styles.settingDesc}>{management.account.email}</Text>
        ) : null}
        <Text style={styles.settingDesc}>
          {t(
            guest
              ? '게스트 여행은 현재 이 기기에 보관돼요.'
              : '계정 정보는 본인에게만 표시돼요.',
          )}
        </Text>
      </View>
    </View>
  );
}
