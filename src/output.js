import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

export async function pathExists(p) {
  try { await stat(p); return true; } catch { return false; }
}

export async function writeIfChanged(path, content) {
  let existing = null;
  try { existing = await readFile(path, 'utf8'); } catch {}
  if (existing === content) return false;
  await writeFile(path, content, 'utf8');
  return true;
}
