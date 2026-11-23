// End-to-end, la Coinche in the extension's panel (openspec: card-games, Coinche): one player and three robots. My
// hand only, the bidding bar (a value, a suit), the contract announced, a card played, the trick sent to its winner,
// the deal's count, the rules with the cards drawn.
process.env.ROBOT_DELAY_MS ??= '300';
const { admin, check, failures, player, shot, startServer, stopServer, until } = await import('./lib.mjs');

await startServer();
const key = admin('rooms:create', '--name', 'Coinche (e2e)').match(/[A-Z0-9]{4}-[A-Z0-9]{4}/)[0];
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

await frame.locator('[name="text"]').fill('/activity cartes coinche');
await frame.locator('[name="text"]').press('Enter');
await frame.getByRole('button', { name: 'Prendre une place' }).click();
await frame.getByRole('button', { name: 'Distribuer' }).click();
await frame.locator('.cg-hand .in-hand').first().waitFor();
check(await frame.locator('.cg-hand .in-hand').count() === 8, 'my 8 cards');
check(await frame.locator('.co-board').count() === 1, 'the score of both teams');
check(await frame.locator('.cg-seat .co-team', { hasText: 'Partenaire' }).count() === 1, 'my partner across, marked');

// the bidding: on my turn I bid 80 in my longest suit if nobody did, else I pass
let bidSeen = false;
for (let k = 0; k < 40; k++) {
  if (await frame.locator('.cards-game.coinche .cg-hand .is-off').count() || await frame.locator('.tarot-trick .on-table').count()) break;
  if (await frame.locator('[data-action="co-value"]').count()) {
    if (!bidSeen) {
      bidSeen = true;
      const v80 = frame.locator('[data-action="co-value"][data-v="80"]:not([disabled])');
      if (await v80.count()) {
        await v80.click(); await frame.locator('[data-action="co-suit"][data-v="H"]').click();
        check(/Annoncer 80/.test(await frame.locator('[data-action="co-bid"]').textContent() ?? ''), 'the bid button says it: « Annoncer 80 ♥ »');
        await shot(page, '40-coinche-bid');
        await frame.locator('[data-action="co-bid"]').click();
        await page.waitForTimeout(400);
        continue;
      }
    }
    await frame.locator('[data-action="co-pass"]').first().click();
  } else if (await frame.locator('[data-action="co-surcoinche"]').count()) await frame.locator('[data-action="co-pass"]').click();
  await page.waitForTimeout(400);
}
check(bidSeen, 'the bidding bar on my turn');

// the play: my legal card clicked twice
let played = false;
for (let k = 0; k < 60 && !played; k++) {
  if (await frame.locator('.cards-game.coinche.my-turn .cg-hand .in-hand:not(.is-off)').count() && !(await frame.locator('[data-action="co-pass"]').count())) {
    const c = frame.locator('.cg-hand .in-hand:not(.is-off)').first();
    await c.click(); await c.click();
    played = true;
  }
  await page.waitForTimeout(400);
}
check(played || await frame.locator('.co-results').count() > 0, 'I play a legal card (or the deal ended)');
check(await until(async () => (await frame.locator('.tarot-trick .on-table').count()) >= 1, 15000), 'the trick on the table');
await shot(page, '41-coinche-trick');

// I leave: the robots finish the deal, its count is shown
await frame.getByRole('button', { name: 'Quitter la table' }).click();
check(await until(async () => (await frame.locator('.co-results').count()) > 0, 90000), 'the deal\'s count: contract made or fallen, each team\'s points, the score sheet');
await shot(page, '42-coinche-count');

await frame.locator('[data-action="cards-rules"]').click();
check(await frame.locator('.co-values-rule li').count() === 16, 'the rules: the cards\' order and points, trump and plain');
await shot(page, '43-coinche-rules');
await frame.locator('.rules [data-action="rules-close"]').click();

await A.close();
await stopServer();
console.log(failures() ? `\n${failures()} échec(s).` : '\nTout est bon.');
process.exit(failures() ? 1 : 0);
