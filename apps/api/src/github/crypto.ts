/**
 * Small crypto helpers for the GitHub module (node:crypto only, no deps).
 */
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

/** Unguessable id (sessions, OAuth state). */
export const randomId = (bytes = 32) => randomBytes(bytes).toString('base64url');

/** Sessions are stored by hash, so a leaked database does not leak usable session ids. */
export const hashId = (id: string) => createHash('sha256').update(id).digest('base64url');

/**
 * AES-256-GCM with a key derived from the session secret. Output:
 * base64url(iv | tag | ciphertext). Tampering makes decrypt throw.
 */
export function encrypt(secret: string, plain: string): string {
  const key = createHash('sha256').update(secret).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64url');
}

export function decrypt(secret: string, sealed: string): string {
  const key = createHash('sha256').update(secret).digest();
  const raw = Buffer.from(sealed, 'base64url');
  const decipher = createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');
}

/** HMAC-SHA256 signature as GitHub sends it in `X-Hub-Signature-256`. */
export const signPayload = (secret: string, body: Buffer | string) =>
  `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;

/** Checks a webhook signature in constant time. */
export function verifySignature(secret: string, body: Buffer, header: string | undefined) {
  if (!header) return false;
  const expected = Buffer.from(signPayload(secret, body));
  const given = Buffer.from(header);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
