const { test, expect } = require('@playwright/test');

test('вход, поиск, профиль и отправка сообщения используют API', async ({ page }) => {
  const calls = [];
  await page.route('https://olo-chat.duckdns.org/api/v1/**', async route => {
    const request = route.request(); const url = new URL(request.url()); const path = url.pathname; const method = request.method();
    calls.push(`${method} ${path}`);
    if (path.endsWith('/auth/login')) return route.fulfill({ json: { token: 'access-1', refreshToken: 'refresh-1', userId: 'user-1', username: 'alice' } });
    if (path.endsWith('/ws-ticket')) return route.fulfill({ status: 503, json: { message: 'offline in test' } });
    if (path.endsWith('/users/me') && method === 'GET') return route.fulfill({ json: { id: 'user-1', username: 'alice', displayName: 'Alice', avatarUrl: null } });
    if (path.endsWith('/users/me') && method === 'PUT') return route.fulfill({ json: { id: 'user-1', username: 'alice', displayName: 'Alice Updated', avatarUrl: null } });
    if (path.endsWith('/users/search')) return route.fulfill({ json: [{ id: 'user-2', username: 'bob', displayName: 'Bob', avatarUrl: null }] });
    if (path === '/api/v1/chats' && method === 'GET') return route.fulfill({ json: [] });
    if (path.endsWith('/chats/direct/user-2')) return route.fulfill({ status: 404, json: {} });
    if (path.endsWith('/chats/direct/messages')) return route.fulfill({ json: { id: 'message-1', chatId: 'chat-1', senderId: 'user-1', content: 'hello', status: 'SENT', timestamp: new Date().toISOString() } });
    return route.fulfill({ status: 200, json: [] });
  });
  await page.goto('/');
  await page.getByPlaceholder('Логин').fill('alice');
  await page.getByPlaceholder('Пароль').fill('StrongPass1!');
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page.getByPlaceholder('Поиск пользователей')).toBeVisible();
  await page.getByPlaceholder('Поиск пользователей').fill('bob');
  await expect(page.getByText('Bob', { exact: true })).toBeVisible();
  await page.getByText('Bob', { exact: true }).click();
  await page.getByPlaceholder('Сообщение').fill('hello');
  await page.getByRole('button', { name: 'Отправить' }).click();
  await expect(page.getByText('hello')).toBeVisible();
  await page.getByRole('button', { name: 'Назад' }).click();
  await page.getByRole('button', { name: 'Профиль' }).click();
  await expect(page.getByPlaceholder('Имя (необязательно)')).toHaveValue('Alice');
  await page.getByPlaceholder('Имя (необязательно)').fill('Alice Updated');
  await page.getByRole('button', { name: 'Сохранить' }).click();
  expect(calls).toContain('POST /api/v1/auth/login');
  expect(calls).toContain('GET /api/v1/users/search');
  expect(calls).toContain('POST /api/v1/chats/direct/messages');
  expect(calls).toContain('PUT /api/v1/users/me');
});

test('поля логина и пароля автоматически удаляют пробелы', async ({ page }) => {
  await page.goto('/');
  await page.getByPlaceholder('Логин').fill('a b');
  await page.getByPlaceholder('Пароль').fill('a b');
  await expect(page.getByPlaceholder('Логин')).toHaveValue('ab');
  await expect(page.getByPlaceholder('Пароль')).toHaveValue('ab');
});

test('истёкший access token обновляется без повторного входа', async ({ page }) => {
  let profileCalls = 0;
  let refreshCalls = 0;
  await page.addInitScript(() => localStorage.setItem('olo.session', JSON.stringify({
    server: 'https://olo-chat.duckdns.org', token: 'expired-access', refreshToken: 'refresh-1', userId: 'user-1', username: 'alice'
  })));
  await page.route('https://olo-chat.duckdns.org/api/v1/**', async route => {
    const { pathname } = new URL(route.request().url());
    if (pathname.endsWith('/auth/refresh')) {
      refreshCalls++;
      return route.fulfill({ json: { token: 'access-2', refreshToken: 'refresh-2', userId: 'user-1', username: 'alice' } });
    }
    if (pathname.endsWith('/ws-ticket')) return route.fulfill({ status: 503, json: {} });
    if (pathname.endsWith('/users/me')) {
      profileCalls++;
      if (profileCalls === 1) return route.fulfill({ status: 401, json: {} });
      expect(route.request().headers().authorization).toBe('Bearer access-2');
      return route.fulfill({ json: { id: 'user-1', username: 'alice', displayName: 'Alice', avatarUrl: null } });
    }
    if (pathname.endsWith('/chats')) return route.fulfill({ json: [] });
    return route.fulfill({ status: 200, json: [] });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Профиль' }).click();
  await expect(page.getByPlaceholder('Имя (необязательно)')).toHaveValue('Alice');
  expect(refreshCalls).toBe(1);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('olo.session')).refreshToken)).toBe('refresh-2');
});

test('список чатов показывает автора, время последнего сообщения и статус соединения', async ({ page }) => {
  const sentAt = new Date();
  sentAt.setUTCHours(12, 34, 0, 0);
  await page.route('https://olo-chat.duckdns.org/api/v1/**', async route => {
    const { pathname } = new URL(route.request().url());
    if (pathname.endsWith('/auth/login')) return route.fulfill({ json: { token: 'access-1', refreshToken: 'refresh-1', userId: 'user-1', username: 'alice' } });
    if (pathname.endsWith('/ws-ticket')) return route.fulfill({ status: 503, json: {} });
    if (pathname.endsWith('/chats')) return route.fulfill({ json: [{
      id: 'chat-1', type: 'DIRECT', partnerName: 'Bob', partnerAvatarUrl: null,
      lastMessage: 'Привет', lastMessageAt: sentAt.toISOString(), lastMessageSenderId: 'user-1', unreadCount: 1
    }] });
    return route.fulfill({ status: 200, json: {} });
  });
  await page.goto('/');
  await page.getByPlaceholder('Логин').fill('alice');
  await page.getByPlaceholder('Пароль').fill('StrongPass1!');
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page.getByText('Вы: Привет')).toBeVisible();
  await expect(page.locator('.chat-time')).toHaveText(/\d{2}:\d{2}(?:\s?[AP]M)?/);
  await expect(page.locator('#connection-status')).toContainText(/переподключаемся/i);
});
