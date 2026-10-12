(() => {
  const API_FALLBACK = 'https://olo-chat.duckdns.org';
  const session = () => {
    try { return JSON.parse(localStorage.getItem('olo.session') || '{}'); }
    catch { return {}; }
  };
  const api = (path, options = {}) => {
    if (window.oloApi) return window.oloApi(path, options);
    const current = session();
    return fetch((current.server || API_FALLBACK) + path, {
      ...options,
      headers: {
        ...(current.token ? { Authorization: `Bearer ${current.token}` } : {}),
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers
      }
    });
  };
  const decodeKey = value => {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
    return Uint8Array.from(atob(base64), char => char.charCodeAt(0));
  };
  const encodeKey = value => btoa(String.fromCharCode(...new Uint8Array(value)));
  let publicKeyPromise;

  async function publicKey() {
    if (!publicKeyPromise) {
      publicKeyPromise = api('/api/v1/notifications/web-push/public-key')
        .then(async response => {
          if (!response.ok) throw new Error(response.status === 503 ? 'Уведомления пока не настроены на сервере' : 'Не удалось подготовить уведомления');
          return (await response.json()).publicKey;
        });
    }
    return publicKeyPromise;
  }

  async function enable() {
    const current = session();
    if (!current.token) return;
    const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const standalone = navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
    if (ios && !standalone) {
      alert('На iPhone откройте сайт в Safari, нажмите «Поделиться» → «На экран Домой», запустите Olo с иконки и включите уведомления там.');
      return;
    }
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      alert('Этот браузер не поддерживает push-уведомления.');
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') throw new Error('Разрешение на уведомления не выдано');
      const [key, registration] = await Promise.all([publicKey(), navigator.serviceWorker.ready]);
      const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodeKey(key) });
      const saved = await api('/api/v1/notifications/web-push', { method: 'POST', body: JSON.stringify(subscription.toJSON()) });
      if (!saved.ok) throw new Error('Сервер не сохранил подписку на уведомления');
      alert('Уведомления включены.');
      updateButton();
    } catch (error) {
      alert(error.message || 'Не удалось включить уведомления');
    }
  }

  async function disableForSession(current = session()) {
    if (!current.token || !('serviceWorker' in navigator)) return;
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) return;
      await api('/api/v1/notifications/web-push', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${current.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: subscription.endpoint })
      });
      await subscription.unsubscribe();
    } catch { /* Best effort during logout; the server can remove expired subscriptions. */ }
  }
  window.oloDisablePush = disableForSession;

  function updateButton() {
    const current = session();
    const header = document.querySelector('#app header');
    if (!header || !current.token || header.querySelector('#push-toggle')) return;
    const button = document.createElement('button');
    button.id = 'push-toggle';
    button.type = 'button';
    button.textContent = '🔔';
    button.setAttribute('aria-label', 'Включить push-уведомления');
    button.title = 'Включить push-уведомления';
    button.addEventListener('click', enable);
    const logoutButton = [...header.querySelectorAll('button')].find(item => item.textContent.includes('Выйти'));
    if (logoutButton) header.insertBefore(button, logoutButton);
    else header.append(button);
  }

  const observer = new MutationObserver(updateButton);
  observer.observe(document.getElementById('app') || document.body, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', updateButton);
  navigator.serviceWorker?.addEventListener('message', event => {
    if (event.data?.type === 'OLO_OPEN_CHAT' && event.data.chatId) {
      const url = new URL(location.href);
      url.searchParams.set('chat', event.data.chatId);
      history.replaceState({}, '', url);
      window.dispatchEvent(new CustomEvent('olo-open-chat', { detail: { chatId: event.data.chatId } }));
    }
  });
})();
