import { decrypt, encrypt, hmac } from '@/utils/crypto';

describe('crypto utilities', () => {
  const secret = 'unit-test-secret';

  it('encrypts and decrypts symmetric payloads', () => {
    const result = encrypt('sensitive-data', secret);
    expect(result.content).toBeDefined();
    expect(result.iv).toHaveLength(24);
    expect(result.authTag).toHaveLength(32);

    const plain = decrypt(result, secret);
    expect(plain).toBe('sensitive-data');
  });

  it('produces deterministic hmacs', () => {
    const digest = hmac('payload', secret);
    expect(digest).toHaveLength(64);
    expect(digest).toBe(hmac('payload', secret));
    expect(digest).not.toBe(hmac('payload', 'other-secret'));
  });
});

