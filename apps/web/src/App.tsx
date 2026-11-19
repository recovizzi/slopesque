// Jalon 1: the app only shows whether the server answers (the real panel comes with jalon 2).
import { useEffect, useState } from 'react';

const SERVER = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:3100';

export function App() {
  const [health, setHealth] = useState<string>('…');
  useEffect(() => {
    fetch(`${SERVER}/api/health`).then(r => r.json()).then(h => setHealth(JSON.stringify(h, null, 2))).catch(e => setHealth(`Serveur injoignable : ${e.message}`));
  }, []);
  return <main style={{ font: '14px system-ui', padding: 16 }}><h1>Slopesque</h1><pre>{health}</pre></main>;
}
