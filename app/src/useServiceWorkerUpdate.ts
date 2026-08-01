import { useSyncExternalStore } from "react";
import { getUpdateWatcher, subscribeToUpdateWatcher } from "./lib/swUpdate";

export function useServiceWorkerUpdate(): { updateAvailable: boolean; applyUpdate: () => void } {
  const updateAvailable = useSyncExternalStore(
    subscribeToUpdateWatcher,
    () => getUpdateWatcher()?.isUpdateAvailable() ?? false,
  );
  return {
    updateAvailable,
    applyUpdate: () => getUpdateWatcher()?.applyUpdate(),
  };
}
