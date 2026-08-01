import { createUpdateWatcher, setUpdateWatcher } from "./lib/swUpdate";

export function registerServiceWorker(): void {
  if (!("serviceWorker" in navigator)) return;
  // skipWaiting()により新SWがactivate(+clients.claim())した結果、
  // ページの制御が切り替わったタイミングでリロードして新シェルを反映する
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    window.location.reload();
  });
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .then((registration) => {
        setUpdateWatcher(createUpdateWatcher(registration));
      })
      .catch((err) => {
        console.error("Service Worker registration failed:", err);
      });
  });
}
