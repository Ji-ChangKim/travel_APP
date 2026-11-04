import { t } from '@/features/localization/translate';
import { useLocale } from '@/features/localization/localeState';
import ActionSheet from '@/components/ui/ActionSheet';
import Text from '@/components/ui/AppText';
import { colors } from '@/constants/theme';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles } from '../../hub/styles/workspaceStyles';
import { useTripStore } from '@/stores/useTripStore';
import { ledgerColors as c } from '../../my-trips/styles/ledgerTheme';

// 시스템 카메라나 앨범을 즉시 호출하는 네이티브 바텀 액션시트를 제공한다.
export default function ReceiptCapture({
  visible,
  busy,
  onCapture,
  onLibrary,
  onManual,
  onClose,
}: {
  visible: boolean;
  busy: boolean;
  onCapture: () => void;
  onLibrary: () => void;
  onManual?: () => void;
  onClose: () => void;
}) {
  useLocale();
  // 게스트 사진은 전송하지 않고 기기에 보관한 뒤 직접 확인한다.
  const local = useTripStore((state) => {
    // 현재 선택한 계정의 저장 범위만 읽는다.
    return state.currentUser?.authProvider === 'guest';
  });
  return (
    <ActionSheet
      visible={visible}
      title={t('영수증 등록')}
      dismissDisabled={busy}
      onClose={onClose}
    >
      <Text style={styles.subtitle}>
        {local
          ? t(
              '사진을 이 기기에 보관하고 장소, 결제 일시와 금액을 직접 입력해요.',
            )
          : t('장소, 결제 일시, 메뉴와 금액을 사진에서 찾아드릴게요.')}
      </Text>
      <View style={s.list}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('카메라로 영수증 촬영')}
          disabled={busy}
          onPress={onCapture}
          style={({ pressed }) => [
            s.optionCard,
            s.primaryCard,
            pressed && s.pressed,
            busy && s.disabled,
          ]}
        >
          <View style={[s.iconBox, s.primaryIconBox]}>
            <Ionicons name="camera" size={24} color={colors.surface} />
          </View>
          <View style={s.optionText}>
            <Text style={s.primaryTitle}>{t('카메라로 영수증 촬영')}</Text>
            <Text style={s.primarySubtitle}>
              {t('영수증 전체가 보이게 촬영해 주세요')}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.surface} />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('앨범에서 영수증 선택')}
          disabled={busy}
          onPress={onLibrary}
          style={({ pressed }) => [
            s.optionCard,
            pressed && s.pressed,
            busy && s.disabled,
          ]}
        >
          <View style={s.iconBox}>
            <Ionicons name="images-outline" size={22} color={colors.primary} />
          </View>
          <View style={s.optionText}>
            <Text style={s.optionTitle}>{t('앨범에서 영수증 선택')}</Text>
            <Text style={s.optionSubtitle}>
              {t('상호와 날짜, 메뉴, 합계가 잘리지 않게 담아주세요.')}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Pressable>

        {onManual ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('사진 없이 지출 직접 입력')}
            disabled={busy}
            onPress={onManual}
            style={({ pressed }) => [
              s.optionCard,
              pressed && s.pressed,
              busy && s.disabled,
            ]}
          >
            <View style={s.iconBox}>
              <Ionicons name="create-outline" size={22} color={colors.text} />
            </View>
            <View style={s.optionText}>
              <Text style={s.optionTitle}>{t('사진 없이 지출 직접 입력')}</Text>
              <Text style={s.optionSubtitle}>
                {t('영수증 한 장으로 지출 기록')}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>
      <Text style={s.notice}>
        {local
          ? t(
              '사진은 서버로 전송하지 않아요. 확인 후 원본을 보관할지 선택하세요. 등록 전에는 일정과 지출이 추가되지 않아요.',
            )
          : t(
              '정보를 읽기 위해 사진을 전송해요. 확인 후 원본 사진을 보관할지 직접 선택할 수 있어요. 등록 전에는 일정과 지출이 추가되지 않아요.',
            )}
      </Text>
    </ActionSheet>
  );
}

const s = StyleSheet.create({
  list: {
    gap: 10,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
    minHeight: 68,
  },
  primaryCard: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pressed: {
    opacity: 0.88,
  },
  disabled: {
    opacity: 0.5,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: c.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryIconBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
  },
  optionText: {
    flex: 1,
    gap: 2,
  },
  optionTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
    color: colors.text,
  },
  optionSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.muted,
  },
  primaryTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
    color: colors.surface,
  },
  primarySubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.surface,
  },
  notice: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.muted,
  },
});
