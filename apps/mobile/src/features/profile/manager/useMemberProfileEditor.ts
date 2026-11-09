import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import type { ImageSourcePropType } from 'react-native';
import type { Profile } from '@wherego/domain';
import {
  nicknameValidationError,
  normalizeProfileNickname,
} from '@wherego/validation';
import { fetchUserProfile } from '@/services/profileService';
import { authRevision } from '@/services/cloudAuth';
import { useTripStore } from '@/stores/useTripStore';
import {
  changeMemberPhoto,
  memberPhotoSource,
  releaseMemberPhotoSource,
} from './memberProfilePhotoService';
import {
  memberProfileError,
  nicknameAvailable,
  saveMemberNickname,
} from './memberProfileService';

type EditorState = {
  open: boolean;
  nickname: string;
  checked: string | null;
  busy: boolean;
  error: string;
  notice: string;
};
const empty: EditorState = {
  open: false,
  nickname: '',
  checked: null,
  busy: false,
  error: '',
  notice: '',
};

export function useMemberProfileEditor(user: Profile | null) {
  const id = user?.id || '';
  const revision = authRevision();
  const cache = useQueryClient();
  const scope = useRef({ id, revision, active: true, busy: false });
  const [state, setState] = useState({ ...empty, id, revision });
  const [photo, setPhoto] = useState<{
    id: string;
    revision: number;
    url: string;
    source: ImageSourcePropType;
  } | null>(null);
  const [photoAttempt, setPhotoAttempt] = useState(0);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const current =
    state.id === id && state.revision === revision
      ? state
      : { ...empty, id, revision };
  useEffect(() => {
    const currentScope = { id, revision, active: true, busy: false };
    scope.current = currentScope;
    return () => {
      currentScope.active = false;
    };
  }, [id, revision]);
  const queryKey = ['member-profile', id, revision];
  const profile = useQuery({
    queryKey,
    queryFn: () => fetchUserProfile(id),
    enabled: Boolean(id && user?.authProvider !== 'guest'),
    retry: false,
  });
  useEffect(() => {
    if (
      profile.data?.id === id &&
      authRevision() === revision &&
      useTripStore.getState().currentUser?.id === id
    )
      useTripStore.getState().updateProfile(profile.data);
  }, [profile.data, id, revision]);
  const refetch = profile.refetch;
  useFocusEffect(
    useCallback(() => {
      if (id && user?.authProvider !== 'guest') void refetch();
    }, [id, user?.authProvider, refetch]),
  );
  useEffect(() => {
    if (!id || user?.avatarType !== 'photo' || !user.avatarUrl) return;
    let active = true;
    let source: ImageSourcePropType | undefined;
    const url = user.avatarUrl;
    void memberPhotoSource(id, url)
      .then((value) => {
        source = value;
        if (active) setPhoto({ id, revision, url, source: value });
        else releaseMemberPhotoSource(value);
      })
      .catch(() => {
        if (active) setPhotoError(`${id}:${revision}:${url}`);
      });
    return () => {
      active = false;
      if (source) releaseMemberPhotoSource(source);
    };
  }, [id, user?.avatarUrl, user?.avatarType, revision, photoAttempt]);
  function patch(value: Partial<EditorState>) {
    setState((previous) => ({
      ...(previous.id === id && previous.revision === revision
        ? previous
        : { ...empty, id, revision }),
      ...value,
    }));
  }
  function valid(started: typeof scope.current): boolean {
    return (
      started.active &&
      scope.current === started &&
      authRevision() === started.revision &&
      useTripStore.getState().currentUser?.id === started.id
    );
  }
  async function run(
    action: () => Promise<Profile | null | boolean>,
    kind: 'check' | 'nickname' | 'photo',
  ) {
    const started = scope.current;
    if (started.busy || !valid(started)) return;
    started.busy = true;
    patch({ busy: true, error: '', notice: '' });
    try {
      if (kind !== 'check') await cache.cancelQueries({ queryKey });
      if (!valid(started)) return;
      const result = await action();
      if (!valid(started)) return;
      if (typeof result === 'boolean')
        patch({
          checked: result ? normalizeProfileNickname(current.nickname) : null,
          error: result
            ? ''
            : '이미 사용 중인 닉네임이에요. 다른 이름을 입력해 주세요.',
        });
      else if (result) {
        if (result.id !== id) throw new Error('PROFILE_ACTOR_MISMATCH');
        useTripStore.getState().updateProfile(result);
        cache.setQueryData(queryKey, result);
        patch({
          open: false,
          notice:
            kind === 'photo' ? '프로필 사진을 바꿨어요.' : '닉네임을 바꿨어요.',
        });
      }
    } catch (error) {
      if (valid(started)) {
        patch({ error: memberProfileError(error), checked: null });
        void profile.refetch();
      }
    } finally {
      started.busy = false;
      if (valid(started)) patch({ busy: false });
    }
  }
  const nickname = normalizeProfileNickname(current.nickname);
  const validation = nicknameValidationError(current.nickname);
  const next = user?.nicknameNextChangeAt
    ? new Date(user.nicknameNextChangeAt).getTime()
    : 0;
  useEffect(() => {
    if (user?.nicknameChangeAllowed !== false || !next) return;
    const wait = next - Date.now();
    if (wait <= 0) return;
    const timer = setTimeout(
      () => {
        void refetch();
      },
      Math.min(wait + 50, 2147483647),
    );
    return () => clearTimeout(timer);
  }, [next, user?.nicknameChangeAllowed, refetch]);
  return {
    ...current,
    photoError:
      photoError === `${id}:${revision}:${user?.avatarUrl}` &&
      (!photo ||
        photo.id !== id ||
        photo.revision !== revision ||
        photo.url !== user?.avatarUrl),
    reload: () => {
      setPhotoAttempt((value) => value + 1);
      void profile.refetch();
    },
    profile,
    validation,
    imageSource:
      photo &&
      photo.id === id &&
      photo.revision === revision &&
      photo.url === user?.avatarUrl
        ? photo.source
        : undefined,
    editable: user?.canEditProfile === true,
    cooldown: user?.nicknameChangeAllowed === false,
    nextChangeAt: user?.nicknameNextChangeAt || null,
    openEditor: () =>
      patch({
        open: true,
        nickname: user?.nicknameConfigured ? user.nickname : '',
        checked: null,
        error: '',
        notice: '',
      }),
    closeEditor: () => {
      if (!scope.current.busy) patch({ open: false, error: '' });
    },
    changeNickname: (value: string) =>
      patch({ nickname: value, checked: null, error: '' }),
    checkNickname: () =>
      validation
        ? patch({ error: validation })
        : run(() => nicknameAvailable(id, nickname), 'check'),
    saveNickname: () =>
      !validation && current.checked === nickname
        ? run(() => saveMemberNickname(id, nickname), 'nickname')
        : undefined,
    changePhoto: (camera: boolean) =>
      run(() => changeMemberPhoto(id, camera), 'photo'),
  };
}
