import request from 'supertest';

import { createApp } from '@/server/app';
import { configService } from '@/config/config.service';
import { credentialStore } from '@/security/credential.store';

describe('Config routes', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns sanitized configuration snapshot', async () => {
    const app = createApp();

    const response = await request(app).get('/api/config');

    expect(response.status).toBe(200);
    expect(response.body.obm).toBeDefined();
    expect(response.body.obm.auth.password).toBeUndefined();
    expect(response.body.obm.auth.apiKey).toBeUndefined();
    expect(response.body.obm.auth.hasPassword).toBe(true);
    expect(response.body.obm.auth.hasApiKey).toBe(false);
    expect(response.body.security.encryptionKey).toBeUndefined();
    expect(response.body.security.hasEncryptionKey).toBe(false);
  });

  it('applies configuration updates and reports restart requirement', async () => {
    const app = createApp();
    const currentConfig = configService.getConfig();
    const updatedConfig = structuredClone(currentConfig);
    updatedConfig.obm.baseUrl = 'https://updated-obm.example.com';

    jest.spyOn(configService, 'updateConfig').mockResolvedValue({
      config: updatedConfig,
      requiresRestart: true,
      changedKeys: ['obm.baseUrl'],
    });

    const response = await request(app)
      .patch('/api/config')
      .send({
        obm: {
          baseUrl: updatedConfig.obm.baseUrl,
        },
      });

    expect(response.status).toBe(202);
    expect(response.body.obm.baseUrl).toBe(updatedConfig.obm.baseUrl);
    expect(response.body.meta.requiresRestart).toBe(true);
    expect(response.body.meta.changedKeys).toContain('obm.baseUrl');
  });

  it('updates secrets via credential store', async () => {
    const app = createApp();
    const setSecretSpy = jest.spyOn(credentialStore, 'setSecret').mockImplementation(() => undefined);

    const response = await request(app)
      .post('/api/config/secrets')
      .send({
        obm: {
          password: 'SuperSecret!',
        },
      });

    expect(response.status).toBe(200);
    expect(response.body.updated).toContain('obm.password');
    expect(setSecretSpy).toHaveBeenCalledWith('obm.password', 'SuperSecret!');
  });
});


