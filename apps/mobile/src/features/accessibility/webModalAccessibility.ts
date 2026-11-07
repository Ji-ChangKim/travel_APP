import { topModal } from './modalLayers';

export type ModalFocusMemory = {
  node: HTMLElement | null;
  opener: Element | null;
  inside: HTMLElement | null;
};

// 브라우저의 뒤쪽 콘텐츠를 읽거나 누르지 못하게 하고 읽던 초점을 복원한다.
export function connectWebModal(
  node: HTMLElement,
  id: symbol,
  strict: boolean,
  close: () => void,
  memory: ModalFocusMemory,
): () => void {
  // 입력 패널에서는 기존 전역 메뉴 이탈 보호를 그대로 사용할 수 있다.
  if (memory.node !== node) {
    // 새로 열린 창의 시작점만 보관하고 중첩 확인 복귀 때는 덮어쓰지 않는다.
    memory.node = node;
    memory.opener = document.activeElement;
    memory.inside = null;
  }
  const previous = memory.opener;
  const restored = hideBehind(node, strict);
  if (!node.getAttribute('aria-label'))
    node.setAttribute(
      'aria-label',
      node.querySelector('[role="heading"]')?.textContent || '여행 내용',
    );
  let composing = false;
  let composingKeyDown = false;
  const compositionStart = () => {
    composing = true;
  };
  const compositionEnd = () => {
    composing = false;
  };
  const keydown = (event: KeyboardEvent) => {
    // 중첩 창에서는 현재 최상위 창만 키보드를 처리한다.
    if (topModal()?.id !== id) return;
    composingKeyDown = composing || event.isComposing || event.keyCode === 229;
    if (composingKeyDown) return;
    if (event.key === 'Tab') cycleFocus(node, strict, event);
  };
  const keyup = (event: KeyboardEvent) => {
    if (topModal()?.id !== id) return;
    // IME가 keyup 전에 compositionend를 보내도 같은 조합 취소 키를 기억한다.
    const compositionKey =
      composingKeyDown ||
      composing ||
      event.isComposing ||
      event.keyCode === 229;
    composingKeyDown = false;
    if (event.key !== 'Escape') return;
    // RN 웹 모달도 keyup을 사용한다. keydown에서 새 확인창을 열면 같은 키의
    // keyup이 확인창까지 닫으므로 현재 최상위 창에서 한 번만 처리한다.
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!compositionKey) close();
  };
  document.addEventListener('keydown', keydown, true);
  document.addEventListener('keyup', keyup, true);
  node.addEventListener('compositionstart', compositionStart);
  node.addEventListener('compositionend', compositionEnd);
  const rememberFocus = (event: FocusEvent) => {
    // 중첩 창이 열리며 버튼이 잠기기 전에 읽던 위치를 보관한다.
    if (event.target instanceof HTMLElement) memory.inside = event.target;
  };
  node.addEventListener('focusin', rememberFocus);
  node.tabIndex = -1;
  const items = focusable(node);
  (memory.inside && items.includes(memory.inside)
    ? memory.inside
    : items[0] || node
  ).focus({ preventScroll: true });
  return () => {
    // 이전 배경 속성을 정확히 복원하고 새 창의 초점을 빼앗지 않는다.
    document.removeEventListener('keydown', keydown, true);
    document.removeEventListener('keyup', keyup, true);
    node.removeEventListener('compositionstart', compositionStart);
    node.removeEventListener('compositionend', compositionEnd);
    node.removeEventListener('focusin', rememberFocus);
    restored.forEach((restore) => {
      // 숨기기 전의 읽기·입력 상태로 돌린다.
      restore();
    });
    if (
      previous instanceof HTMLElement &&
      (!topModal() || topModal()?.id === id) &&
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
  while (
    current?.parentElement &&
    (strict || current.parentElement !== document.body)
  ) {
    const parent: HTMLElement = current.parentElement;
    for (const sibling of parent.children)
      if (
        sibling !== current &&
        sibling instanceof HTMLElement &&
        !['SCRIPT', 'STYLE'].includes(sibling.tagName)
      )
        restores.push(hideElement(sibling));
    // 전체 화면 창은 body에 붙은 앱 루트도 가리고 자기 포털은 남긴다.
    if (
      parent === document.body ||
      (!strict && parent.dataset.testid === 'app-page-content')
    )
      break;
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
