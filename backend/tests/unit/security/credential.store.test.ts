import { existsSync, rmSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

jest.mock('@/config/config.service', () => ({
  configService: {
    getConfig: jest.fn(),
  },
}));

jest.mock('@/utils/crypto', () => ({
  encrypt: jest.fn((value: string) => ({
    iv: 'iv',
    authTag: 'tag',
    content: `enc-${value}`,
  })),
  decrypt: jest.fn(
    (payload: { content: string }) => payload.content.replace(/^enc-/, '')
  ),
}));

import { credentialStore } from '@/security/credential.store';
import { configService } from '@/config/config.service';
import { encrypt } from '@/utils/crypto';

describe('CredentialStore', () => {
  const secretsRoot = resolve(process.cwd(), 'data', 'secrets');
  const originalEnv = { ...process.env };

  beforeEach(() => {
    rmSync(secretsRoot, { recursive: true, force: true });
    (credentialStore as unknown as { cache: Map<string, string> }).cache.clear();
    (credentialStore as unknown as { ready: boolean }).ready = false;
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.ADAPTER_ENCRYPTION_KEY;
    delete process.env.OBM_TOKEN;
    delete process.env.OBM_API_KEY;
  });

  it('persists credentials to encrypted file store', () => {
    (configService.getConfig as jest.Mock).mockReturnValue({
      security: {
        credentialStore: 'file',
        credentialStoreNamespace: 'unit',
        redactFields: [],
      },
    });
    process.env.ADAPTER_ENCRYPTION_KEY = 'test-key';

    credentialStore.initialize();
    credentialStore.setSecret('obm.password', 'S3cret!');

    expect(encrypt).toHaveBeenCalledWith('S3cret!', 'test-key');
    const storedPath = resolve(secretsRoot, 'unit.json');
    expect(existsSync(storedPath)).toBe(true);
    const fileContents = JSON.parse(readFileSync(storedPath, 'utf-8')) as Record<string, unknown>;
    expect(fileContents['obm.password']).toMatchObject({
      iv: 'iv',
      authTag: 'tag',
    });
    expect(credentialStore.getSecret('obm.password')).toBe('S3cret!');
  });

  it('falls back to environment variable backend', () => {
    (configService.getConfig as jest.Mock).mockReturnValue({
      security: {
        credentialStore: 'env',
        credentialStoreNamespace: 'ignored',
        redactFields: [],
      },
    });

    credentialStore.initialize();
    credentialStore.setSecret('obm.token', 'ENV-TOKEN');

    expect(process.env.OBM_TOKEN).toBe('ENV-TOKEN');
    expect(credentialStore.getSecret('obm.token')).toBe('ENV-TOKEN');
  });

  it('reads secrets from Windows credential placeholder (env fallback)', () => {
    (configService.getConfig as jest.Mock).mockReturnValue({
      security: {
        credentialStore: 'windows',
        credentialStoreNamespace: 'ignored',
        redactFields: [],
      },
    });
    process.env.OBM_API_KEY = 'WINDOWS-KEY';

    credentialStore.initialize();
    expect(credentialStore.getSecret('obm.api.key')).toBe('WINDOWS-KEY');
  });

  it('throws if encryption key missing for file-backed store', () => {
    (configService.getConfig as jest.Mock).mockReturnValue({
      security: {
        credentialStore: 'file',
        credentialStoreNamespace: 'unit',
        redactFields: [],
      },
    });

    credentialStore.initialize();
    expect(() => credentialStore.setSecret('obm.password', 'secret')).toThrow(/Encryption key required/i);
  });
});
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { credentialStore } from '@/security/credential.store';
import { configService } from '@/config/config.service';

describe('CredentialStore', () => {
  const encryptionKey = '0123456789abcdef0123456789abcdef';

  const baseSecurityConfig = {
    security: {
      credentialStore: 'file',
      credentialStoreNamespace: 'unit-test',
      redactFields: [],
      encryptionKey,
    },
  } as const;

  let tempDir: string;
  let originalCwd: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'cred-store-'));
    originalCwd = process.cwd();
    jest.spyOn(process, 'cwd').mockReturnValue(tempDir);
    jest.spyOn(configService, 'getConfig').mockReturnValue(baseSecurityConfig as never);
    (credentialStore as unknown as { ready: boolean }).ready = false;
    (credentialStore as unknown as { cache: Map<string, string> }).cache = new Map();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
    jest.spyOn(process, 'cwd').mockReturnValue(originalCwd);
  });

  it('persists and retrieves secrets when using file store', () => {
    credentialStore.initialize();
    credentialStore.setSecret('obm.password', 's3cr3t!');
    const retrieved = credentialStore.getSecret('obm.password');

    expect(retrieved).toBe('s3cr3t!');

    const storePath = join(
      tempDir,
      'data',
      'secrets',
      `${baseSecurityConfig.security.credentialStoreNamespace}.json`
    );
    const persisted = JSON.parse(readFileSync(storePath, 'utf-8')) as Record<string, unknown>;
    expect(persisted['obm.password']).toBeDefined();
  });

  it('uses environment variables when configured to env store', () => {
    (credentialStore as unknown as { ready: boolean }).ready = false;
    (credentialStore as unknown as { cache: Map<string, string> }).cache = new Map();
    jest.spyOn(configService, 'getConfig').mockReturnValue(
      {
        security: {
          credentialStore: 'env',
          redactFields: [],
        },
      } as never
    );

    process.env.OBM_PASSWORD = 'env-secret';
    credentialStore.initialize();
    const value = credentialStore.getSecret('obm.password');
    expect(value).toBe('env-secret');
  });

  it('throws when encryption key missing for file-backed store', () => {
    (credentialStore as unknown as { ready: boolean }).ready = false;
    (credentialStore as unknown as { cache: Map<string, string> }).cache = new Map();
    jest.spyOn(configService, 'getConfig').mockReturnValue(
      {
        security: {
          credentialStore: 'file',
          credentialStoreNamespace: 'missing-key',
          redactFields: [],
        },
      } as never
    );

    expect(() => credentialStore.setSecret('obm.password', 'test')).toThrow(
      /Encryption key required/
    );
  });
});

