import Modal from '@/components/AppModal';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Action, styles } from './ui';

// 시스템 카메라를 열기 전에 촬영 방법과 사진 처리 선택을 안내한다.
export default function ReceiptCapture({
  visible,
  busy,
  onCapture,
  onLibrary,
  onClose,
}: {
  visible: boolean;
  busy: boolean;
  onCapture: () => void;
  onLibrary: () => void;
  onClose: () => void;
}) {
  // 실제 카메라는 기기의 촬영 화면을 사용하며 이 화면에서는 결과를 만들지 않는다.
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.modal}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.label}>사진 촬영 → 정보 확인 → 일정 등록</Text>
          <Text style={styles.header}>영수증 한 장으로 기록해요</Text>
          <Text style={styles.subtitle}>
            장소, 결제 일시, 메뉴와 금액을 사진에서 찾아드릴게요.
          </Text>
          <View
            style={{
              borderWidth: 2,
              borderStyle: 'dashed',
              borderColor: '#FF6B57',
              borderRadius: 24,
              padding: 28,
              minHeight: 240,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 14,
              backgroundColor: '#FFF9F4',
            }}
          >
            <Ionicons name="receipt-outline" size={84} color="#FF6B57" />
            <Text style={styles.title}>영수증 전체가 보이게 촬영해 주세요</Text>
            <Text style={styles.subtitle}>
              상호와 날짜, 메뉴, 합계가 잘리지 않게 담아주세요.
            </Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.title}>글자가 선명하면 더 잘 읽어요</Text>
            <Text>평평한 곳에 펼치고 밝은 곳에서 촬영해 주세요.</Text>
            <Text>카드번호와 개인정보는 가려도 괜찮아요.</Text>
          </View>
          <Text style={styles.subtitle}>
            정보를 읽기 위해 사진을 전송해요. 확인 후 원본 사진을 보관할지 직접
            선택할 수 있어요. 등록 전에는 일정과 지출이 추가되지 않아요.
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
          <Action
            label="나중에 할게요"
            variant="quiet"
            disabled={busy}
            onPress={onClose}
          />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
