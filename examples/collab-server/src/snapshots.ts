import { createHash, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { open, rename, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { isRoomId, MAX_SNAPSHOT_BYTES } from './limits';

function snapshotPath(dataDir: string, docId: string): string {
  if (!isRoomId(docId)) throw new Error('Invalid collaboration room ID');
  const name = createHash('sha256').update(docId).digest('hex');
  return join(dataDir, `v2-${name}.ydoc`);
}

export async function readSnapshot(dataDir: string, docId: string): Promise<Uint8Array | null> {
  const file = await open(snapshotPath(dataDir, docId), constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK)
    .catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return null;
      throw error;
    });
  if (!file) return null;
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.size === 0 || stat.size > MAX_SNAPSHOT_BYTES) {
      throw new Error('Invalid collaboration snapshot size or file type');
    }
    const bytes = Buffer.allocUnsafe(stat.size);
    let offset = 0;
    while (offset < bytes.length) {
      const { bytesRead } = await file.read(bytes, offset, bytes.length - offset, offset);
      if (!bytesRead) throw new Error('Collaboration snapshot changed while reading');
      offset += bytesRead;
    }
    if ((await file.stat()).size !== stat.size) throw new Error('Collaboration snapshot changed while reading');
    return bytes;
  } finally {
    await file.close();
  }
}

export async function storeSnapshot(dataDir: string, docId: string, state: Uint8Array): Promise<void> {
  if (state.byteLength > MAX_SNAPSHOT_BYTES) throw new Error('Collaboration snapshot exceeds byte limit');
  const target = snapshotPath(dataDir, docId);
  const temp = `${target}.${randomUUID()}.tmp`;
  const file = await open(temp, 'wx', 0o600);
  try {
    try {
      await file.writeFile(state);
      await file.sync();
    } finally {
      await file.close();
    }
    await rename(temp, target);
    const directory = await open(dataDir, constants.O_RDONLY | constants.O_DIRECTORY);
    try {
      await directory.sync();
    } finally {
      await directory.close();
    }
  } finally {
    await unlink(temp).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error;
    });
  }
}
