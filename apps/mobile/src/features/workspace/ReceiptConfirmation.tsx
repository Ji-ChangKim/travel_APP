import { Text, View } from 'react-native';
import { Action, styles } from './ui';
import type { PlanForm } from './forms';

// 정보 확인과 사진 보관을 서로 다른 사용자 선택으로 받는다.
export default function ReceiptConfirmation({
  form,
  busy,
  onChange,
}: {
  form: PlanForm;
  busy: boolean;
  onChange: (key: string, value: string) => void;
}) {
  // 두 질문은 미선택 상태로 시작하고 동의를 유도하는 기본값을 두지 않는다.
  return (
    <View style={{ gap: 16 }}>
      <View style={styles.card}>
        <Text style={styles.label}>1 · 정보 확인</Text>
        <Text style={styles.title}>영수증 정보가 맞나요?</Text>
        <Text style={styles.subtitle}>
          장소, 결제 일시, 메뉴와 금액을 확인해 주세요. 맞다면 선택한 날짜의
          일정에 추가할 수 있어요.
        </Text>
        <Action
          label="맞아요, 일정에 추가할게요"
          selected={form.values.receiptConfirmed === 'true'}
          disabled={busy}
          onPress={() => {
            // 확인된 후보만 다음 사진 보관 선택으로 진행한다.
            return onChange('receiptConfirmed', 'true');
          }}
        />
        <Action
          label="아니요, 수정할게요"
          disabled={busy}
          onPress={() => {
            // 아니요는 저장하지 않고 틀린 정보의 수정 화면을 연다.
            return onChange('receiptConfirmed', 'false');
          }}
        />
      </View>
      {form.values.receiptConfirmed === 'true' && (
        <View style={styles.card}>
          <Text style={styles.label}>2 · 사진 보관</Text>
          <Text style={styles.title}>영수증 사진도 함께 보관할까요?</Text>
          <Text style={styles.subtitle}>
            사진을 보관하면 나와 여행 친구가 원본을 다시 볼 수 있어요.
            커뮤니티에는 공개되지 않아요.
          </Text>
          <Action
            label="네, 사진도 보관할게요"
            selected={form.values.keepPhoto === 'true'}
            disabled={busy}
            onPress={() => {
              // 원본 보관을 명시적으로 선택한다.
              return onChange('keepPhoto', 'true');
            }}
          />
          <Action
            label="아니요, 정보만 저장할게요"
            selected={form.values.keepPhoto === 'false'}
            disabled={busy}
            onPress={() => {
              // 장소·메뉴·금액만 남기고 인식용 사진을 삭제하도록 선택한다.
              return onChange('keepPhoto', 'false');
            }}
          />
          {form.values.keepPhoto && (
            <Text style={styles.subtitle}>
              {form.values.keepPhoto === 'true'
                ? '장소·메뉴·실제 지출과 영수증 사진을 함께 저장해요.'
                : '장소·메뉴·실제 지출만 저장해요. 등록이 끝나면 인식에 사용한 사진은 삭제해요.'}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}
