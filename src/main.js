import { Studio } from './app.js';
const studio = new Studio(document.querySelector('#app'));
studio.init().catch(error => {
  document.querySelector('#app').textContent = `起動できませんでした。ブラウザを再読み込みしてください。${error.message}`;
});
// No photo data is passed to the service worker. Development skips caching by default.
if ('serviceWorker' in navigator && isSecureContext && (!['localhost','127.0.0.1','[::1]'].includes(location.hostname) || new URLSearchParams(location.search).has('sw'))) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
