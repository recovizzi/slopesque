// `pnpm dev` for the server: tsc in watch mode, and node restarted when dist changes. Both stop together.
import { spawn } from 'node:child_process';

const tsc = spawn('npx', ['tsc', '-p', 'tsconfig.build.json', '--watch', '--preserveWatchOutput'], { stdio: 'inherit' });
const node = spawn(process.execPath, ['--watch-path=dist', '--watch-preserve-output', 'dist/main.js'], { stdio: 'inherit' });
const stop = () => { tsc.kill(); node.kill(); };
for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => { stop(); process.exit(0); });
node.on('exit', code => { tsc.kill(); process.exit(code ?? 0); });
