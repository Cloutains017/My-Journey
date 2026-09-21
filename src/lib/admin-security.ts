import { createHmac, randomUUID } from 'node:crypto';

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const PHOTO_MAX_BYTES = 50 * 1024 * 1024;
const photoTypes: Record<string,string> = { 'image/jpeg':'jpg', 'image/png':'png', 'image/webp':'webp', 'image/gif':'gif', 'image/avif':'avif', 'image/heic':'heic', 'image/heif':'heif' };

export function isTrustedAdminRequest(request: Request): boolean {
  if (request.headers.get('sec-fetch-site') === 'cross-site') return false;
  if (['GET','HEAD','OPTIONS'].includes(request.method)) return true;
  // Next's internal URL can normalize the hostname to localhost. The Host
  // header is the browser's actual destination; don't trust forwarded-host.
  const destination = new URL(request.url);
  destination.host = request.headers.get('host') || destination.host;
  return request.headers.get('origin') === destination.origin;
}

export function loginSource(request: Request, secret: string, vercel: boolean): string {
  // Vercel replaces x-forwarded-for. Do not trust arbitrary headers on other hosts.
  const source = vercel ? (request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown') : 'local';
  return createHmac('sha256',secret).update(source).digest('hex');
}

export function createPhotoKey(tripId: unknown, contentType: unknown): string {
  if (typeof tripId !== 'string' || !UUID.test(tripId) || typeof contentType !== 'string' || !Object.hasOwn(photoTypes,contentType)) throw new Error('无效的旅程或图片类型');
  return `${tripId}/${randomUUID()}.${photoTypes[contentType]}`;
}

export function registeredPhotoKey(url: unknown, tripId: string, base: string): string {
  if (typeof url !== 'string' || !UUID.test(tripId)) throw new Error('无效的图片地址');
  const prefix = `${base.replace(/\/$/,'')}/${tripId}/`;
  if (!url.startsWith(prefix)) throw new Error('图片不属于当前旅程');
  const file = url.slice(prefix.length);
  const [id,extension,...extra] = file.split('.');
  if (!UUID.test(id) || extra.length || !Object.values(photoTypes).includes(extension)) throw new Error('无效的图片路径');
  return `${tripId}/${file}`;
}
