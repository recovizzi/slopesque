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
  await frame.locator('.drawer-right .field input').first().fill(name === 'A' ? 'Léa' : 'Hugo');
  await frame.locator('.drawer-right .field input').first().press('Enter');
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
