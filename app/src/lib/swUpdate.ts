export interface UpdateWatcher {
  subscribe(listener: () => void): () => void;
  isUpdateAvailable(): boolean;
  applyUpdate(): void;
}

/** 新しいService Workerが「待機中」になったこと(=既存ページを制御しているSWの
 * 上に本当の更新が来たこと)を検知するwatcherを作る。
 * hasControllerで「初回インストール(まだ何も制御していない)」と
 * 「既に制御中のSWがあり、その上に更新が来た」を区別する(定番の判定)。 */
export function createUpdateWatcher(
  registration: ServiceWorkerRegistration,
  hasController: () => boolean = () => navigator.serviceWorker.controller != null,
): UpdateWatcher {
  let updateAvailable = registration.waiting != null && hasController();
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());

  registration.addEventListener("updatefound", () => {
    const newWorker = registration.installing;
    newWorker?.addEventListener("statechange", () => {
      if (newWorker.state === "installed" && hasController()) {
        updateAvailable = true;
        notify();
      }
    });
  });

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    isUpdateAvailable: () => updateAvailable,
    applyUpdate: () => registration.waiting?.postMessage("SKIP_WAITING"),
  };
}

// main.tsx(registerServiceWorker)でのwatcher生成タイミングと、
// App.tsxのマウントタイミングは非同期にずれるため、モジュールレベルの
// 簡易ストアで橋渡しする(useServiceWorkerUpdate.tsから購読される)。
let currentWatcher: UpdateWatcher | null = null;
const storeListeners = new Set<() => void>();

export function setUpdateWatcher(watcher: UpdateWatcher): void {
  currentWatcher = watcher;
  watcher.subscribe(() => storeListeners.forEach((listener) => listener()));
  storeListeners.forEach((listener) => listener());
}

export function getUpdateWatcher(): UpdateWatcher | null {
  return currentWatcher;
}

export function subscribeToUpdateWatcher(listener: () => void): () => void {
  storeListeners.add(listener);
  return () => storeListeners.delete(listener);
}
