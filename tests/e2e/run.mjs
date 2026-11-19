// End-to-end: two players with the real extension, the real server and its services (`pnpm services:up`, `pnpm build`).
// Jalon 2: first launch, a room made by the admin, text chat (link, reply, reaction), presence, a server restart.
import { admin, check, failures, player, prepareShots, shot, startServer, stopServer, until } from './lib.mjs';

prepareShots();
await startServer();
const key = admin('rooms:create', '--name', 'Les pays (e2e)').match(/[A-Z0-9]{4}-[A-Z0-9]{4}/)[0];

async function enter(p, name) {
  const { page, frame } = await p.open();
  const welcome = frame.locator('.room-card.welcome');
  await welcome.waitFor();
  const code = (await welcome.locator('.code-text').textContent()).trim();
  check(/^[A-HJKMNP-Z2-9]{4}(-[A-HJKMNP-Z2-9]{4}){3}$/.test(code), `${name}: the first launch shows a code drawn at random (${code})`);
  if (name === 'A') await shot(page, '01-welcome');
  await welcome.getByRole('button', { name: 'Continuer avec ce code' }).click();
  await frame.getByText('Aucun salon').waitFor();
  check(true, `${name}: no room yet: « Aucun salon »`);
  await frame.getByRole('button', { name: 'Choisir un salon' }).click();
  await frame.getByRole('button', { name: '+ Ajouter' }).click();
  await frame.locator('[name="roomKey"]').fill(key.toLowerCase().replace('-', ' '));
  await frame.locator('.modal').getByRole('button', { name: 'Ajouter' }).click();
  await frame.locator('.room-row', { hasText: key }).getByRole('button', { name: 'Rejoindre' }).click();
  await frame.locator('.chat-stage .chat').waitFor();
  await frame.locator('.backdrop').click({ force: true }).catch(() => {});
  // a pseudo, so the chat says who is who
  await frame.locator('.bar .avatar').click();
  await frame.locator('.drawer-right [name="pseudo"]').fill(name === 'A' ? 'Léa' : 'Hugo');
  await frame.locator('.drawer-right [name="pseudo"]').press('Enter');
  await frame.locator('.drawer-right [aria-label="Fermer"]').click();
  return { page, frame, code };
}

const A = await player('light'), B = await player('dark');
const a = await enter(A, 'A');
check(await a.frame.getByText('Début de la conversation').count() === 1, 'A: a new room: « Début de la conversation »');
check(await a.frame.locator('.person', { hasText: 'hôte' }).count() === 1, 'A: the first player hosts the room');
const b = await enter(B, 'B');
check(await until(async () => (await a.frame.locator('.person').count()) === 2), 'A sees B in the players');
check(await until(async () => (await a.frame.locator('.person', { hasText: 'Hugo' }).count()) === 1), 'A sees B\'s pseudo as soon as B changes it');

await a.frame.locator('[name="text"]').fill('salut, les règles : example.com/regles :rire:');
await a.frame.locator('[name="text"]').press('Enter');
const got = b.frame.locator('.msg', { hasText: 'salut, les règles' });
check(await until(async () => (await got.count()) === 1), 'B receives A\'s message');
check(await got.locator('a.msg-link[href="https://example.com/regles"]').count() === 1, 'the address is a link');
check((await got.textContent()).includes('😂'), 'the :rire: code became its emoji');

await got.locator('.msg-body').hover();
await got.locator('.react-reply').click();
await b.frame.locator('[name="text"]').fill('merci !');
await b.frame.locator('[name="text"]').press('Enter');
const reply = a.frame.locator('.msg.is-reply', { hasText: 'merci' });
check(await until(async () => (await reply.count()) === 1) && (await reply.locator('.reply-ref').textContent()).includes('salut'), 'A sees B\'s reply with its quote');

await a.frame.locator('.msg', { hasText: 'merci' }).locator('.msg-body').dblclick();
check(await until(async () => (await b.frame.locator('.msg', { hasText: 'merci' }).locator('.reaction').count()) === 1), 'a double click reacts; B sees the reaction');
await shot(a.page, '02-chat-light');
await shot(b.page, '03-chat-dark');

// ---- jalon 3: pictures (image, sticker, custom emoji), GIF window without a key, profile photo
const png = async (frame, w, h, color) => Buffer.from(await frame.evaluate(([w, h, color]) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'); x.fillStyle = color; x.fillRect(0, 0, w, h); x.fillStyle = '#fff'; x.beginPath(); x.arc(w / 2, h / 2, Math.min(w, h) / 3, 0, 7); x.fill();
  return c.toDataURL('image/png').split(',')[1];
}, [w, h, color]), 'base64');
const chooseFile = async (frame, name, buffer) => {
  await frame.locator('[aria-label="Fichier, sticker, GIF, emoji"]').click();
  const [chooser] = await Promise.all([frame.page().waitForEvent('filechooser'), frame.getByRole('menuitem', { name: 'Fichier' }).click()]);
  await chooser.setFiles({ name, mimeType: 'image/png', buffer });
  await frame.locator('.chat-panel.upload .upload-choice').waitFor();
};
await chooseFile(a.frame, 'paysage.png', await png(a.frame, 1400, 900, '#2a6f97'));
await a.frame.getByRole('button', { name: /^Image/ }).click();
const pic = b.frame.locator('.msg img.msg-image');
check(await until(async () => (await pic.count()) === 1, 8000), 'image: sent by A, shown to B');
check(await pic.evaluate(i => i.complete && i.naturalWidth === 1400 && i.src.includes('/media/')), 'image: served by our server (/media), 1400 px kept under 1600');

await chooseFile(a.frame, 'Bravo Léa.png', await png(a.frame, 400, 400, '#ef476f'));
await a.frame.getByRole('button', { name: /^Sticker/ }).click();
check(await until(async () => (await b.frame.locator('.msg img.msg-sticker').count()) === 1, 8000), 'sticker: sent, shown to B');
await b.frame.locator('[aria-label="Fichier, sticker, GIF, emoji"]').click();
await b.frame.getByRole('menuitem', { name: 'Sticker' }).click();
check(await until(async () => (await b.frame.locator('.sticker-grid .sticker-item').count()) === 1), 'sticker: in the room\'s library, for B too');
await b.frame.locator('.chat-panel.stickers [aria-label="Fermer"]').click();

await chooseFile(a.frame, 'Super Chat.png', await png(a.frame, 300, 300, '#06d6a0'));
await a.frame.getByRole('button', { name: /^Emoji/ }).click();
check(await a.frame.locator('[name="emojiName"]').inputValue() === 'super_chat', 'emoji: its name suggested from the file (super_chat)');
await a.frame.getByRole('button', { name: 'Ajouter aux emoji' }).click();
check(await until(async () => (await b.frame.locator('.msg.sys', { hasText: "a ajouté l'emoji" }).locator('img.emoji-custom').count()) === 1, 8000), 'emoji: added for the room, said in the chat');
await b.frame.locator('[name="text"]').fill('trop bien :super_chat:');
await b.frame.locator('[name="text"]').press('Enter');
check(await until(async () => (await a.frame.locator('.msg', { hasText: 'trop bien' }).locator('img.emoji-custom').count()) === 1, 8000), 'emoji: :super_chat: shown as its picture');

await a.frame.locator('[aria-label="Fichier, sticker, GIF, emoji"]').click();
await a.frame.getByRole('menuitem', { name: 'GIF' }).click();
check(await until(async () => (await a.frame.locator('.gif-pop .gif-status').textContent()).includes('aucune clé')), 'GIF: without a key, the window says why');
await a.page.keyboard.press('Escape');

await a.frame.locator('.bar .avatar').click();
const [ph] = await Promise.all([a.page.waitForEvent('filechooser'), a.frame.getByRole('button', { name: 'Ajouter une photo' }).click()]);
await ph.setFiles({ name: 'moi.png', mimeType: 'image/png', buffer: await png(a.frame, 640, 480, '#ffd166') });
check(await until(async () => (await b.frame.locator('.person', { hasText: 'Léa' }).locator('.avatar.has-photo img').count()) === 1, 8000), 'photo: A\'s photo shown to B in the players');
check(await a.frame.locator('.photo-wrap .avatar img').evaluate(i => i.naturalWidth === 256 && i.naturalHeight === 256), 'photo: a 256 px square');
await shot(a.page, '05-photo');
await a.frame.locator('.drawer-right [aria-label="Fermer"]').click();
await shot(b.page, '06-pictures-dark');

// ---- jalon 4: commands, votes, social credit
const say = async (frame, text) => { await frame.locator('[name="text"]').fill(text); await frame.locator('[name="text"]').press('Enter'); };
await b.frame.locator('[name="text"]').fill('/');
check(await until(async () => (await b.frame.locator('.emoji-suggest li').count()) === 4), 'commands: « / » lists /activity, /hote, /credit-social, /kick');
await b.frame.locator('[name="text"]').fill('');
await say(b.frame, '/hote');
const vote = a.frame.locator('.msg.vote.is-open');
check(await until(async () => (await vote.count()) === 1, 8000) && (await vote.textContent()).includes('demande à devenir l\'hôte'), '/hote: a vote in the chat, for A too');
await shot(a.page, '07-vote');
await vote.getByRole('button', { name: 'Oui' }).click();
check(await until(async () => (await a.frame.locator('.person', { hasText: 'Hugo' }).getByText('hôte').count()) === 1, 8000), 'vote: everyone voted yes, B becomes the host');
check(await a.frame.locator('.msg.vote .vote-result.ok').count() === 1, 'vote: « Accepté »');
await say(a.frame, '/credit-social');
const modal = a.frame.locator('.modal.credit-modal');
await modal.locator('.credit-row', { hasText: 'Hugo' }).click();
await modal.locator('[name="creditAmount"]').fill('20');
check(await modal.locator('.credit-apply[data-v="1"] .hiero[data-glyph="1304f"]').count() === 1, 'credit: +20 shows its hieroglyph (liesse)');
await modal.locator('.credit-apply[data-v="1"]').click();
check(await until(async () => (await b.frame.locator('.msg.credit').textContent().catch(() => '')).includes('accorde 20 crédits sociaux à Toi'), 8000), 'credit: said in the chat, B sees it');
check(await until(async () => (await a.frame.locator('.person', { hasText: 'Hugo' }).locator('.credit-badge').textContent()) === '+20'), 'credit: B\'s badge +20 in the players');
await say(a.frame, '/activity');
check(await until(async () => (await a.frame.locator('.act-tile').count()) === 6), '/activity: the six kinds of activity');
await shot(a.page, '08-activity');
await a.frame.locator('.act-picker [aria-label="Fermer"]').click();
await say(a.frame, '/nimporte');
check(await until(async () => (await a.frame.locator('.chat-note').textContent().catch(() => '')).includes('Commande inconnue')), 'an unknown command: said to me only');

// ---- jalon 5: the Demi-disque (B is the host since the /hote vote)
const clickBoard = async (page, frame, fx, fy) => { const box = await frame.locator('.board:not([hidden])').boundingBox(); await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy); };
await say(b.frame, '/activity');
await b.frame.locator('.act-tile', { hasText: 'Demi-disque' }).click();
await b.frame.locator('.act-format', { hasText: 'Rayon libre' }).click();
check(await until(async () => (await a.frame.locator('.board:not([hidden])').count()) === 1, 8000), 'the host chose the Demi-disque: the disk for everyone');
await a.frame.getByRole('button', { name: 'Participer' }).click();
check(await until(async () => (await b.frame.locator('.msg.sys', { hasText: 'rejoint la partie' }).count()) >= 1), 'A joins the game (« Participer »)');
await b.frame.locator('[name="word"]').fill('La France');
await clickBoard(b.page, b.frame, 0.3, 0.5);
await b.frame.getByRole('button', { name: 'Lancer le tour' }).click();
check(await until(async () => (await a.frame.locator('.word').textContent().catch(() => '')).includes('La France'), 8000), 'round: A sees the word');
check(await a.frame.locator('.disk-rays [data-kind="target"], .ray-target').count() === 0, 'round: the host\'s ray hidden from A');
check(await a.frame.locator('.timer').count() === 1, 'round: the answer time runs');
await shot(a.page, '09-disk-guess');
await clickBoard(a.page, a.frame, 0.32, 0.5);
await a.frame.getByRole('button', { name: 'Valider mon rayon' }).click();
check(await until(async () => (await a.frame.locator('.results .result').count()) >= 2, 8000), 'every candidate validated: the results at once');
check(await until(async () => (await b.frame.locator('.results .perfect, .results .result b').count()) >= 1), 'the host sees the results');
await shot(a.page, '10-disk-reveal');
await a.frame.locator('.drawer-left .tab', { hasText: 'Classement' }).click();
check(await until(async () => Number(await a.frame.locator('.rank-row.is-me .rank-score').textContent()) > 0), 'A\'s score counts in the ranking');
await a.frame.locator('.drawer-left .tab', { hasText: 'Chat' }).click();
await b.frame.getByRole('button', { name: 'Tour suivant' }).click();
check(await until(async () => (await b.frame.locator('[name="word"]').count()) === 1), 'next round: the host writes a new word');
// ---- jalon 6: the Sondage and the Roulette (B hosts)
await say(b.frame, '/activity');
await b.frame.locator('.act-tile', { hasText: 'Sondage' }).click();
await b.frame.locator('[data-poll="question"]').waitFor();
await b.frame.locator('[data-poll="question"]').fill('Où partir cet été ?');
await b.frame.locator('[data-poll="choice"][data-i="0"]').fill('Japon');
await b.frame.locator('[data-poll="choice"][data-i="1"]').fill('Islande');
check(await b.frame.locator('[data-poll="choice"][data-i="1"]').evaluate(e => e === document.activeElement), 'poll: typing keeps the focus in the field');
await b.frame.getByRole('button', { name: 'Publier le sondage' }).click();
check(await until(async () => (await a.frame.locator('.poll-option').count()) === 2, 8000), 'poll: published, A sees the choices');
await a.frame.locator('.poll-option', { hasText: 'Islande' }).click();
await a.frame.getByRole('button', { name: 'Valider ma réponse' }).click();
check(await until(async () => (await b.frame.locator('.poll-bars .bar-row.win').textContent().catch(() => '')).includes('Islande'), 8000), 'poll: every candidate answered, the results (Islande first)');
await shot(b.page, '11-poll-results');
await say(b.frame, '/activity');
await b.frame.locator('.act-tile', { hasText: 'Roulette' }).click();
await b.frame.locator('[data-wh="label"][data-i="0"]').waitFor();
await b.frame.locator('[data-wh="label"][data-i="0"]').fill('Pizza');
await b.frame.locator('[data-wh="label"][data-i="1"]').fill('Sushi');
check(await until(async () => (await a.frame.locator('.wheel-legend').textContent().catch(() => '')).includes('Sushi'), 8000), 'wheel: A watches it being built');
await b.frame.getByRole('button', { name: 'Lancer la roue' }).click();
check(await until(async () => (await a.frame.getByText('La roue tourne…').count()) >= 1, 5000), 'wheel: spinning for everyone');
check(await until(async () => /Pizza|Sushi/.test(await a.frame.locator('[data-winner]').textContent().catch(() => '')), 12000), 'wheel: the same winner shown after the spin');
check((await a.frame.locator('[data-winner]').textContent()) === (await b.frame.locator('[data-winner]').textContent()), 'wheel: A and B see the same result');
await shot(a.page, '12-wheel-result');
// ---- jalon 7: the Trou du cul (A plays, robots on the free seats)
await say(b.frame, '/activity');
await b.frame.locator('.act-tile', { hasText: 'Cartes' }).click();
await b.frame.locator('.act-format', { hasText: 'Trou du cul' }).click();
await b.frame.getByRole('button', { name: 'Distribuer' }).click();
check(await until(async () => (await a.frame.locator('.cg-hand .in-hand').count()) >= 17, 8000), 'cards: A sees his hand in a fan');
check(await a.frame.locator('.cg-seat').count() === 2 && (await a.frame.locator('.cg-seat .seat-bot').count()) === 2, 'cards: two robots on the free seats');
check(await b.frame.locator('.cg-hand').count() === 0, 'cards: B (not seated) sees no hand');
await shot(a.page, '13-cards');
await a.frame.getByRole('button', { name: 'Quitter la table' }).click();
check(await until(async () => (await a.frame.locator('.cg-results').count()) === 1, 30000), 'cards: A left, the robots finished the round');
check(await until(async () => (await a.frame.locator('.cg-results li', { hasText: 'Toi' }).count()) === 1), 'cards: the round\'s points stay A\'s (last player of his seat)');
await shot(a.page, '14-cards-results');
await a.frame.locator('[data-action="table-join"]').click();
check(await until(async () => (await b.frame.locator('.msg.sys', { hasText: 'reprend sa place' }).count()) >= 1 || (await b.frame.locator('.msg.sys', { hasText: 'prend la place' }).count()) >= 1, 8000), 'cards: A takes a seat back');
await say(b.frame, '/activity');
await b.frame.locator('.act-tile', { hasText: 'Chat' }).click();
check(await until(async () => (await a.frame.locator('.chat-stage .chat').isVisible())), 'back to the Chat activity');

// ---- jalon 9: the shortcut, shown in the Extension tab; « Rester ouvert sur toutes les pages » off by default
check((await A.sw.evaluate(() => chrome.commands.getAll())).some(c => c.name === 'toggle-panel'), 'extension: the « toggle-panel » command exists');
await a.frame.locator('.bar .avatar').click();
await a.frame.locator('[data-action], .tab', { hasText: 'Extension' }).first().click();
check(await until(async () => (await a.frame.getByText('Raccourci clavier').count()) === 1), 'extension: the shortcut in the Extension tab');
check(!(await a.frame.getByRole('checkbox', { name: 'Rester ouvert sur toutes les pages' }).isChecked()), 'extension: « Rester ouvert sur toutes les pages » off by default');
await shot(a.page, '15-extension-tab');
await a.frame.locator('.drawer-right [aria-label="Fermer"]').click();

// the server restarts: the panels say « Reconnexion… », then come back with the chat kept
await stopServer();
check(await until(async () => (await a.frame.getByText('Reconnexion…').count()) === 1, 8000), 'server down: « Reconnexion… » in the header');
await startServer();
check(await until(async () => (await a.frame.getByText('Reconnexion…').count()) === 0 && (await a.frame.locator('.msg', { hasText: 'merci' }).count()) === 1, 15000),
  'server back: reconnected, the chat kept');
await a.frame.locator('[name="text"]').fill('toujours là ?');
await a.frame.locator('[name="text"]').press('Enter');
check(await until(async () => (await b.frame.locator('.msg', { hasText: 'toujours là' }).count()) === 1, 8000), 'after the restart, messages go through again');

// B closes his panel: after the 15 s grace, A sees him away
await b.page.close();
check(await until(async () => (await a.frame.locator('.person', { hasText: 'Hugo' }).locator('.presence').count()) === 1, 25000), 'B gone: away for A after the 15 s grace');
await shot(a.page, '04-presence');

admin('rooms:delete', key, '--yes');
check(await until(async () => (await a.frame.getByText('Salon inconnu').count()) === 1), 'the admin deletes the room: « Salon inconnu »');

await A.close(); await B.close();
await stopServer();
console.log(failures() ? `\n${failures()} échec(s)` : '\nTout est bon.');
process.exit(failures() ? 1 : 0);
