// End-to-end, a poll continued in the chat (openspec: poll-activity, Sondage continué dans le chat), every kind: the
// activity changes while it is open, it goes on as a chat message, answered there, closed, its results there.
// Choices with pictures (image, sticker, GIF), free answers (secret results), gradient 1D (2 ends), gradient 2D
// (3 and 8 corners), closed when everyone answered or by its host. Run after run.mjs (`pnpm e2e`), on the same port.
import { SERVER, admin, check, failures, player, shot, startServer, stopServer, until } from './lib.mjs';

await startServer();
const key = admin('rooms:create', '--name', 'Sondages (e2e)').match(/[A-Z0-9]{4}-[A-Z0-9]{4}/)[0];

// no GIF key in the tests: the host's GIF comes from his recent ones (as after sending it), served here (a picture)
const GIF = { id: 'e2e-gif', provider: 'KLIPY', url: 'https://static.klipy.com/e2e/lapin.gif', w: 160, h: 120, title: 'Un lapin' };
let gifBytes = null;

async function enter(p, name) {
  await p.ctx.route('https://static.klipy.com/**', r => r.fulfill({ contentType: 'image/png', body: gifBytes }));
  const { page, frame } = await p.open();
  await frame.locator('.room-card.welcome').waitFor();
  await frame.getByRole('button', { name: 'Continuer avec ce code' }).click();
  await frame.getByRole('button', { name: 'Choisir un salon' }).click();
  await frame.getByRole('button', { name: '+ Ajouter' }).click();
  await frame.locator('[name="roomKey"]').fill(key);
  await frame.locator('.modal').getByRole('button', { name: 'Ajouter' }).click();
  await frame.locator('.room-row', { hasText: key }).getByRole('button', { name: 'Rejoindre' }).click();
  await frame.locator('.chat-stage .chat').waitFor();
  await frame.locator('.backdrop').click({ force: true }).catch(() => {});
  await frame.locator('.bar .avatar').click();
  await until(async () => (await frame.locator('.drawer-right [name="pseudo"]').inputValue()) !== '');
  await frame.locator('.drawer-right [name="pseudo"]').fill(name);
  await frame.locator('.drawer-right [name="pseudo"]').press('Enter');
  await frame.locator('.drawer-right [aria-label="Fermer"]').click();
  return { page, frame };
}

const H = await player('light'), G = await player('dark');
await H.sw.evaluate(([s, g]) => chrome.storage.local.set({ 'slp-device': { server: s, gifRecent: [g] } }), [SERVER, GIF]);
const h = await enter(H, 'Hugo');   // the first in the room: its host, who writes the polls
const g = await enter(G, 'Léa');
check(await until(async () => (await h.frame.locator('.person').count()) === 2), 'two players in the room');

const say = async (frame, text) => { await frame.locator('[name="text"]').fill(text); await frame.locator('[name="text"]').press('Enter'); };
const png = async (frame, w, h, color) => Buffer.from(await frame.evaluate(([w, h, color]) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'); x.fillStyle = color; x.fillRect(0, 0, w, h); x.fillStyle = '#fff'; x.beginPath(); x.arc(w / 2, h / 2, Math.min(w, h) / 3, 0, 7); x.fill();
  return c.toDataURL('image/png').split(',')[1];
}, [w, h, color]), 'base64');

gifBytes = await png(h.frame, 160, 120, '#ffd166');

// a sticker in the room's library (made from the chat), for a choice
await h.frame.locator('[aria-label="Fichier, sticker, GIF, emoji"]').click();
const [chooser] = await Promise.all([h.page.waitForEvent('filechooser'), h.frame.getByRole('menuitem', { name: 'Fichier' }).click()]);
await chooser.setFiles({ name: 'Pouce.png', mimeType: 'image/png', buffer: await png(h.frame, 300, 300, '#06d6a0') });
await h.frame.locator('.chat-panel.upload .upload-choice').waitFor();
await h.frame.getByRole('button', { name: /^Sticker/ }).click();
await until(async () => (await h.frame.locator('.attach-bar img').count()) === 1, 8000);
await h.frame.locator('[name="text"]').press('Enter');
check(await until(async () => (await g.frame.locator('.msg img.msg-sticker').count()) === 1, 8000), 'a sticker in the room\'s library');

/** The host writes a poll in the Sondage (`build` fills it; results secret or not), publishes it, then changes the
 *  activity: it goes on in the chat. One change of activity each way (another one would reset the poll being written). */
async function pollToChat(question, kind, build, secret = false) {
  await say(h.frame, '/activity sondage');
  await h.frame.locator('[data-poll="question"]').waitFor();
  await h.frame.locator('.bar .avatar').click();
  await h.frame.locator('.drawer-right .tab', { hasText: 'Partie' }).click();
  const box = h.frame.getByLabel('Résultats secrets');
  if ((await box.isChecked()) !== secret) await box.click();
  await until(async () => (await box.isChecked()) === secret);
  await h.frame.locator('.drawer-right [aria-label="Fermer"]').click();
  await h.frame.locator('[data-poll="question"]').fill(question);
  await h.frame.locator(`[data-action="poll-kind"][data-v="${kind}"]`).click();
  await build?.();
  await h.frame.getByRole('button', { name: 'Publier le sondage' }).click();
  await until(async () => (await g.frame.locator('.stage-head .topic', { hasText: question }).count()) === 1, 8000);
  await say(h.frame, '/activity chat');
  const card = f => f.locator('.chat-stage .chat-poll', { hasText: question });   // the chat on the stage (it was in the drawer during the Sondage)
  check(await until(async () => (await card(g.frame).locator('.vote-left').count()) === 1 && (await card(h.frame).count()) === 1, 8000), `${question} — continued in the chat, open, its time left shown`);
  return { gc: card(g.frame), hc: card(h.frame) };
}
async function choices(labels) {
  for (let i = 2; i < labels.length; i++) await h.frame.locator('[data-action="poll-add"]').click();
  for (const [i, l] of labels.entries()) await h.frame.locator(`[data-poll="choice"][data-i="${i}"]`).fill(l);
}
/** Clicks a gradient at a point of its own coordinates (corners(): slider 0..1, polygon of radius 1). */
async function clickGradient(card, n, p) {
  const svg = card.locator('[data-gradient]');
  const at = n === 2 ? [18 + 264 * p[0], 20] : [150 + 64 * p[0], 98 + 64 * p[1]];
  const position = await svg.evaluate((el, [x, y]) => {
    const q = new DOMPoint(x, y).matrixTransform(el.getScreenCTM()), r = el.getBoundingClientRect();
    return { x: q.x - r.left, y: q.y - r.top };
  }, at);
  await svg.click({ position });
}
const closed = card => until(async () => (await card.locator('.vote-count').textContent()).includes('Terminé'), 8000);
const loaded = card => card.locator('.poll-results img').evaluateAll(xs => xs.length > 0 && xs.every(i => i.complete && i.naturalWidth > 0));

// ---- 1. choices with pictures: an image, a sticker, a GIF, one without; nominative results
{
  const { gc, hc } = await pollToChat('Ton animal ?', 'choices', async () => {
    await choices(['Chien', 'Chat', 'Lapin', 'Poisson']);
    const plus = i => h.frame.locator(`.plus-wrap [data-action="choice-plus"][data-i="${i}"]`);
    await plus(0).click();
    const [file] = await Promise.all([h.page.waitForEvent('filechooser'), h.frame.locator('[data-action="choice-file"][data-i="0"]').click()]);
    await file.setFiles({ name: 'chien.png', mimeType: 'image/png', buffer: await png(h.frame, 500, 400, '#2a6f97') });
    await until(async () => (await h.frame.locator('.choice-thumb img').count()) === 1, 8000);
    await plus(1).click();
    await h.frame.locator('[data-action="choice-sticker"][data-i="1"]').click();
    await h.frame.locator('[data-action="choice-sticker-pick"][data-i="1"]').first().click();
    await plus(2).click();
    await h.frame.locator('[data-action="choice-gif"][data-i="2"]').click();
    await h.frame.locator('.gif-pop .gif-item .gif-send').first().click();
    check(await until(async () => (await h.frame.locator('.choice-thumb img').count()) === 3), 'choices: an image, a sticker and a GIF on three choices');
  });
  check(await gc.locator('.poll-option').count() === 4 && await gc.locator('.poll-option .option-pic img').count() === 3, 'choices in the chat: the 4 choices, 3 with their picture');
  const shown = () => gc.locator('.poll-option .option-pic img').evaluateAll(xs => xs.map(i => `${i.complete && i.naturalWidth > 0 ? 'ok' : 'NOT LOADED'} ${i.src.slice(0, 60)}`));
  check(await until(async () => (await shown()).every(x => x.startsWith('ok')), 8000), `choices in the chat: Léa sees the 3 pictures (${(await shown()).join(' | ')})`);
  await gc.locator('.poll-option .option-pic img').evaluateAll(xs => xs.forEach(i => { i.__seen = true; }));
  await gc.locator('.poll-option', { hasText: 'Chat' }).click();
  check(await until(async () => (await gc.locator('.poll-option.on').textContent()).includes('Chat')) && await gc.locator('.poll-option .option-pic img').evaluateAll(xs => xs.length === 3 && xs.every(i => i.__seen)),
    'choices: a click on a choice keeps the pictures as they are (no blink)');
  await shot(g.page, '40a-chat-poll-choices');
  await gc.getByRole('button', { name: 'Valider ma réponse' }).click();
  check(await closed(hc), 'choices: closed when everyone (but its host) answered');
  check((await hc.locator('.bar-row.win').textContent()).includes('Chat') && await hc.locator('.bar-row.win').getAttribute('data-names') === 'Léa', 'choices: « Chat » first, hovering it says who (Léa)');
  check(await hc.locator('.bar-pic img').count() === 3 && await loaded(hc) && await until(() => loaded(gc)), 'choices: the results keep the 3 pictures, loaded for both (image, sticker, GIF)');
  await shot(h.page, '40b-chat-poll-choices-results');
}

// ---- 2. free answers, secret results: the host answers too; « Pizza ! » and « pizza » are the same answer
{
  const { gc, hc } = await pollToChat('On mange quoi ?', 'free', null, true);
  await hc.locator('[data-poll="free"]').fill('Pizza !');
  await hc.getByRole('button', { name: 'Valider ma réponse' }).click();
  check(await until(async () => (await hc.locator('.chat-poll-done').count()) === 1 && (await gc.locator('.vote-count').textContent()).startsWith('1 réponse')), 'free: the host answers too; the others see 1 answer, not what');
  await gc.locator('[data-poll="free"]').fill('pizza');
  await gc.locator('[data-poll="free"]').press('Enter');
  check(await closed(gc), 'free: Enter answers; closed when everyone answered');
  check(await gc.locator('.answer-card').count() === 1 && (await gc.locator('.answer-card.win').textContent()).includes('×2'), 'free: « Pizza ! » and « pizza » grouped (×2)');
  check(await gc.locator('[data-names]').count() === 0 && (await gc.locator('.vote-count').textContent()).includes('résultats secrets'), 'free: secret — nobody\'s name in the results');
  await shot(g.page, '41-chat-poll-free-secret');
}

// ---- 3. gradient 1D: a slider between two ends
{
  const { gc, hc } = await pollToChat('Plutôt mer ou montagne ?', 'gradient', () => choices(['Mer', 'Montagne']));
  check(await gc.locator('svg.gradient.g1[data-gradient]').count() === 1, 'gradient 1D: the slider, clickable');
  await clickGradient(gc, 2, [0.8, 0]);
  check(await gc.locator('.g-dot.is-pending').count() === 1, 'gradient 1D: my point placed before validating');
  await gc.getByRole('button', { name: 'Valider ma réponse' }).click();
  check(await closed(hc), 'gradient 1D: closed when everyone answered');
  const temps = await hc.locator('.poll-temps li').allTextContents();
  check(temps.length === 2 && (await hc.locator('.poll-temps li.win').textContent()).includes('Montagne'), `gradient 1D: two temperatures, « Montagne » the hottest (${temps.map(t => t.replace(/\s+/g, ' ').trim()).join(' / ')})`);
  check(await hc.locator('.poll-heat .g-dot[data-names="Léa"]').count() === 1, 'gradient 1D: Léa\'s point, named');
  await shot(h.page, '42-chat-poll-gradient-1d');
}

// ---- 4. gradient 2D, 3 corners: the host answers, then ends it before Léa
{
  const { gc, hc } = await pollToChat('Ton genre de film ?', 'gradient', () => choices(['Action', 'Comédie', 'Drame']));
  check(await hc.locator('svg.gradient.g2 .g-corner').count() === 3, 'gradient 2D: a triangle (3 corners)');
  await clickGradient(hc, 3, [0, -0.7]);
  await hc.getByRole('button', { name: 'Valider ma réponse' }).click();
  await until(async () => (await hc.locator('.chat-poll-done').count()) === 1);
  check(await gc.getByRole('button', { name: 'Terminer le sondage' }).count() === 0, 'gradient 2D: only its host can end it');
  await hc.getByRole('button', { name: 'Terminer le sondage' }).click();
  check(await closed(gc) && (await gc.locator('.vote-count').textContent()).includes('1 réponse'), 'gradient 2D: ended by its host, 1 answer');
  check(await gc.getByRole('button', { name: 'Valider ma réponse' }).count() === 0, 'gradient 2D: closed, nothing to answer any more');
  check(await gc.locator('.poll-temps li').count() === 3 && (await gc.locator('.poll-temps li.win').textContent()).includes('Action'), 'gradient 2D: 3 temperatures, « Action » the hottest');
  check(await gc.locator('.poll-heat svg').evaluate(svg => { const img = svg.querySelector('image'), id = img?.getAttribute('clip-path')?.match(/#([^)]+)/)?.[1];
    const clip = id && document.getElementById(id); return !!clip && svg.contains(clip) || clip?.querySelector('polygon')?.getAttribute('points') === svg.querySelector('.g-outline')?.getAttribute('points'); }),
    'gradient 2D: the heatmap clipped by its own triangle (another poll\'s slider above it)');
  check(await until(async () => (await h.frame.locator('.msg', { hasText: 'Ton genre de film ? » terminé : 1 réponse' }).count()) === 1), 'gradient 2D: the chat says it ended');
  await shot(g.page, '43-chat-poll-gradient-2d');
}

// ---- 5. gradient 2D, 8 corners (the most)
{
  const labels = ['Nord', 'Nord-est', 'Est', 'Sud-est', 'Sud', 'Sud-ouest', 'Ouest', 'Nord-ouest'];
  const { gc, hc } = await pollToChat('Où partir ?', 'gradient', () => choices(labels));
  check(await gc.locator('svg.gradient.g2 .g-corner').count() === 8, 'gradient 2D: an octagon (8 corners)');
  await clickGradient(gc, 8, [0.62, 0]);   // towards « Est »
  await gc.getByRole('button', { name: 'Valider ma réponse' }).click();
  check(await closed(hc), 'gradient 8 corners: closed when everyone answered');
  check(await hc.locator('.poll-temps li').count() === 8 && (await hc.locator('.poll-temps li.win').textContent()).includes('Est'), 'gradient 8 corners: 8 temperatures, « Est » the hottest');
  await shot(h.page, '44-chat-poll-gradient-8');
}

await H.close();
await G.close();
await stopServer();
console.log(failures() ? `\n${failures()} échec(s).` : '\nTout est bon.');
process.exit(failures() ? 1 : 0);
