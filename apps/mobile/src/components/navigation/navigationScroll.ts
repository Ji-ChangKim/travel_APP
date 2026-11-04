import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

type Listener = (visible: boolean) => void;

class NavigationScrollEmitter {
  private visible = true;
  private lastY = 0;
  private listeners = new Set<Listener>();

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.visible);
    return () => this.listeners.delete(listener);
  }

  get isVisible(): boolean {
    return this.visible;
  }

  setVisible(visible: boolean): void {
    if (this.visible === visible) return;
    this.visible = visible;
    for (const listener of this.listeners) {
      listener(this.visible);
    }
  }

  handleScroll(currentY: number): void {
    // 최상단 근처에서는 항상 GNB를 표시한다.
    if (currentY <= 20) {
      this.setVisible(true);
      this.lastY = Math.max(0, currentY);
      return;
    }
    // 아래로 스크롤 시 GNB를 부드럽게 숨긴다.
    if (currentY > this.lastY + 8 && this.visible) {
      this.setVisible(false);
      this.lastY = currentY;
      return;
    }
    // 위로 스크롤 시 GNB를 다시 올린다.
    if (currentY < this.lastY - 8 && !this.visible) {
      this.setVisible(true);
      this.lastY = currentY;
      return;
    }
    this.lastY = currentY;
  }

  reset(): void {
    this.setVisible(true);
    this.lastY = 0;
  }
}

export const navigationScroll = new NavigationScrollEmitter();

// 네이티브 ScrollView 및 FlatList에서 사용할 수 있는 스크롤 핸들러
export function onGnbScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
  const currentY = event.nativeEvent?.contentOffset?.y ?? 0;
  navigationScroll.handleScroll(currentY);
}
