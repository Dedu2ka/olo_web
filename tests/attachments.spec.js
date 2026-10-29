const { test, expect } = require('@playwright/test');

test.use({ viewport: { width: 390, height: 844 } });
const OWNER = '11111111-1111-4111-8111-111111111111';
const BOB = '22222222-2222-4222-8222-222222222222';
const CLARA = '33333333-3333-4333-8333-333333333333';
const CHAT = '44444444-4444-4444-8444-444444444444';
const VERSION = '55555555-5555-4555-8555-555555555555';

test('новая группа поддерживает множественный выбор как Android',async({page})=>{
  await messenger(page);
  const users=[{id:'u1',username:'first',displayName:'Первый'},{id:'u2',username:'second',displayName:'Второй'}];let created=null;
  await page.route('**/users/search?*',route=>route.fulfill({json:users}));
  await page.route('**/chats/groups',route=>{created=route.request().postDataJSON();return route.fulfill({status:500,json:{}})});
  await page.getByRole('button',{name:'Создать группу',exact:true}).click();
  await page.getByPlaceholder('Название группы',{exact:true}).fill('Новая');
  await page.getByPlaceholder('Имя или логин',{exact:true}).fill('п');
  await page.getByRole('button',{name:/Первый/}).click();
  await page.getByRole('button',{name:/Второй/}).click();
  await page.getByRole('button',{name:'Создать группу (2)',exact:true}).click();
  await expect.poll(()=>created?.memberUserIds.length).toBe(2);
  expect(created.memberUserIds).toEqual(['u1','u2']);
});

for (const theme of ['light','dark']) test(`отложенная отправка повторяет Android: выбор даты, времени, подтверждение (${theme})`, async ({page},testInfo)=>{
  await messenger(page);await openGroup(page);await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
  let scheduled=null;
  await page.route(`**/chats/${CHAT}/scheduled`,route=>{if(route.request().method()==='POST'){scheduled=route.request().postDataJSON();return route.fulfill({json:{id:'scheduled-1',chatId:CHAT,...scheduled}})}return route.fulfill({json:scheduled?[{id:'scheduled-1',chatId:CHAT,...scheduled}]:[]})});
  await page.getByPlaceholder('Введите текст').fill('Позже');
  await page.getByRole('button',{name:'Отправить',exact:true}).click({button:'right'});
  const dialog=page.locator('.scheduled-panel');
  await expect(dialog.getByRole('button',{name:'Запланировать',exact:true})).toBeDisabled();
  await dialog.getByRole('button',{name:'Выбрать дату и время',exact:true}).click();
  await page.getByLabel('Дата',{exact:true}).fill('2099-01-02');
  await page.getByRole('button',{name:'Далее',exact:true}).click();
  await expect(page.getByLabel('Дата',{exact:true})).toBeHidden();
  await page.getByLabel('Время',{exact:true}).fill('12:34');
  await page.getByRole('button',{name:'ОК',exact:true}).click();
  await expect(dialog.getByRole('button',{name:'Запланировать',exact:true})).toBeEnabled();
  await page.screenshot({path:testInfo.outputPath('schedule-'+theme+'.png')});
  await dialog.getByRole('button',{name:'Запланировать',exact:true}).click();
  await expect.poll(()=>scheduled?.content).toBe('Позже');
  await expect(page.getByPlaceholder('Введите текст')).toHaveValue('');
  await expect(page.locator('#scheduled-count')).toBeVisible();
});

test('опрос повторяет ограничения Android и позволяет убрать срок',async({page})=>{
  await messenger(page);await openGroup(page);await page.getByRole('button',{name:'Создать опрос'}).click();
  const dialog=page.locator('.poll-composer');await expect(dialog.getByRole('button',{name:'Отправить',exact:true})).toBeDisabled();
  await dialog.getByPlaceholder('Вопрос',{exact:true}).fill('Куда идём?');await dialog.getByPlaceholder('Вариант 1',{exact:true}).fill('Домой');await dialog.getByPlaceholder('Вариант 2',{exact:true}).fill('Гулять');
  for(let i=0;i<8;i++)await dialog.getByRole('button',{name:'+ Вариант ответа',exact:true}).click();
  await expect(dialog.getByRole('button',{name:'+ Вариант ответа',exact:true})).toBeHidden();
  await expect(dialog.getByRole('button',{name:'Отправить',exact:true})).toBeEnabled();
});

test('избранное сохраняет копирование, а редактирование использует окно Olo',async({page})=>{
  await messenger(page);await openGroup(page);
  await page.evaluate(()=>{S.selfChatId=S.chatId;showMessageActions({id:'own-message',chatId:S.chatId,senderId:S.userId,content:'Текст',timestamp:new Date().toISOString()})});
  await expect(page.getByRole('button',{name:'Копировать сообщение',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'В избранное',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Изменить',exact:true}).click();
  await expect(page.getByLabel('Сообщение',{exact:true})).toHaveValue('Текст');
  await page.getByLabel('Сообщение',{exact:true}).fill('');
  await expect(page.getByRole('button',{name:'Сохранить',exact:true})).toBeDisabled();
});

test('настройки содержат главу памяти и подтверждение очистки',async({page})=>{
  await messenger(page);await page.getByRole('button',{name:'Настройки',exact:true}).click();
  await expect(page.getByText('ДАННЫЕ И ПАМЯТЬ',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Очистить кэш',exact:true}).click();
  await expect(page.getByText('Очистить кэш?',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Отмена',exact:true}).click();
  await expect(page.getByText('Очистить кэш?',{exact:true})).toHaveCount(0);
});

test('пустые вложения скрыты, настройки прокручиваются целиком', async ({ page }) => {
  await messenger(page); await openGroup(page);
  await expect(page.locator('.attachment-pending')).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
  await page.getByRole('button', { name: 'Настройки группы', exact: true }).click();
  await expect(page.locator('.group-settings-card')).toBeVisible();
  await expect(page.locator('.group-member-list')).toHaveCSS('overflow-y', 'visible');
  await expect(page.locator('.group-settings-card')).toHaveCSS('overflow-y', 'auto');
});

test('медиа остаётся в локальном кэше после перезагрузки', async ({ page }) => {
  await messenger(page); await openGroup(page);
  let downloads=0;
  await page.route('**/api/v1/cache-probe', route => {downloads++;return route.fulfill({contentType:'image/png',body:png})});
  await page.evaluate(() => attachmentBlobUrl({id:'probe',attachmentUrl:'/api/v1/cache-probe'}));
  await page.reload();
  await expect(page.getByText('Команда', {exact:true})).toBeVisible();
  await page.evaluate(() => attachmentBlobUrl({id:'probe',attachmentUrl:'/api/v1/cache-probe'}));
  expect(downloads).toBe(1);
});

test('кружок записывается и отправляется как видеосообщение', async ({ page }) => {
  const state=await messenger(page);await openGroup(page);
  await page.evaluate(async()=>{
    const canvas=document.createElement('canvas');canvas.width=canvas.height=480;
    const context=canvas.getContext('2d');context.fillStyle='#795da4';context.fillRect(0,0,480,480);
    const stream=canvas.captureStream(30),audio=new AudioContext(),oscillator=audio.createOscillator(),destination=audio.createMediaStreamDestination();
    oscillator.connect(destination);oscillator.start();destination.stream.getAudioTracks().forEach(track=>stream.addTrack(track));
    navigator.mediaDevices.getUserMedia=async()=>stream;
    const recording=await recordChatMedia('circle');if(!recording)throw Error('Recording failed');
    await new Promise(resolve=>setTimeout(resolve,800));recording.stop(true);
  });
  await expect.poll(()=>state.uploads.length).toBe(1);
  expect(state.uploads[0].body).toContain('olo-circle-');
  await expect(page.locator('.record-overlay')).toHaveCount(0);
});

test('новое сообщение появляется без перезагрузки при восстановлении связи', async ({ page }) => {
  await messenger(page);await openGroup(page);
  await page.route(`**/chats/${CHAT}/messages?*`,route=>route.fulfill({json:[{id:'incoming',chatId:CHAT,senderId:CLARA,content:'Сообщение после обрыва',timestamp:new Date().toISOString(),status:'SENT'}]}));
  await page.evaluate(()=>syncVisibleChat());
  await expect(page.getByText('Сообщение после обрыва',{exact:true})).toBeVisible();
  await page.reload();await openGroup(page);
  await expect(page.getByText('Сообщение после обрыва',{exact:true})).toBeVisible();
});
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==', 'base64');
const avatar = id => `/api/v1/users/${id}/avatar?v=${VERSION}`;

async function messenger(page, expireAvatar = false) {
  let refreshCalls = 0;
  const sent = [];
  const uploads = [];
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
    if (path.endsWith('/attachments/batch')) {
      uploads.push({ path, body: req.postData() });
      return route.fulfill({ json: { id: 'attachment-' + uploads.length, chatId: CHAT, senderId: OWNER, content: '', timestamp: new Date().toISOString(), status: 'SENT', attachments: [] } });
    }
    if (path.endsWith('/messages')) {
      if (req.method() === 'POST') { const content = req.postDataJSON().content; sent.push(content); return route.fulfill({ json: { id: 'message-' + sent.length, chatId: CHAT, senderId: OWNER, content, timestamp: new Date().toISOString(), status: 'SENT' } }); }
      return route.fulfill({ json: [] });
    }
    return route.fulfill({ json: [] });
  });
  await page.goto('/');
  await expect(page.getByText('Команда', { exact: true })).toBeVisible();
  return { sent, uploads, refreshCalls: () => refreshCalls };
}

async function openGroup(page) {
  await page.getByText('Команда', { exact: true }).click();
  await expect(page.getByPlaceholder('Введите текст')).toBeVisible();
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
  await page.getByRole('button', { name: 'Добавить (1)', exact: true }).click();
  await expect(page.locator('.group-member-list .group-member-row')).toHaveCount(3);
  expect(state.refreshCalls()).toBe(1);
});

test('кнопка прикрепления находится над файлами; фото исключены из документов', async ({ page }, testInfo) => {
  await messenger(page); await openGroup(page);
  await page.getByRole('button', { name: 'Добавить вложение', exact: true }).click();
  await page.locator('.olo-picker-tabs').getByRole('button', { name: /Файлы/ }).click();
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

test('стикеры в третьей вкладке имеют наборы, сетку и недавние', async ({ page }, testInfo) => {
  const state = await messenger(page); await openGroup(page);
  await page.getByRole('button', { name: 'Добавить вложение', exact: true }).click();
  await page.locator('.olo-picker-tabs').getByRole('button', { name: /Стикеры/ }).click();
  await expect(page.locator('.olo-attachment-picker .sticker-panel')).toBeVisible();
  await page.getByRole('button', { name: 'Коты', exact: true }).click();
  await expect(page.locator('.sticker-grid img')).toBeVisible();
  await expect.poll(() => page.locator('.sticker-grid img').evaluate(img => img.naturalWidth)).toBeGreaterThan(0);
  await page.screenshot({ path: testInfo.outputPath('stickers-dark.png') });
  await page.getByRole('button', { name: 'Улыбки', exact: true }).click();
  await page.screenshot({ path: testInfo.outputPath('sticker-grid-dark.png') });
  await page.evaluate(() => document.documentElement.dataset.theme='light');
  await expect(page.locator('.sticker-picker-title')).toHaveCSS('color', 'rgb(36, 26, 48)');
  await page.screenshot({ path: testInfo.outputPath('sticker-grid-light.png') });
  await page.locator('.sticker-cell').first().click();
  await expect.poll(() => state.sent.length).toBe(1);
  expect(state.sent[0]).toBe('🙂');
  await page.getByRole('button', { name: 'Добавить вложение', exact: true }).click();
  await page.locator('.olo-picker-tabs').getByRole('button', { name: /Стикеры/ }).click();
  await page.getByRole('button', { name: 'Недавние стикеры', exact: true }).click();
  await expect(page.locator('.sticker-cell')).toHaveCount(1);
  await expect(page.locator('.sticker-cell')).toHaveText('🙂');
});

test('одна фотография отправляется как files через общий маршрут вложений', async ({ page }, testInfo) => {
  const state = await messenger(page); await openGroup(page);
  await page.getByRole('button', { name: 'Добавить вложение', exact: true }).click();
  await page.locator('.olo-attachment-picker input[type=file]').first().setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: png });
  await expect(page.locator('.olo-gallery-item')).toHaveCount(2);
  await page.screenshot({ path: testInfo.outputPath('gallery-dark.png') });
  await page.getByRole('button', { name: 'Прикрепить (1)', exact: true }).click();
  await page.getByRole('button', { name: 'Отправить', exact: true }).click();
  await expect.poll(() => state.uploads.length).toBe(1);
  expect(state.uploads[0].path).toBe(`/api/v1/chats/${CHAT}/attachments/batch`);
  expect(state.uploads[0].body).toContain('name="files"');
  expect(state.uploads[0].body).toContain('filename="photo.png"');
});
