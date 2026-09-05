/**
 * Runtime preconditions, checked before anything else runs.
 *
 * Storage is `node:sqlite`, which landed in Node 22.5. On an older runtime the
 * failure is an `ERR_UNKNOWN_BUILTIN_MODULE` thrown from deep inside an import,
 * which says nothing about the version being the cause — and "I already have
 * Node installed" is usually true while "I have Node 22.5" is often not, since
 * Node is installed per machine rather than per project.
 */

export const MIN_NODE = { major: 22, minor: 5 } as const;

export function nodeVersionSupported(version: string): boolean {
  const parts = version.replace(/^v/, '').split('.');
  const major = Number(parts[0]);
  const minor = Number(parts[1]);
  if (!Number.isFinite(major) || !Number.isFinite(minor)) return false;
  if (major > MIN_NODE.major) return true;
  return major === MIN_NODE.major && minor >= MIN_NODE.minor;
}

export function unsupportedNodeMessage(version: string): string {
  return [
    `This needs Node ${MIN_NODE.major}.${MIN_NODE.minor} or newer, and you are on ${version}.`,
    '',
    'Storage is node:sqlite, which is built into Node from 22.5 — that is the whole',
    'reason there is no database to install. On an older Node it simply is not there.',
    '',
    'If you use nvm:',
    '',
    '  nvm install 22 && nvm use 22',
    '',
    'Otherwise install the current LTS from https://nodejs.org and re-run.',
  ].join('\n');
}

/** Exits with a readable explanation rather than an import-time stack trace. */
export function assertSupportedRuntime(version: string = process.version): void {
  if (nodeVersionSupported(version)) return;
  console.error(unsupportedNodeMessage(version));
  process.exit(1);
}
