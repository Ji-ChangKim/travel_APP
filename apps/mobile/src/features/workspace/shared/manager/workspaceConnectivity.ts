import { onlineManager } from '@tanstack/react-query';
import {
  addNetworkStateListener,
  getNetworkStateAsync,
  type NetworkState,
} from 'expo-network';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useTripStore } from '@/stores/useTripStore';

// 웹은 기존 브라우저 감시를 쓰고 네이티브만 기기 연결 이벤트를 연결한다.
export function useWorkspaceConnectivity(): void {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    let active = true;
    let revision = 0;
    const update = (state: NetworkState) => {
      if (active)
        onlineManager.setOnline(
          state.isConnected === true && state.isInternetReachable !== false,
        );
    };
    onlineManager.setOnline(false);
    const subscription = addNetworkStateListener((state) => {
      revision += 1;
      update(state);
    });
    void getNetworkStateAsync()
      .then((state) => {
        if (revision === 0) update(state);
      })
      .catch(() => {
        if (revision === 0 && active) onlineManager.setOnline(false);
      });
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
}

export function workspaceConnectionAvailable(): boolean {
  return (
    useTripStore.getState().currentUser?.authProvider === 'guest' ||
    onlineManager.isOnline()
  );
}
