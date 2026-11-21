/** Maximum UTF-8 byte length of a room id. */
export const MAX_DOC_ID_LENGTH = 256;
const ROOM_ID = /^[\p{L}\p{N}][\p{L}\p{N}\p{M}._-]*$/u;

export function assertValidDocId(docId: string): void {
  if (
    typeof docId !== 'string' ||
    docId.length > MAX_DOC_ID_LENGTH ||
    !ROOM_ID.test(docId) ||
    new TextEncoder().encode(docId).length > MAX_DOC_ID_LENGTH ||
    Object.prototype.hasOwnProperty.call(Object.prototype, docId)
  ) {
    throw new Error(
      `[inkio/collab] invalid \`docId\`: start with a letter or number and use at most ${MAX_DOC_ID_LENGTH} UTF-8 bytes of letters, numbers, marks, ".", "_" or "-".`,
    );
  }
}
