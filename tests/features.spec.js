const { test, expect } = require('@playwright/test');

test('архив, поиск сообщений и переключение аккаунтов', async ({ page }) => {
  const chats = [{ id: 'chat-1', type: 'DIRECT', partnerName: 'Борис', partnerUserId: 'user-2', lastMessage: 'Привет', lastMessageAt: new Date().toISOString() }];
  await page.route('https://olo-chat.duckdns.org/api/v1/**', async route => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname;
    if (path.endsWith('/auth/login')) { const username = JSON.parse(req.postData()).username; return route.fulfill({ json: { token: `access-${username}`, refreshToken: `refresh-${username}`, userId: username, username } }); }
    if (path.endsWith('/ws-ticket')) return route.fulfill({ status: 503, json: {} });
    if (path.endsWith('/chats/search/messages')) return route.fulfill({ json: [{ chatId: 'chat-1', message: { id: 'message-1', content: 'Привет', timestamp: new Date().toISOString() } }] });
    if (path.endsWith('/users/search')) return route.fulfill({ json: [] });
    if (path.endsWith('/chats/chat-1/preferences')) { chats[0].archivedAt = new Date().toISOString(); return route.fulfill({ json: { muted: false, pinnedAt: null, archivedAt: chats[0].archivedAt } }); }
    if (path.endsWith('/chats')) return route.fulfill({ json: chats });
    if (path.endsWith('/users/me')) return route.fulfill({ json: { username: 'alice', displayName: 'Alice' } });
    return route.fulfill({ json: [] });
  });
  await page.goto('/');
  await page.getByPlaceholder('Логин').fill('alice');
  await page.getByPlaceholder('Пароль').fill('abc');
  await page.getByRole('button', { name: 'Войти' }).click();
  await page.getByText('Борис').click({ button: 'right' });
  await page.getByRole('button', { name: 'В архив' }).click();
  await expect(page.getByText('Архив')).toBeVisible();
  await page.getByPlaceholder('Сообщения · @логин или ID').fill('Привет');
  await expect(page.getByText('Привет', { exact: true })).toBeVisible();
  await page.getByPlaceholder('Сообщения · @логин или ID').fill('');
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  await page.getByRole('button', { name: 'Добавить аккаунт' }).click();
  await page.getByPlaceholder('Логин').fill('bob');
  await page.getByPlaceholder('Пароль').fill('abc');
  await page.getByRole('button', { name: 'Войти' }).click();
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  await page.getByRole('button', { name: '@alice' }).click();
  await expect(page.getByPlaceholder('Сообщения · @логин или ID')).toBeVisible();
});
