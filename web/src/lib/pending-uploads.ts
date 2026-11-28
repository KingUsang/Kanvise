/**
 * How many changes are saved on this device but not uploaded yet (01-app-shell
 * SH-06, SH-13). The account menu asks before signing out when this is above
 * zero. The device save queue (build step 1, FEAT-006) replaces this body;
 * until it exists nothing is ever waiting, so it returns 0.
 */
export async function getPendingUploadCount(): Promise<number> {
  return 0
}
