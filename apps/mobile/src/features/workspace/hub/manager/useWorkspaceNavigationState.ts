import { useState } from 'react';

export function useWorkspaceNavigationState(section: string | undefined) {
  // 여행 계획과 현장 기록을 작업별 영역으로 나눈다.
  const [activeSection, setActiveSection] = useState(
    section === 'companions'
      ? 'companions'
      : section === 'share'
        ? 'share'
        : section === 'map'
          ? 'map'
          : section === 'expenses'
            ? 'expenses'
            : 'itinerary',
  );
  const [selectedDay, setSelectedDay] = useState('');
  const [selectedScheduleId, setSelectedScheduleId] = useState('');
  const [courseDay, setCourseDay] = useState('');
  const [showTripMore, setShowTripMore] = useState(false);
  const [orderingDay, setOrderingDay] = useState('');

  return {
    activeSection,
    setActiveSection,
    selectedDay,
    setSelectedDay,
    selectedScheduleId,
    setSelectedScheduleId,
    courseDay,
    setCourseDay,
    showTripMore,
    setShowTripMore,
    orderingDay,
    setOrderingDay,
  };
}
