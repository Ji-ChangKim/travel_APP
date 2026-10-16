import { useLayoutEffect, useRef, type RefObject } from 'react';
import {
  AccessibilityInfo,
  findNodeHandle,
  Platform,
  type View,
} from 'react-native';
import { topModal } from './modalLayers';

// 활성 창 하나의 초점·Escape·배경 읽기 수명을 관리한다.
export function useModalAccessibility(
  ref: RefObject<View | null>,
  id: symbol,
  active: boolean,
  strict: boolean,
  native: boolean,
  close?: () => void,
): void {
  // 콜백 변경 때문에 읽던 초점을 첫 입력으로 되돌리지 않는다.
  const latest = useRef(close);
  useLayoutEffect(() => {
    // 닫기 행동만 갱신하고 사용자가 읽던 위치는 유지한다.
    latest.current = close;
  }, [close]);
  useLayoutEffect(() => {
    // 최상위 창이 아니면 배경 읽기와 입력을 처리하지 않는다.
    if (!active || (native && Platform.OS !== 'web')) return;
    const node = ref.current;
    if (Platform.OS === 'web' && node instanceof HTMLElement)
      return connectWebModal(node, id, strict, () => latest.current?.());
    let alive = true;
    if (node) {
      // 실제 화면 읽기 기능이 켜진 네이티브에서만 모달 영역으로 초점을 옮긴다.
      void AccessibilityInfo.isScreenReaderEnabled()
        .then((enabled) => {
          // 늦은 읽기 응답이 닫힌 창으로 초점을 이동하지 않는다.
          const handle =
            alive && enabled && topModal()?.id === id
              ? findNodeHandle(node)
              : null;
          if (handle) AccessibilityInfo.setAccessibilityFocus(handle);
        })
        .catch(() => {
          // 읽기 설정 조회 실패가 대화창 사용을 막지 않는다.
          return undefined;
        });
    }
    return () => {
      // 닫기 시작 뒤 설정 조회가 끝나도 초점을 옮기지 않는다.
      alive = false;
    };
  }, [ref, id, active, strict, native]);
}

// 브라우저의 뒤쪽 콘텐츠를 읽거나 누르지 못하게 하고 읽던 초점을 복원한다.
function connectWebModal(
  node: HTMLElement,
  id: symbol,
  strict: boolean,
  close: () => void,
): () => void {
  // 입력 패널에서는 기존 전역 메뉴 이탈 보호를 그대로 사용할 수 있다.
  const previous = document.activeElement;
  const restored = hideBehind(node, strict);
  if (!node.getAttribute('aria-label'))
    node.setAttribute(
      'aria-label',
      node.querySelector('[role="heading"]')?.textContent || '여행 내용',
    );
  const keydown = (event: KeyboardEvent) => {
    // 중첩 창에서는 현재 최상위 창만 키보드를 처리한다.
    if (topModal()?.id !== id) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close();
    }
    if (event.key === 'Tab') cycleFocus(node, strict, event);
  };
  document.addEventListener('keydown', keydown, true);
  node.tabIndex = -1;
  (focusable(node)[0] || node).focus({ preventScroll: true });
  return () => {
    // 이전 배경 속성을 정확히 복원하고 새 창의 초점을 빼앗지 않는다.
    document.removeEventListener('keydown', keydown, true);
    restored.forEach((restore) => {
      // 숨기기 전의 읽기·입력 상태로 돌린다.
      restore();
    });
    if (
      previous instanceof HTMLElement &&
      previous.isConnected &&
      !previous.closest('[inert]')
    )
      previous.focus({ preventScroll: true });
  };
}

// 패널 뒤 콘텐츠만 숨기고 인라인 편집의 하단 메뉴는 남긴다.
function hideBehind(node: HTMLElement, strict: boolean): (() => void)[] {
  // 루트 이탈 확인창은 전역 메뉴까지 포함해 배경 전체를 막는다.
  const restores: (() => void)[] = [];
  let current: HTMLElement | null = node;
  while (current?.parentElement && current.parentElement !== document.body) {
    const parent: HTMLElement = current.parentElement;
    for (const sibling of parent.children)
      if (
        sibling !== current &&
        sibling instanceof HTMLElement &&
        !['SCRIPT', 'STYLE'].includes(sibling.tagName)
      )
        restores.push(hideElement(sibling));
    if (!strict && parent.dataset.testid === 'app-page-content') break;
    current = parent;
  }
  return restores;
}

// 한 요소의 기존 읽기·입력 차단 속성을 보존한다.
function hideElement(element: HTMLElement): () => void {
  // 다른 기능이 이미 숨긴 콘텐츠를 모달 종료 때 임의로 노출하지 않는다.
  const hidden = element.getAttribute('aria-hidden');
  const inert = element.inert;
  element.setAttribute('aria-hidden', 'true');
  element.inert = true;
  return () => {
    // 원래 있던 속성과 값을 복원한다.
    if (hidden === null) element.removeAttribute('aria-hidden');
    else element.setAttribute('aria-hidden', hidden);
    element.inert = inert;
  };
}

// 실제 표시되고 활성인 입력·행동만 초점 순환 대상으로 읽는다.
function focusable(node: Element): HTMLElement[] {
  // 숨겨진 카드나 저장 잠금 상태에는 키보드 초점이 가지 않는다.
  return Array.from(
    node.querySelectorAll<HTMLElement>(
      'input,select,textarea,button,a[href],[tabindex],[role="button"]',
    ),
  ).filter((element) => {
    // 화면 밖·읽기 제외·비활성 컨트롤을 걸러낸다.
    return (
      element.tabIndex >= 0 &&
      !element.matches(':disabled,[aria-disabled="true"]') &&
      !element.closest('[aria-hidden="true"],[inert]') &&
      element.getClientRects().length > 0
    );
  });
}

// 배경으로 나가지 않고 현재 창과 허용된 전역 메뉴 사이를 순환한다.
function cycleFocus(
  node: HTMLElement,
  strict: boolean,
  event: KeyboardEvent,
): void {
  // 전역 메뉴도 기존 이탈 확인을 통해서만 이동한다.
  const menu = !strict
    ? document.querySelector('[aria-label="하단 내비게이션"]')
    : null;
  const items = [...focusable(node), ...(menu ? focusable(menu) : [])];
  if (!items.length) {
    // 저장 잠금으로 모든 행동이 비활성이어도 배경으로 초점을 보내지 않는다.
    event.preventDefault();
    node.focus({ preventScroll: true });
    return;
  }
  const current = items.indexOf(document.activeElement as HTMLElement);
  if (
    items.length &&
    (current < 0 ||
      (!event.shiftKey && current === items.length - 1) ||
      (event.shiftKey && current === 0))
  ) {
    event.preventDefault();
    items[event.shiftKey ? items.length - 1 : 0]!.focus();
  }
}
