import { createDecipheriv, createHash, createHmac, createCipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const DIGEST = 'sha256';

export interface EncryptionResult {
  iv: string;
  authTag: string;
  content: string;
}

export function deriveKey(secret: string): Buffer {
  return createHash(DIGEST).update(secret).digest();
}

export function encrypt(plainText: string, secret: string): EncryptionResult {
  const key = deriveKey(secret);
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    content: encrypted.toString('hex'),
  };
}

export function decrypt(result: EncryptionResult, secret: string): string {
  const key = deriveKey(secret);
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(result.iv, 'hex'));
  decipher.setAuthTag(Buffer.from(result.authTag, 'hex'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(result.content, 'hex')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

export function hmac(content: string, secret: string): string {
  return createHmac(DIGEST, secret).update(content).digest('hex');
}

