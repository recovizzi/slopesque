#!/usr/bin/env node
// `pnpm release [patch|minor|major|X.Y.Z] [--only extension|server] [--min-extension] [--yes]` — a new version of
// Slopesque, from main, in one command (the principle of inspare's release script, for GitHub). See RELEASE.md.
//   1. checks: clean working directory, on main up to date with origin, the CI green on its last commit;
//   2. shows the commits since the last version, asks what is missing (the bump, what to release), shows the plan and
//      waits for one confirmation;
//   3. one version for the whole project: every package.json bumped, commit `chore(release): vX.Y.Z`, an annotated tag
//      vX.Y.Z whose message says what to release (« portée : tout | extension | serveur »), pushed;
//   4. the tag starts the Release workflow on GitHub: the extension's packages, the server's image, then the
//      deployment once you approve it (environment « production »), and the release page.
// --only extension : a change of the extension only (a visual fix…): its packages, the server untouched.
// --only server    : the server only: its image and its deployment, the extension unchanged.
// --min-extension  : the server refuses the extensions older than this version (a change they can't follow).
// --dry-run        : the checks and the plan only, nothing changed.
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const MANIFESTS = ['apps/extension', 'apps/server', 'apps/web', 'packages/engines', 'packages/shared', 'tests/e2e'].map(d => join(ROOT, d, 'package.json'));
const SCOPES = { tout: 'tout', all: 'tout', extension: 'extension', serveur: 'serveur', server: 'serveur' };
const fail = msg => { console.error(`\n✖ ${msg}`); process.exit(1); };
const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8' }).trim();
const gitTry = (...a) => { try { return git(...a); } catch { return ''; } };
const run = (cmd, a) => { const r = spawnSync(cmd, a, { cwd: ROOT, stdio: 'inherit' }); if (r.status !== 0) fail(`échec de : ${cmd} ${a.join(' ')}`); };
const semver = v => { const m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(v); if (!m) fail(`version non semver : « ${v} »`); return m.slice(1).map(Number); };
const cmp = (a, b) => { const [x, y] = [semver(a), semver(b)]; return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]; };
const bump = (v, type) => { const [M, m, p] = semver(v); return type === 'major' ? `${M + 1}.0.0` : type === 'minor' ? `${M}.${m + 1}.0` : `${M}.${m}.${p + 1}`; };

// ---- the arguments
const args = process.argv.slice(2), flag = n => args.includes(`--${n}`);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const positional = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--only')[0] ?? null;
if (positional && !['patch', 'minor', 'major'].includes(positional) && !/^v?\d+\.\d+\.\d+$/.test(positional)) fail(`argument invalide « ${positional} » : patch | minor | major | X.Y.Z`);
if (only && !SCOPES[only]) fail(`--only ${only} : extension ou server`);
const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = async (q, def = '') => (flag('yes') ? def : ((await rl.question(q)).trim() || def));

// ---- 1. the checks, before touching anything
if (git('status', '--porcelain')) fail('des fichiers modifiés ne sont pas commités : commite-les avant une version');
console.log('→ mise à jour de main depuis GitHub');
run('git', ['fetch', 'origin', '--tags', '--prune']);
if (git('rev-parse', '--abbrev-ref', 'HEAD') !== 'main') run('git', ['checkout', 'main']);
run('git', ['pull', '--ff-only', 'origin', 'main']);
const head = git('rev-parse', 'HEAD');
const ci = gitTry('log', '-1', '--format=%H') && (() => {
  try { return JSON.parse(execFileSync('gh', ['run', 'list', '--workflow', 'ci.yml', '--branch', 'main', '--limit', '5', '--json', 'headSha,conclusion,status'], { cwd: ROOT, encoding: 'utf8' })); } catch { return null; }
})();
const run0 = ci?.find(r => r.headSha === head);
if (!ci) console.log('  (CI non vérifiée : la commande gh n\'est pas disponible ou pas connectée)');
else if (!run0) fail('la CI n\'a pas encore tourné sur le dernier commit de main : attends-la (onglet Actions), puis relance');
else if (run0.status !== 'completed') fail('la CI tourne encore sur le dernier commit de main : attends sa fin, puis relance');
else if (run0.conclusion !== 'success') fail(`la CI a échoué sur le dernier commit de main (${run0.conclusion}) : corrige-la avant une version`);
else console.log('  ✓ CI verte sur le dernier commit');

// ---- 2. what has changed, what to release
const pkgVersion = JSON.parse(readFileSync(MANIFESTS[0], 'utf8')).version;
const lastTag = gitTry('tag', '--list', 'v*.*.*', '--sort=-v:refname').split('\n')[0] ?? '';
const current = lastTag && cmp(lastTag, pkgVersion) > 0 ? lastTag.slice(1) : pkgVersion;
const log = gitTry('log', '--format=  %h %s', lastTag ? `${lastTag}..HEAD` : 'HEAD');
console.log(`\nVersion actuelle : v${current}${lastTag ? '' : ' (aucune version publiée encore)'}`);
console.log(log ? `Depuis ${lastTag || 'le début'} :\n${log.split('\n').slice(0, 40).join('\n')}${log.split('\n').length > 40 ? `\n  … et ${log.split('\n').length - 40} autres` : ''}` : 'Aucun commit depuis la dernière version.');
if (lastTag && !log) fail('rien de nouveau depuis la dernière version');

let type = positional;
if (!type) type = (await ask('\nQuelle version ? patch (correctif) / minor (nouveauté) / major (changement incompatible) / X.Y.Z [patch] : ', 'patch')).toLowerCase();
const version = ['patch', 'minor', 'major'].includes(type) ? bump(current, type) : type.replace(/^v/, '');
semver(version);
if (cmp(version, current) <= 0 && lastTag) fail(`v${version} n'est pas plus récente que v${current}`);
const tag = `v${version}`;
if (gitTry('tag', '--list', tag) || gitTry('ls-remote', '--tags', 'origin', tag)) fail(`le tag ${tag} existe déjà`);

let scope = only ? SCOPES[only] : null;
if (!scope) scope = SCOPES[(await ask('Que publier ? tout / extension / serveur [tout] : ', 'tout')).toLowerCase()] ?? fail('réponse attendue : tout, extension ou serveur');
let minExt = flag('min-extension');
if (!minExt && type === 'major' && scope !== 'extension')
  minExt = /^o(ui)?$/i.test(await ask(`Le serveur doit-il refuser les extensions plus anciennes que ${tag} (changement incompatible) ? o / N [N] : `, 'n'));

// ---- 3. the plan, one confirmation
const parts = { tout: 'l\'extension (zip, crx, xpi signé), l\'image du serveur et son déploiement', extension: 'l\'extension seulement (zip, crx, xpi signé) ; le serveur ne change pas', serveur: 'l\'image du serveur et son déploiement ; l\'extension ne change pas' }[scope];
console.log(`\nPlan :
  version     v${current} → ${tag}  (tous les package.json)
  commit      chore(release): ${tag}
  tag         ${tag} (annoté, portée : ${scope})
  publie      ${parts}${minExt ? `\n  serveur     refuse les extensions plus anciennes que ${tag}` : ''}
  ensuite     GitHub Actions → Release${scope === 'extension' ? '' : ' ; le déploiement attend ton approbation (environnement « production »)'}`);
if (flag('dry-run')) { console.log('\n(--dry-run : rien n\'a changé)'); process.exit(0); }
if (!/^o(ui)?$/i.test(await ask('\nOn y va ? o / N : ', 'o'))) { console.log('Annulé : rien n\'a changé.'); process.exit(0); }
rl.close();

// ---- 4. the bump, the commit, the tag, the push
for (const f of MANIFESTS) {
  const text = readFileSync(f, 'utf8');
  writeFileSync(f, text.replace(/"version": "[^"]+"/, `"version": "${version}"`));
}
if (minExt) {
  const f = MANIFESTS[1], pkg = JSON.parse(readFileSync(f, 'utf8'));
  pkg.slopesque = { ...(pkg.slopesque ?? {}), minExtension: version };
  writeFileSync(f, `${JSON.stringify(pkg, null, 2)}\n`);
}
run('git', ['add', ...MANIFESTS]);
if (gitTry('diff', '--cached', '--name-only')) run('git', ['commit', '-m', `chore(release): ${tag}`, '-m', `Portée : ${scope}${minExt ? ` ; le serveur refuse les extensions plus anciennes que ${tag}` : ''}.`]);
else console.log(`  (les package.json sont déjà en ${version} : le tag porte sur le commit actuel)`);   // a first release at the version already written
run('git', ['tag', '-a', tag, '-m', `Slopesque ${tag}\n\nportée : ${scope}${minExt ? `\nextension minimale : ${version}` : ''}`]);
run('git', ['push', 'origin', 'main']);
run('git', ['push', 'origin', tag]);
const repo = gitTry('remote', 'get-url', 'origin').replace(/^.*[:/]([^/]+\/[^/]+?)(\.git)?$/, '$1');
console.log(`\n✓ ${tag} poussé. La publication tourne sur GitHub : https://github.com/${repo}/actions/workflows/release.yml
${scope === 'extension' ? '' : '  Le déploiement attendra ton approbation : Actions → Release → « Review deployments » → production.\n'}`);
