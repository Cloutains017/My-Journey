export const UPLOAD_WINDOW_MS = 10 * 60_000;

export function isUploadWindowOpen(issuedAt: number, now = Date.now()) {
  return now - issuedAt < UPLOAD_WINDOW_MS;
}
