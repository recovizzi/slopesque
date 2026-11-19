// End-to-end, the card table's animations (as the maquette): robots at a human pace (ROBOT_DELAY_MS=400), one player.
// A card flies to the pile (from a seat, from my hand), a Tarot trick stays on the table then goes to its winner, the
// take is announced. Run after run.mjs (`pnpm e2e`), on the same port.
process.env.ROBOT_DELAY_MS ??= '400';
const { admin, check, failures, player, shot, startServer, stopServer, until } = await import('./lib.mjs');

await startServer();
const key = admin('rooms:create', '--name', 'Cartes (e2e)').match(/[A-Z0-9]{4}-[A-Z0-9]{4}/)[0];
const A = await player('light');
const { page, frame } = await A.open();
await frame.locator('.room-card.welcome').waitFor();
await frame.getByRole('button', { name: 'Continuer avec ce code' }).click();
await frame.getByRole('button', { name: 'Choisir un salon' }).click();
await frame.getByRole('button', { name: '+ Ajouter' }).click();
await frame.locator('[name="roomKey"]').fill(key);
await frame.locator('.modal').getByRole('button', { name: 'Ajouter' }).click();
await frame.locator('.room-row', { hasText: key }).getByRole('button', { name: 'Rejoindre' }).click();
await frame.locator('.chat-stage .chat').waitFor();
await frame.locator('.backdrop').click({ force: true }).catch(() => {});

// what the table shows, seen as it happens (a fly lasts 420 ms: too short to poll)
await frame.evaluate(() => {
  const seen = { fly: 0, handFly: 0, gather: 0, take: 0 };
  globalThis.__seen = seen;
  new MutationObserver(ms => {
    for (const m of ms) for (const n of m.addedNodes) {
      if (!(n instanceof HTMLElement)) continue;
      if (n.classList.contains('card-fly')) { seen.fly++; if (n.classList.contains('from-hand')) seen.handFly++; if (n.classList.contains('gather')) seen.gather++; }
      if (n.querySelector?.('.announce-box.take') || n.classList.contains('announce-box')) seen.take++;
    }
  }).observe(document.body, { childList: true, subtree: true });
});
const seen = () => frame.evaluate(() => globalThis.__seen);
async function pick(format, players) {
  await frame.locator('[name="text"]').fill('/activity');
  await frame.locator('[name="text"]').press('Enter');
  await frame.locator('.act-tile', { hasText: 'Cartes' }).click();
  await frame.locator('.act-format', { hasText: format }).click();
  await frame.locator('.bar .avatar').click();
  await frame.locator('.drawer-right .tab', { hasText: 'Partie' }).click();
  await frame.locator('.drawer-right').getByLabel('Joueurs').selectOption(String(players));
  await frame.locator('.drawer-right [aria-label="Fermer"]').click();
}
const snap = async name => { if (await until(async () => (await frame.locator('.card-fly').count()) > 0, 6000)) await shot(page, name); };

// ---- the Trou du cul at 3: I play my cards, the robots theirs
await pick('Trou du cul', 3);
await frame.getByRole('button', { name: 'Prendre une place' }).click();
await frame.getByRole('button', { name: 'Distribuer' }).click();
await frame.locator('.cg-hand .in-hand').first().waitFor();
await snap('20-tdc-fly');
for (let k = 0; k < 6 && !(await seen()).handFly; k++) {   // my turns: my strongest card if it can be played, else I pass
  if (!(await until(async () => (await frame.locator('.cards-game.my-turn').count()) === 1, 8000))) break;
  await frame.locator('.cg-hand .in-hand').last().click();
  if (await frame.locator('[data-action="cards-play"]:not([disabled])').count()) await frame.locator('[data-action="cards-play"]').click();
  else await frame.locator('[data-action="cards-pass"]').click();
  await page.waitForTimeout(900);
}
let s = await seen();
check(s.handFly >= 1, `Trou du cul: my card flies from my hand to the pile (${s.handFly})`);
await frame.getByRole('button', { name: 'Quitter la table' }).click();   // the robots play on (mine too), from their seat
const robots = v => v.fly - v.handFly - v.gather, was = robots(s);
check(await until(async () => robots(await seen()) >= was + 3, 10000), `Trou du cul: the robots' cards fly from their seat to the pile (${robots(await seen())})`);

// ---- the Tarot at 4, robots only: the take announced, each trick seen then sent to its winner
await pick('Tarot', 4);
await frame.locator('[data-action="table-leave"]').click().catch(() => {});
await frame.getByRole('button', { name: 'Distribuer' }).click();
check(await until(async () => (await seen()).take > 0, 30000), 'Tarot: the take announced over the table');
if (await frame.locator('.announce-box').count()) await shot(page, '21-tarot-take');
check(await until(async () => (await frame.locator('.cg-pile .on-table').count()) === 4 && (await seen()).gather === 0, 30000), 'Tarot: the trick taken stays on the table a moment (its 4 cards)');
await shot(page, '22-tarot-trick');
check(await until(async () => (await seen()).gather >= 4, 3000), 'Tarot: then it goes to its winner');
const start = (await seen()).fly - (await seen()).gather;
check(await until(async () => { const v = await seen(); return v.fly - v.gather >= start + 4; }, 15000), 'Tarot: the robots\' cards fly to the pile (the next trick too)');

await A.close();
await stopServer();
console.log(failures() ? `\n${failures()} échec(s).` : '\nTout est bon.');
process.exit(failures() ? 1 : 0);
