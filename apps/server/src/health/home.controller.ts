// GET /: the server's own page (opened in a browser): Slopesque is played from the extension.
import { Controller, Get, Header } from '@nestjs/common';

const RELEASES = 'https://github.com/recovizzi/slopesque/releases/latest';
const PAGE = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Slopesque</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;font:16px system-ui;background:#f3f1ea;color:#1c1b19}@media(prefers-color-scheme:dark){body{background:#141518;color:#ececee}}
main{max-width:420px;padding:24px;text-align:center}a{display:inline-block;margin:12px 0;padding:11px 22px;border-radius:8px;background:#5b5bd6;color:#fff;text-decoration:none;font-weight:700}p{opacity:.8}</style></head>
<body><main><h1>Slopesque</h1><p>Ce jeu se joue depuis l'extension de navigateur.</p><a href="${RELEASES}">Installer l'extension</a>
<p>Une fois installée, ouvre son onglet Extension et mets l'adresse de ce serveur dans « Serveur ».</p></main></body></html>`;

@Controller()
export class HomeController {
  @Get()
  @Header('Content-Type', 'text/html; charset=utf-8')
  home() { return PAGE; }
}
