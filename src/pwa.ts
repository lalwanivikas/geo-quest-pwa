export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) {
    return
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, {
        scope: import.meta.env.BASE_URL,
      })
      .catch(() => {
        // The app still works online if service-worker registration is blocked.
      })
  })
}
