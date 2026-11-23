// End-to-end, the Texas Hold'em in the extension's panel (openspec: card-games, Texas Hold'em): one player and robots
// at a human pace. My two cards only, the button and the blinds, the betting bar (its sizes say the amounts), the
// board turned over, the showdown, the rules with the hands drawn, the host ends the game: places and points.
// Run after run.mjs (`pnpm e2e`), on the same port.
process.env.ROBOT_DELAY_MS ??= '500';
const { admin, check, failures, player, shot, startServer, stopServer, until } = await import('./lib.mjs');

await startServer();
const key = admin('rooms:create', '--name', 'Poker (e2e)').match(/[A-Z0-9]{4}-[A-Z0-9]{4}/)[0];
const A = await player('dark');
const { page, frame } = await A.open();
page.on('dialog', d => void d.accept());
await frame.locator('.room-card.welcome').waitFor();
await frame.getByRole('button', { name: 'Continuer avec ce code' }).click();
await frame.getByRole('button', { name: 'Choisir un salon' }).click();
await frame.getByRole('button', { name: '+ Ajouter' }).click();
await frame.locator('[name="roomKey"]').fill(key);
await frame.locator('.modal').getByRole('button', { name: 'Ajouter' }).click();
await frame.locator('.room-row', { hasText: key }).getByRole('button', { name: 'Rejoindre' }).click();
await frame.locator('.chat-stage .chat').waitFor();
await frame.locator('.backdrop').click({ force: true }).catch(() => {});

// /activity cartes holdem, 4 seats, 1 000 chips
await frame.locator('[name="text"]').fill('/activity cartes holdem');
await frame.locator('[name="text"]').press('Enter');
await frame.locator('.bar .avatar').click();
await frame.locator('.drawer-right .tab', { hasText: 'Partie' }).click();
await frame.locator('.drawer-right').getByLabel('Joueurs').selectOption('4');
await frame.locator('.drawer-right').getByLabel('Tapis de départ').selectOption('1000');
check(await frame.locator('.drawer-right').getByLabel('Montée des blindes').count() === 1, 'Partie: the Hold\'em\'s settings (seats, chips, blinds, robots)');
await shot(page, '30-holdem-settings');
await frame.locator('.drawer-right [aria-label="Fermer"]').click();

await frame.getByRole('button', { name: 'Prendre une place' }).click();
await frame.getByRole('button', { name: 'Distribuer' }).click();
await frame.locator('.hd-hole .pcard').first().waitFor();
const myCards = await frame.locator('.hd-hole .pcard svg').evaluateAll(els => els.map(e => e.getAttribute('aria-label')));
check(myCards.length === 2 && myCards.every(Boolean), `my two cards, face up (${myCards.join(', ')})`);
check(await frame.locator('.hd-place .hd-holes .back').count() >= 4, 'the others\' cards: backs');
check(await frame.locator('.hd-pos.dealer').count() === 1 && await frame.locator('.hd-pos', { hasText: 'GB' }).count() === 1, 'the button and the big blind shown');

// the flights, seen as they happen (cards from the deck, chips to the felt, to the pot, to the winner)
await frame.evaluate(() => {
  globalThis.__fly = 0;
  new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) if (n instanceof HTMLElement && n.classList.contains('hd-fly')) globalThis.__fly++; })
    .observe(document.body, { childList: true, subtree: true });
});
check(await frame.locator('[data-deck]').count() === 1, 'the deck on the felt');
check(await until(async () => (await frame.locator('.hd-bet-spot .hd-chips').count()) >= 1, 8000), 'the blinds in chips under their players');

// my turns: I click my chips (they go to my bet), clear them, then call (or check); until a flop is turned over
let sawFlop = false, sawBar = false;
for (let k = 0; k < 30 && !sawFlop; k++) {
  if (await frame.locator('.hd-board .pcard').count() >= 3) { sawFlop = true; break; }
  if (await frame.locator('.hd-actions.is-mine').count()) {
    if (!sawBar && await frame.locator('[data-action="holdem-chip"]:not([disabled])').count() >= 2) {
      const chips = frame.locator('[data-action="holdem-chip"]:not([disabled])');
      for (let n = 0; n < 4; n++) await chips.nth(1).click();   // four red chips (25): 100 more
      const label = await frame.locator('[data-action="holdem-bet"]').textContent();
      check(/^(Relancer à|Miser|Tapis|Suivre) [\d\s ]+$/.test(label?.trim() ?? ''), `my clicked chips make a bet, its button says the amount (« ${label?.trim()} »)`);
      check(await frame.locator('.hd-bet-spot.mine .hd-chips.is-pending').count() === 1, 'the clicked chips wait on the felt under me');
      await shot(page, '31-holdem-my-turn');
      await frame.locator('[data-action="holdem-clear"]').click();
      sawBar = true;
    }
    const call = frame.locator('[data-action="holdem-call"], [data-action="holdem-check"]').first();
    await call.click();
  }
  await page.waitForTimeout(500);
}
check(sawBar, 'my chips in piles, clickable on my turn');
check(await frame.evaluate(() => globalThis.__fly) > 0, `pieces fly on the table (${await frame.evaluate(() => globalThis.__fly)})`);
check(sawFlop || await frame.locator('.hd-awards').count() > 0, 'the flop turned over (or the hand won before)');
if (sawFlop) { await page.waitForTimeout(1200); await shot(page, '32-holdem-flop'); }

// I keep playing (check or call) while waiting for something to happen at the table
const playing = cond => until(async () => {
  if (await cond()) return true;
  const mine = frame.locator('.hd-actions.is-mine [data-action="holdem-check"], .hd-actions.is-mine [data-action="holdem-call"]');
  if (await mine.count()) await mine.first().click().catch(() => {});
  return false;
}, 60000);
// the showdown or a hand won: the pots and who took them
check(await playing(async () => (await frame.locator('.announce-box.hd-win').count()) > 0), 'the hand\'s end in the foreground: the winner, his cards + the board, the hand\'s name');
await shot(page, '33a-holdem-winning-hand');
check(await frame.locator('.hd-win .hd-win-card').count() >= 2 && (await frame.locator('.hd-win .ann-bid').textContent())?.trim().length > 0, 'the winning cards and the hand named');
check(await playing(async () => (await frame.locator('.hd-awards li').count()) > 0), 'then the pot goes to the winner: who took it');
await shot(page, '33-holdem-pot');
check(await playing(async () => (await frame.locator('.seat-crown').count()) >= 1), 'a crown on the biggest bank (once the banks differ)');

// the rules: the hands drawn, strongest first
await frame.locator('[data-action="cards-rules"]').click();
check(await frame.locator('.hd-ranks li').count() === 10, 'the rules: the 10 hands, drawn');
await shot(page, '34-holdem-rules');
await frame.locator('.rules [data-action="rules-close"]').click();

// the host ends the game: places and points
await frame.locator('.bar .avatar').click();
await frame.locator('.drawer-right .tab', { hasText: 'Partie' }).click();
await frame.getByRole('button', { name: 'Terminer la partie' }).click();
await frame.locator('.drawer-right [aria-label="Fermer"]').click();
check(await until(async () => (await frame.locator('.hd-results li').count()) === 4, 15000), 'the game ended: 4 places');
check(await frame.locator('.hd-results .pts', { hasText: '+' }).count() === 1, 'my place\'s points (the robots: none)');
await until(async () => (await frame.locator('.announce-box').count()) === 0 && (await frame.locator('.drawer-right').count()) === 0, 6000);
await shot(page, '35-holdem-end');

await A.close();
await stopServer();
console.log(failures() ? `\n${failures()} échec(s).` : '\nTout est bon.');
process.exit(failures() ? 1 : 0);
