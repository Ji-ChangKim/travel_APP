import type { UseQueryResult } from '@tanstack/react-query';
import type { PersistedTrip, Profile } from '@wherego/domain';
import type { ImperativeRouter } from 'expo-router';
import type { Dispatch, SetStateAction } from 'react';
export type MyAccountViewProps = {
  profileNotice: string;
  largeText: boolean;
  currentUser: Profile | null;
  userId: string;
  isSavingProfile: boolean;
  openProfileEditModal: () => undefined;
  router: ImperativeRouter;
  serverTrips: UseQueryResult<PersistedTrip[], Error>;
  isProfileEditModalOpen: boolean;
  closeProfileEditModal: () => void;
  editNickname: string;
  setEditNickname: Dispatch<SetStateAction<string>>;
  editBio: string;
  setEditBio: Dispatch<SetStateAction<string>>;
  editTravelStyles: string[];
  handleToggleTravelStyle: (tag: string) => void;
  profileError: string;
  handleSaveProfile: () => void;
};

export type ProfileEditorProps = {
  isProfileEditModalOpen: boolean;
  closeProfileEditModal: () => void;
  isSavingProfile: boolean;
  editNickname: string;
  setEditNickname: Dispatch<SetStateAction<string>>;
  currentUser: Profile | null;
  editBio: string;
  setEditBio: Dispatch<SetStateAction<string>>;
  editTravelStyles: string[];
  handleToggleTravelStyle: (tag: string) => void;
  profileError: string;
  handleSaveProfile: () => void;
};

export type AccountProfileProps = {
  largeText: boolean;
  currentUser: Profile | null;
  userId: string;
  isSavingProfile: boolean;
  openProfileEditModal: () => undefined;
};
