import ScreenHeader from '@/components/ScreenHeader';
import Text from '@/components/AppText';
import { colors } from '@/constants/theme';
import Modal from '@/components/AppModal';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { styles } from './workspaceStyles';

import { useTripStore } from '@/stores/useTripStore';
import { ledgerStyles as l, ledgerColors as c } from './ledgerTheme';
import { LedgerAction as Action, useLedgerWide } from './LedgerUI';

// 시스템 카메라를 열기 전에 촬영 방법과 사진 처리 선택을 안내한다.
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
  // 게스트 사진은 전송하지 않고 기기에 보관한 뒤 직접 확인한다.
  const local = useTripStore((state) => {
    // 현재 선택한 계정의 저장 범위만 읽는다.
    return state.currentUser?.authProvider === 'guest';
  });
  const wide = useLedgerWide();
  function closeCapture(): void {
    // 사진 선택을 처리하는 중에는 모든 닫기 경로를 같은 규칙으로 잠근다.
    return busy ? undefined : onClose();
  }
  // 실제 카메라는 기기의 촬영 화면을 사용하며 이 화면에서는 결과를 만들지 않는다.
  return (
    <Modal
      accessibilityLabel="영수증 사진 선택"
      visible={visible}
      animationType="slide"
      onRequestClose={closeCapture}
    >
      <SafeAreaView style={[styles.modal, { backgroundColor: c.canvas }]}>
        <ScreenHeader
          title="영수증 촬영"
          inlineTitle
          onBack={closeCapture}
          backLabel="영수증 사진 선택 닫기"
          disabled={busy}
        />
        <ScrollView contentContainerStyle={[l.content, wide && l.wideContent]}>
          <Text style={styles.label}>사진 촬영 → 정보 확인 → 일정 등록</Text>
          <Text style={l.title}>영수증 한 장으로 지출 기록</Text>
          <Text style={styles.subtitle}>
            {local
              ? '사진을 이 기기에 보관하고 장소, 결제 일시와 금액을 직접 입력해요.'
              : '장소, 결제 일시, 메뉴와 금액을 사진에서 찾아드릴게요.'}
          </Text>
          <View
            style={{
              borderWidth: 2,
              borderStyle: 'dashed',
              borderColor: c.accent,
              borderRadius: 24,
              padding: 28,
              minHeight: 240,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 14,
              backgroundColor: c.soft,
            }}
          >
            <Ionicons name="receipt-outline" size={84} color={colors.primary} />
            <Text style={styles.title}>영수증 전체가 보이게 촬영해 주세요</Text>
            <Text style={styles.subtitle}>
              상호와 날짜, 메뉴, 합계가 잘리지 않게 담아주세요.
            </Text>
          </View>
          <View style={l.card}>
            <Text style={styles.title}>
              {local
                ? '나중에도 내용을 확인할 수 있게 촬영해요'
                : '글자가 선명하면 더 잘 읽어요'}
            </Text>
            <Text>평평한 곳에 펼치고 밝은 곳에서 촬영해 주세요.</Text>
            <Text>카드번호와 개인정보는 가려도 괜찮아요.</Text>
          </View>
          <Text style={styles.subtitle}>
            {local
              ? '사진은 서버로 전송하지 않아요. 확인 후 원본을 보관할지 선택하세요. 등록 전에는 일정과 지출이 추가되지 않아요.'
              : '정보를 읽기 위해 사진을 전송해요. 확인 후 원본 사진을 보관할지 직접 선택할 수 있어요. 등록 전에는 일정과 지출이 추가되지 않아요.'}
          </Text>
          <Action
            label="카메라로 영수증 촬영"
            variant="primary"
            disabled={busy}
            onPress={onCapture}
          />
          <Action
            label="앨범에서 영수증 선택"
            disabled={busy}
            onPress={onLibrary}
          />
          {onManual && (
            <Action
              label="사진 없이 지출 직접 입력"
              disabled={busy}
              onPress={onManual}
            />
          )}
          <Action
            label="나중에 할게요"
            variant="quiet"
            disabled={busy}
            onPress={closeCapture}
          />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
