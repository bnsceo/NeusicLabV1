const DEMO_STORAGE_KEYS = ['missionDraft', 'dashboardPrefs', 'loadMission'];

export function clearDemoClientState() {
  if (typeof window === 'undefined') return;

  for (const key of DEMO_STORAGE_KEYS) {
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  }
}

export function reloadFreshDemoPage() {
  if (typeof window === 'undefined') return;
  window.location.reload();
}
