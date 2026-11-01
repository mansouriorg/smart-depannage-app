import * as FileSystem from 'expo-file-system/legacy';

import type { QueueStore } from './offline-queue';

/**
 * Where the phone keeps what it has not been able to send (P3-06): the app's own folder (it survives the app being closed and the phone being
 * restarted; it goes with an uninstall, and a "clear storage" of the app). The list of actions is one small text file; each closing photo is a
 * copy of the camera's picture, because the camera's own file lives in a cache that the system may empty at any time.
 *
 * The file is written to a temporary name and then put in place, so that a phone that dies in the middle of a write still has the last good file:
 * a missing file with a temporary one beside it is read from the temporary one (and the temporary one is put in place at once, so that the next
 * write does not start by overwriting the only good copy). A temporary file that is not even text of JSON, with no file beside it, is left as it
 * is and handed over to the queue, which finds it unreadable, sets it aside and tells the technician (it may be all that is left of a write that
 * was to replace a file full of actions). A write of the same run that finds one removes it: the queue in memory holds more.
 *
 * A kept photo is named by a short name (`photos/<id>.jpg`), never by its full address: the system may give an updated app another folder path,
 * and an address written in the file would then point at nothing (and the sweep of the folder would delete the photo as unknown).
 *
 * It uses the `expo-file-system/legacy` interface (Expo SDK 54): the new object interface of that SDK is not needed for five calls, and this one is
 * the one its documentation keeps for them. Not run on a phone here; see the README of the app.
 */

function folder(): string {
  const base = FileSystem.documentDirectory;

  if (!base) throw new Error('NO_STORAGE');

  return `${base}offline-queue/`;
}

const FILE = 'queue.json';
const TEMP = 'queue.json.tmp';
const PHOTOS = 'photos/';

async function ensureFolder(uri: string): Promise<void> {
  const info = await FileSystem.getInfoAsync(uri);

  if (!info.exists) await FileSystem.makeDirectoryAsync(uri, { intermediates: true });
}

/** An id can hold anything the app made of it; a file name only letters, digits, dashes and underscores. */
function safeName(id: string): string {
  return id.replace(/[^A-Za-z0-9_-]/g, '_');
}

/** True for a name this store gave to a photo (`photos/<letters, digits, dashes, underscores>.jpg`): nothing else is ever read or deleted. */
function isKeptName(kept: string): boolean {
  return /^photos\/[A-Za-z0-9_-]+\.jpg$/.test(kept);
}

function keptName(kept: string): string {
  if (!isKeptName(kept)) throw new Error('NOT_A_KEPT_PHOTO');

  return kept;
}

function isJson(text: string): boolean {
  try {
    JSON.parse(text);

    return true;
  } catch {
    return false;
  }
}

export const fileStore: QueueStore = {
  async read() {
    const dir = folder();

    const main = await FileSystem.getInfoAsync(`${dir}${FILE}`);

    if (main.exists) return FileSystem.readAsStringAsync(`${dir}${FILE}`);

    const temp = await FileSystem.getInfoAsync(`${dir}${TEMP}`);

    if (!temp.exists) return null;

    const text = await FileSystem.readAsStringAsync(`${dir}${TEMP}`);

    // A temporary file that is no text of a queue is handed over like any text: the queue finds it unreadable, sets it aside and tells the
    // technician. It is never taken for "nothing was kept": the phone may have stopped between the removal of the old file and the move of the
    // new one, before the new text was on the disk, and the actions the old file held are then all that is lost.
    if (!isJson(text)) return text;

    // The phone stopped between the removal of the old file and the move of the new one: the new one is put in place now.
    try {
      await FileSystem.moveAsync({ from: `${dir}${TEMP}`, to: `${dir}${FILE}` });

      return await FileSystem.readAsStringAsync(`${dir}${FILE}`);
    } catch {
      return text;
    }
  },

  async write(text) {
    const dir = folder();

    await ensureFolder(dir);

    // A move that failed after the old file was removed leaves the only good copy under the temporary name: it is put in place before anything is
    // written there, so that a write that fails half way (disk full, phone dying) cannot destroy both copies.
    const main = await FileSystem.getInfoAsync(`${dir}${FILE}`);

    if (!main.exists) {
      const temp = await FileSystem.getInfoAsync(`${dir}${TEMP}`);

      // Only a temporary file that is a queue is put in place. One that is not (a write of this run that was cut short) holds nothing the queue in
      // memory does not hold: the write below goes over it.
      if (temp.exists && isJson(await FileSystem.readAsStringAsync(`${dir}${TEMP}`))) {
        await FileSystem.moveAsync({ from: `${dir}${TEMP}`, to: `${dir}${FILE}` });
      }
    }

    try {
      await FileSystem.writeAsStringAsync(`${dir}${TEMP}`, text);
    } catch (error) {
      // What is left of a write that failed is no queue: it is removed (best effort), so that it does not stand in for the file at the next start.
      await FileSystem.deleteAsync(`${dir}${TEMP}`, { idempotent: true }).catch(() => undefined);

      throw error;
    }

    await FileSystem.deleteAsync(`${dir}${FILE}`, { idempotent: true });
    await FileSystem.moveAsync({ from: `${dir}${TEMP}`, to: `${dir}${FILE}` });
  },

  async setAside() {
    const dir = folder();
    const stamp = Date.now();
    let index = 0;

    for (const name of [FILE, TEMP]) {
      const info = await FileSystem.getInfoAsync(`${dir}${name}`);

      if (info.exists) {
        index += 1;
        await FileSystem.moveAsync({ from: `${dir}${name}`, to: `${dir}unreadable-${stamp}-${index}.json` });
      }
    }
  },

  async keepPhoto(entryId, uri) {
    const dir = `${folder()}${PHOTOS}`;
    const kept = `${PHOTOS}${safeName(entryId)}.jpg`;

    await ensureFolder(dir);
    await FileSystem.copyAsync({ from: uri, to: `${folder()}${kept}` });

    return kept;
  },

  resolvePhoto(kept) {
    return `${folder()}${keptName(kept)}`;
  },

  async dropPhoto(kept) {
    // Only what this store made: a wrong name never deletes anything else on the phone.
    if (!isKeptName(kept)) return;

    await FileSystem.deleteAsync(`${folder()}${kept}`, { idempotent: true });
  },

  async photoExists(kept) {
    if (!isKeptName(kept)) return false;

    const info = await FileSystem.getInfoAsync(`${folder()}${kept}`);

    return info.exists;
  },

  async sweep(keep) {
    const dir = `${folder()}${PHOTOS}`;
    const info = await FileSystem.getInfoAsync(dir);

    if (!info.exists) return;

    const wanted = new Set(keep);

    for (const name of await FileSystem.readDirectoryAsync(dir)) {
      if (!wanted.has(`${PHOTOS}${name}`)) await FileSystem.deleteAsync(`${dir}${name}`, { idempotent: true });
    }
  },
};
