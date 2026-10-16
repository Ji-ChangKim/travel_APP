import Text from '@/components/AppText';
import { View } from 'react-native';
import { Action, styles } from './ui';
import type { PlanForm } from './forms';
import { receiptDifference, receiptCurrencyIssue } from './receiptFlow';

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
  // 수정한 합계와 품목을 기준으로 차이 확인 여부를 판단한다.
  const difference = receiptDifference(form);
  // 통화를 읽은 성공과 확정할 수 없는 상태를 구분한다.
  const currencyIssue = receiptCurrencyIssue(form.values.currency || '');
  // 두 질문은 미선택 상태로 시작하고 동의를 유도하는 기본값을 두지 않는다.
  return (
    <View style={{ gap: 16 }}>
      {currencyIssue && (
        <Text accessibilityRole="alert" style={styles.error}>
          {currencyIssue}
        </Text>
      )}
      {difference && (
        <View style={styles.card}>
          <Text style={styles.title}>품목 합계와 결제 총액이 달라요</Text>
          <Text>
            품목 합계 · {difference.itemTotal} {form.values.currency}
          </Text>
          <Text>
            결제 총액 · {form.values.amount} {form.values.currency}
          </Text>
          <Text>
            차이 (총액 − 품목 합계) · {difference.difference}{' '}
            {form.values.currency}
          </Text>
          <Text>
            세금이나 할인 때문일 수 있어요. 원본을 확인해 주세요. 지출에는 결제
            총액만 기록돼요.
          </Text>
          <Action
            label="차이를 확인했어요. 결제 총액으로 기록할게요"
            selected={form.values.totalDifferenceAccepted === 'true'}
            disabled={busy || Boolean(currencyIssue)}
            onPress={() => {
              // 현재 합계의 차이에만 동의하며 정보 확인은 별도로 받는다.
              return onChange('totalDifferenceAccepted', 'true');
            }}
          />
        </View>
      )}
      <View style={styles.card}>
        <Text style={styles.label}>1 · 정보 확인</Text>
        <Text style={styles.title}>영수증 정보가 맞나요?</Text>
        <Text style={styles.subtitle}>
          {form.values.receiptOperation === 'update'
            ? '장소, 결제 일시, 메뉴와 금액을 확인해 주세요. 기존 영수증과 실제 지출에 수정한 내용을 반영해요.'
            : '장소, 결제 일시, 메뉴와 금액을 확인해 주세요. 맞다면 선택한 날짜의 일정에 추가할 수 있어요.'}
        </Text>
        <Action
          label={
            form.values.receiptOperation === 'update'
              ? '맞아요, 수정한 내용을 저장할게요'
              : '맞아요, 일정에 추가할게요'
          }
          selected={form.values.receiptConfirmed === 'true'}
          disabled={
            busy ||
            Boolean(currencyIssue) ||
            Boolean(
              difference && form.values.totalDifferenceAccepted !== 'true',
            )
          }
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
      {form.values.receiptOperation === 'update' && (
        <Text style={styles.subtitle}>
          처음 선택한 영수증 사진 보관 여부는 유지돼요. 수정한 내용은 기존
          지출에 반영돼요.
        </Text>
      )}
      {form.values.receiptConfirmed === 'true' &&
        form.values.receiptOperation !== 'update' && (
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
