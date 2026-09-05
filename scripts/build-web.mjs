import { cp, mkdir } from 'node:fs/promises';
const out = 'packages/web/dist';
await mkdir(out, { recursive: true });
await cp('packages/web/public', out, { recursive: true });
console.log('web assets copied to', out);
