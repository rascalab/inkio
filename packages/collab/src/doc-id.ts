/** Upper bound for a room id that is also used as an IndexedDB name. */
export const MAX_DOC_ID_LENGTH = 256;

export function assertValidDocId(docId: string): void {
  if (typeof docId !== 'string' || docId.trim() === '') {
    throw new Error('[inkio/collab] `docId` must be a non-empty string.');
  }
  if (docId.length > MAX_DOC_ID_LENGTH) {
    throw new Error(`[inkio/collab] \`docId\` exceeds ${MAX_DOC_ID_LENGTH} characters.`);
  }
}
