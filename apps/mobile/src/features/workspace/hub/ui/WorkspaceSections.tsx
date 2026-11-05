// 기존 호출 경로는 유지하고 기능별 화면 모듈의 표현 함수만 다시 내보낸다.
export {
  renderWorkspaceCourse,
  renderWorkspaceItinerary,
} from './WorkspaceItineraryView';
export { renderWorkspaceMap } from './WorkspaceMapView';
export {
  renderWorkspacePhotos,
  renderWorkspaceCapture,
} from './WorkspaceMediaView';
export { renderWorkspaceExpenses } from './WorkspaceExpenseView';
export { renderWorkspaceSharing } from './WorkspaceSharingView';
export { renderWorkspaceMembers } from './WorkspaceMembersView';
export { renderWorkspaceChecklist } from './WorkspaceChecklistView';
export {
  renderWorkspaceSummary,
  renderWorkspaceFlightPrompt,
  renderWorkspaceHeader,
} from './WorkspaceHeadingView';
