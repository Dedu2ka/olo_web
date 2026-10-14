const { test, expect } = require('@playwright/test');

test.use({ viewport: { width: 390, height: 844 } });
const OWNER = '11111111-1111-4111-8111-111111111111';
const BOB = '22222222-2222-4222-8222-222222222222';
const CLARA = '33333333-3333-4333-8333-333333333333';
const CHAT = '44444444-4444-4444-8444-444444444444';
const VERSION = '55555555-5555-4555-8555-555555555555';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==', 'base64');
const avatar = id => `/api/v1/users/${id}/avatar?v=${VERSION}`;

async function messenger(page, expireAvatar = false) {
  let refreshCalls = 0;
  const sent = [];
  let members = [
    { userId: OWNER, username: 'alice', displayName: 'Алиса', avatarUrl: avatar(OWNER), role: 'OWNER' },
    { userId: BOB, username: 'bob', displayName: 'Борис', avatarUrl: avatar(BOB), role: 'MEMBER' }
  ];
  const group = () => ({ id: CHAT, type: 'GROUP', name: 'Команда', partnerName: 'Команда', avatarUrl: `/api/v1/chats/${CHAT}/group/avatar?v=${VERSION}`, members, memberCount: members.length });
  const packs = [
    { id: 'smiles', name: 'Улыбки', builtIn: true, added: true, owner: false, stickers: ['🙂','😀','😄','😅','😎','😍','🥲','🙃','😉','😇','😊','😋','😴','🤔','🤩','😳','😱','😭','😤','🥳'].map((emoji,index) => ({ id: 'smile-'+index, emoji, url: '', fileName: '' })) },
    { id: 'cats', name: 'Коты', builtIn: false, added: true, owner: false, stickers: [{ id: 'cat-1', url: '/api/v1/stickers/cat-1/content', contentType: 'image/png', fileName: 'cat.png' }] }
  ];
  await page.addInitScript(({ owner }) => localStorage.setItem('olo.session', JSON.stringify({ token: 'access-1', refreshToken: 'refresh-1', userId: owner, username: 'alice' })), { owner: OWNER });
  await page.route('https://olo-chat.duckdns.org/api/v1/**', async route => {
    const req = route.request(), path = new URL(req.url()).pathname;
    if (path.endsWith('/ws-ticket')) return route.fulfill({ status: 503, json: {} });
    if (path.endsWith('/auth/refresh')) { refreshCalls++; return route.fulfill({ json: { token: 'access-2', refreshToken: 'refresh-2', userId: OWNER, username: 'alice' } }); }
    if (path.endsWith('/avatar') || path.endsWith('/stickers/cat-1/content')) {
      if (expireAvatar && refreshCalls === 0) return route.fulfill({ status: 401, json: {} });
      if (expireAvatar) expect(req.headers().authorization).toBe('Bearer access-2');
      return route.fulfill({ contentType: 'image/png', body: png });
    }
    if (path === '/api/v1/chats') return route.fulfill({ json: [group()] });
    if (path.endsWith('/users/search')) return route.fulfill({ json: [{ id: CLARA, username: 'clara', displayName: 'Клара', avatarUrl: avatar(CLARA) }] });
    if (path.endsWith('/members')) {
      if (req.method() === 'POST') members.push({ userId: req.postDataJSON().userId, username: 'clara', displayName: 'Клара', avatarUrl: avatar(CLARA), role: 'MEMBER' });
      return route.fulfill({ status: req.method() === 'POST' ? 204 : 200, ...(req.method() === 'POST' ? { body: '' } : { json: members }) });
    }
    if (path.endsWith('/stickers/packs')) return route.fulfill({ json: packs });
    if (path.endsWith('/messages')) {
      if (req.method() === 'POST') { const content = req.postDataJSON().content; sent.push(content); return route.fulfill({ json: { id: 'message-' + sent.length, chatId: CHAT, senderId: OWNER, content, timestamp: new Date().toISOString(), status: 'SENT' } }); }
      return route.fulfill({ json: [] });
    }
    return route.fulfill({ json: [] });
  });
  await page.goto('/');
  await expect(page.getByText('Команда', { exact: true })).toBeVisible();
  return { sent, refreshCalls: () => refreshCalls };
}

async function openGroup(page) {
  await page.getByText('Команда', { exact: true }).click();
  await expect(page.getByPlaceholder('Сообщение')).toBeVisible();
}

test('аватары группы и участников переживают обновление сессии; профиль не открывает настройки', async ({ page }) => {
  const state = await messenger(page, true);
  await expect(page.locator('#list .row').filter({ hasText: 'Команда' }).locator('img')).toBeVisible();
  await openGroup(page);
  await page.locator('.chat-header-person b').click();
  await expect(page.locator('.profile-card .group-member-row img')).toHaveCount(2);
  await expect.poll(() => page.locator('.profile-card .group-member-row img').evaluateAll(imgs => imgs.every(img => img.complete && img.naturalWidth > 0))).toBe(true);
  await expect(page.locator('.profile-card').getByRole('button', { name: 'Настройки группы' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Закрыть', exact: true }).click();
  await page.getByRole('button', { name: 'Настройки группы', exact: true }).click();
  await expect(page.locator('.group-member-list img')).toHaveCount(2);
  await page.getByRole('button', { name: 'Добавить участника', exact: true }).click();
  await page.getByPlaceholder('Имя или логин').fill('Кла');
  const result = page.locator('.group-user-option').filter({ hasText: 'Клара' });
  await expect(result.locator('img')).toBeVisible();
  await result.click();
  await expect(page.locator('.group-member-list .group-member-row')).toHaveCount(3);
  expect(state.refreshCalls()).toBe(1);
});

test('кнопка прикрепления находится над файлами; фото исключены из документов', async ({ page }, testInfo) => {
  await messenger(page); await openGroup(page);
  await page.getByRole('button', { name: 'Добавить вложение', exact: true }).click();
  await page.getByRole('button', { name: 'Файлы', exact: true }).click();
  await page.locator('.olo-attachment-picker input[type=file]').nth(1).setInputFiles([
    { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('Document') },
    { name: 'photo.png', mimeType: 'image/png', buffer: png },
    { name: 'audio.mp3', mimeType: 'audio/mpeg', buffer: Buffer.from('audio') }
  ]);
  await expect(page.locator('.olo-document-row')).toHaveCount(2);
  await expect(page.locator('.olo-document-row').filter({ hasText: 'photo.png' })).toHaveCount(0);
  const attach = page.getByRole('button', { name: 'Прикрепить (2)', exact: true });
  await expect(attach).toBeEnabled();
  expect((await attach.boundingBox()).y).toBeLessThan((await page.locator('.olo-document-row').first().boundingBox()).y);
  await page.screenshot({ path: testInfo.outputPath('files-dark.png') });
  await attach.click();
  await expect(page.getByText('2 вложений прикреплено', { exact: true })).toBeVisible();
});

test('стикеры имеют отдельную панель с наборами, сеткой и недавними', async ({ page }, testInfo) => {
  const state = await messenger(page); await openGroup(page);
  await page.getByRole('button', { name: 'Стикеры', exact: true }).click();
  await expect(page.locator('.sticker-panel')).toBeVisible();
  await expect(page.locator('.olo-attachment-picker')).toHaveCount(0);
  await page.getByRole('button', { name: 'Коты', exact: true }).click();
  await expect(page.locator('.sticker-grid img')).toBeVisible();
  await expect.poll(() => page.locator('.sticker-grid img').evaluate(img => img.naturalWidth)).toBeGreaterThan(0);
  await page.screenshot({ path: testInfo.outputPath('stickers-dark.png') });
  await page.getByRole('button', { name: 'Улыбки', exact: true }).click();
  await page.screenshot({ path: testInfo.outputPath('sticker-grid-dark.png') });
  await page.evaluate(() => document.documentElement.dataset.theme='light');
  await expect(page.locator('.sticker-picker-title')).toHaveCSS('color', 'rgb(33, 30, 41)');
  await page.screenshot({ path: testInfo.outputPath('sticker-grid-light.png') });
  await page.locator('.sticker-cell').first().click();
  await expect.poll(() => state.sent.length).toBe(1);
  expect(state.sent[0]).toBe('🙂');
  await page.getByRole('button', { name: 'Стикеры', exact: true }).click();
  await page.getByRole('button', { name: 'Недавние стикеры', exact: true }).click();
  await expect(page.locator('.sticker-cell')).toHaveCount(1);
  await expect(page.locator('.sticker-cell')).toHaveText('🙂');
});
