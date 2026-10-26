import Text from '@/components/AppText';
import * as Crypto from 'expo-crypto';
import { useCallback, useEffect, useRef, useState } from 'react';
import { TextInput, View } from 'react-native';
import { LedgerAction } from './LedgerUI';
import { focusFormInput, useFormScope } from './InputFeedback';
import type { PlanForm } from './forms';
import { ledgerStyles as l } from './ledgerTheme';
import { changedReceiptItem, receiptItems } from './receiptChecks';
import { Field } from './ui';

// 행 식별자는 화면에서만 사용하며 저장할 메뉴 계약에는 포함하지 않는다.
export default function ReceiptMenuEditor({
  form,
  busy,
  onChange,
}: {
  form: PlanForm;
  busy: boolean;
  onChange: (key: string, value: string) => void;
}) {
  const items = receiptItems(form.values.items);
  const [focusId, setFocusId] = useState('');
  const clearFocus = useCallback(() => setFocusId(''), [setFocusId]);
  const emptyTarget = useRef<View>(null);
  const scope = useFormScope();
  const locked = busy || scope.locked;
  useEffect(() => {
    if (focusId !== 'empty' || locked) return;
    const frame = requestAnimationFrame(() => {
      emptyTarget.current?.focus();
      setFocusId('');
    });
    return () => cancelAnimationFrame(frame);
  }, [focusId, locked, form.values.items]);

  return (
    <View style={l.card}>
      <Text style={l.section}>메뉴·구매 내역</Text>
      {items.length === 0 && (
        <Text>
          메뉴 없이 저장할 수 있어요. 필요한 메뉴는 직접 추가해 주세요.
        </Text>
      )}
      {items.map((item, index) => {
        const id = item.rowId || String(index);

        return (
          <View key={id} style={{ gap: 12 }}>
            <MenuFields
              item={item}
              index={index}
              form={form}
              locked={locked}
              shouldFocus={focusId === id}
              onFocused={clearFocus}
              onChange={onChange}
            />
            <LedgerAction
              label={`${index + 1}번 메뉴 삭제`}
              disabled={locked}
              onPress={() => {
                // 삭제한 행 외의 키와 값을 보존하고 인접 입력으로 이동한다.
                const next = items.filter((_, position) => position !== index);
                onChange('items', JSON.stringify(next));
                setFocusId(
                  next[Math.min(index, next.length - 1)]?.rowId || 'empty',
                );
              }}
            />
          </View>
        );
      })}
      <View ref={emptyTarget} focusable accessibilityLabel="메뉴 추가">
        <LedgerAction
          label="메뉴 추가"
          disabled={locked || items.length >= 50}
          onPress={() => {
            const rowId = Crypto.randomUUID();
            onChange(
              'items',
              JSON.stringify([
                ...items,
                { rowId, name: '', quantity: null, unitPrice: '', amount: '' },
              ]),
            );
            setFocusId(rowId);
          }}
        />
      </View>
      {items.length >= 50 && (
        <Text style={l.meta}>메뉴는 최대 50개까지 추가할 수 있어요.</Text>
      )}
      <Text style={l.meta}>
        수량·단가·금액을 모르면 비워 두세요. 결제 총액은 별도로 기록해요.
      </Text>
    </View>
  );
}

// 각 행은 고유 키에 연결된 입력 참조를 소유해 중간 삭제에도 초점을 보존한다.
function MenuFields({
  item,
  index,
  form,
  locked,
  shouldFocus,
  onFocused,
  onChange,
}: {
  item: ReturnType<typeof receiptItems>[number];
  index: number;
  form: PlanForm;
  locked: boolean;
  shouldFocus: boolean;
  onFocused: () => void;
  onChange: (key: string, value: string) => void;
}) {
  const input = useRef<TextInput>(null);
  useEffect(() => {
    if (!shouldFocus || locked) return;
    const frame = requestAnimationFrame(() => {
      focusFormInput(input);
      onFocused();
    });
    return () => cancelAnimationFrame(frame);
  }, [shouldFocus, locked, onFocused]);
  return (
    <>
      {(['name', 'quantity', 'unitPrice', 'amount'] as const).map((key) => (
        <Field
          key={key}
          inputRef={key === 'name' ? input : undefined}
          label={`${index + 1}번 메뉴 ${{ name: '이름', quantity: '수량', unitPrice: '단가', amount: '금액' }[key]}`}
          value={String(item[key] ?? '')}
          disabled={locked}
          onChange={(value) =>
            onChange(
              'items',
              changedReceiptItem(form.values.items || '[]', index, key, value),
            )
          }
        />
      ))}
    </>
  );
}
