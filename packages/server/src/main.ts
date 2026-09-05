import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { DEFAULT_POLLER, Poller } from '@flip/ingest';
import { startServer } from './server.js';

const here = dirname(fileURLToPath(import.meta.url));

const contact = process.env['FLIP_CONTACT'];
if (contact === undefined || contact === '') {
  console.error(
    'FLIP_CONTACT is required. The OSRS Wiki API rejects generic user agents outright,\n' +
    'and asks that yours name the project and a way to reach you. Set it to your email:\n\n' +
    '  FLIP_CONTACT="you@example.com" npm start\n',
  );
  process.exit(1);
}

const dbPath = process.env['FLIP_DB'] ?? resolve(process.cwd(), 'data/flip.db');
const port = Number(process.env['FLIP_PORT'] ?? 8787); // nofallback-ok: listen port default
const webRoot = process.env['FLIP_WEB'] ?? resolve(here, '../../web/dist');

const poller = new Poller({ ...DEFAULT_POLLER, dbPath, contact });
await poller.start();

startServer({ port, webRoot, store: poller.getStore(), poller });

console.log(`flip finder listening on http://127.0.0.1:${port}`);
console.log(`  database  ${dbPath}`);
console.log(`  web root  ${webRoot}`);
console.log(`  polling   /latest every ${DEFAULT_POLLER.latestIntervalMs / 1000}s`);

const shutdown = (): void => { poller.stop(); process.exit(0); };
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
