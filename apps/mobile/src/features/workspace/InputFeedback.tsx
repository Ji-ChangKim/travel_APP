import Text from '@/components/AppText';
import { colors } from '@/constants/theme';
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
  type RefObject,
} from 'react';
import { ScrollView, View, type TextInput } from 'react-native';
import type { FormFeedbackState } from './formFeedback';

type Target = { node: View; focus?: () => void };
type Scope = {
  locked: boolean;
  feedback: FormFeedbackState;
  register: (name: string, node: View | null, focus?: () => void) => void;
};
const context = createContext<Scope>({
  locked: false,
  feedback: { fields: {}, attempt: 0 },
  register: () => {
    // 편집 폼 밖의 입력에는 초점 대상을 등록하지 않는다.
    return undefined;
  },
});

// 한 폼의 입력 잠금과 오류 이동 대상을 함께 연결한다.
export function FormFeedback(props: {
  locked: boolean;
  feedback: FormFeedbackState;
  scroll: RefObject<ScrollView | null>;
  children: ReactNode;
}) {
  // 다른 폼이나 화면의 입력 참조를 공유하지 않는다.
  return (
    <FeedbackScope
      {...props}
      targets={useRef<Record<string, Target>>({})}
      seen={useRef(0)}
    />
  );
}

// 새 검증 시도에서만 첫 오류로 이동한다.
function FeedbackScope({
  locked,
  feedback,
  scroll,
  children,
  targets,
  seen,
}: Parameters<typeof FormFeedback>[0] & {
  targets: RefObject<Record<string, Target>>;
  seen: RefObject<number>;
}) {
  // 필드를 고칠 때마다 초점을 빼앗지 않고 제출 시에만 이동한다.
  return (
    useEffect(() => {
      // 같은 검증 결과의 재렌더에서는 이동을 반복하지 않는다.
      return feedback.attempt === seen.current
        ? undefined
        : (rememberFeedbackAttempt(seen, feedback.attempt),
          scheduleFirstError(feedback, targets.current, scroll));
    }, [feedback, scroll, seen, targets]),
    (
      <context.Provider
        value={{
          locked,
          feedback,
          register: (name, node, focus) => {
            // 입력이 닫히면 오래된 화면 참조를 즉시 제거한다.
            return registerFormTarget(targets, name, node, focus);
          },
        }}
      >
        {children}
      </context.Provider>
    )
  );
}

// 검증 효과가 확인한 제출 순번만 기록한다.
function rememberFeedbackAttempt(
  seen: RefObject<number>,
  attempt: number,
): void {
  // 렌더링 중에는 참조를 수정하지 않는다.
  return void (seen.current = attempt);
}

// 입력의 연결·해제 콜백에서만 초점 대상을 바꾼다.
function registerFormTarget(
  targets: RefObject<Record<string, Target>>,
  name: string,
  node: View | null,
  focus?: () => void,
): void {
  // 화면에 연결된 현재 입력 참조만 보관한다.
  return void (node
    ? (targets.current[name] = { node, focus })
    : delete targets.current[name]);
}

// 오류가 난 입력을 다음 화면 프레임에서 드러낸다.
function scheduleFirstError(
  feedback: FormFeedbackState,
  targets: Record<string, Target>,
  scroll: RefObject<ScrollView | null>,
): () => void {
  // 오류 표시가 배치된 다음 실제 입력을 찾는다.
  return cancelFrame(
    requestAnimationFrame(() => {
      // 등록된 첫 오류만 선택하며 숨겨진 입력을 억지로 조작하지 않는다.
      return revealError(
        Object.keys(feedback.fields)
          .map((name) => {
            // 같은 라벨을 가진 실제 화면의 대상만 읽는다.
            return targets[name];
          })
          .find(Boolean),
        scroll,
      );
    }),
  );
}

// 폼이 사라지면 예약된 초점 이동을 취소한다.
function cancelFrame(frame: number): () => void {
  // 닫힌 모달이나 이전 계정의 입력에 늦게 초점을 주지 않는다.
  return () => {
    /* 현재 프레임 예약 하나만 취소한다. */ return cancelAnimationFrame(frame);
  };
}

// 첫 입력 오류의 위치와 초점을 함께 맞춘다.
function revealError(
  target: Target | undefined,
  scroll: RefObject<ScrollView | null>,
): void {
  // 스크롤이 없는 폼도 입력 초점은 제공한다.
  return !target
    ? undefined
    : void (target.focus ? target.focus() : target.node.focus(),
      scroll.current
        ? target.node.measureLayout(
            scroll.current.getInnerViewNode(),
            (_left, top) => {
              // 첫 오류 위에 짧은 여백을 두고 키보드와 겹치지 않게 한다.
              return scroll.current?.scrollTo({
                y: Math.max(0, top - 16),
                animated: true,
              });
            },
            () => {
              /* 측정 실패가 입력 내용을 지우지 않게 한다. */ return undefined;
            },
          )
        : undefined);
}

// 공통 입력과 선택 버튼이 같은 폼 잠금을 읽는다.
export function useFormScope(): Scope {
  // 폼 밖에서는 기존의 개별 disabled 제어를 유지한다.
  return useContext(context);
}

// 필드 옆 안내와 초점 이동용 위치를 등록한다.
export function FormAnchor({
  name,
  focus,
  children,
}: {
  name: string;
  focus?: () => void;
  children: ReactNode;
}) {
  // 날짜·국가처럼 텍스트 입력이 아닌 선택 영역도 대상으로 등록한다.
  return (
    <AnchorContent name={name} focus={focus} scope={useFormScope()}>
      {children}
    </AnchorContent>
  );
}

// 입력 영역 하나를 폼의 라벨과 연결한다.
function AnchorContent({
  name,
  focus,
  children,
  scope,
}: {
  name: string;
  focus?: () => void;
  children: ReactNode;
  scope: Scope;
}) {
  // 오류는 읽을 수 있는 문구로 남기고 기존 화면의 전체 오류 안내를 유지한다.
  return (
    <View
      ref={(node) => {
        /* 현재 입력 영역의 수명만 등록한다. */ return scope.register(
          name,
          node,
          focus,
        );
      }}
      focusable
      style={{ gap: 6 }}
    >
      {children}
      {scope.feedback.fields[name] ? (
        <Text
          accessibilityLiveRegion="polite"
          style={{ color: colors.danger, lineHeight: 22 }}
        >
          {scope.feedback.fields[name]}
        </Text>
      ) : null}
    </View>
  );
}

// 입력 참조가 준비된 경우에만 실제 키보드 초점을 옮긴다.
export function focusFormInput(input: RefObject<TextInput | null>): void {
  // 입력을 재생성하거나 작성값을 바꾸지 않는다.
  return input.current?.focus();
}
