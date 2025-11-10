import axios from 'axios';

import { ObmApiClient } from '@/services/obm-api-client.service';
import { configService } from '@/config/config.service';
import { credentialStore } from '@/security/credential.store';

describe('ObmApiClient', () => {
  const baseConfig = {
    obm: {
      baseUrl: 'https://obm.example.com',
      eventEndpoint: '/opr-web/rest/9.10/event_list',
      auth: {
        method: 'basic',
        username: 'adapter',
        password: 'secret',
      },
      tls: {
        verify: true,
        minVersion: 'TLSv1.2',
        allowSelfSigned: false,
      },
      rateLimitMs: 0,
      connectionTimeoutMs: 1000,
      readTimeoutMs: 1000,
      keepAlive: true,
      maxSockets: 4,
    },
  } as const;

  const axiosInstance = {
    post: jest.fn(),
    interceptors: {
      request: {
        use: jest.fn(),
      },
    },
  };

  beforeEach(() => {
    jest.spyOn(configService, 'getConfig').mockReturnValue(baseConfig as never);
    jest.spyOn(credentialStore, 'getSecret').mockReturnValue(undefined);
    jest.spyOn(axios, 'create').mockReturnValue(axiosInstance as never);
    axiosInstance.post.mockReset();
    (axiosInstance.interceptors.request.use as jest.Mock).mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('posts events and returns normalized response', async () => {
    axiosInstance.post.mockResolvedValue({
      status: 201,
      data: { result: 'ok' },
      headers: { 'x-test': '1' },
    });

    const client = new ObmApiClient();
    client.initialize();

    const response = await client.postEvent({ event: { title: 'Test' } } as never);

    expect(axios.create).toHaveBeenCalled();
    expect(axiosInstance.post).toHaveBeenCalledWith(
      'https://obm.example.com/opr-web/rest/9.10/event_list',
      { event: { title: 'Test' } },
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: expect.stringContaining('Basic'),
        }),
      })
    );
    expect(response).toMatchObject({
      status: 201,
      data: { result: 'ok' },
      headers: { 'x-test': '1' },
    });
  });

  it('wraps response errors with descriptive message', async () => {
    axiosInstance.post.mockRejectedValue({
      response: {
        status: 500,
        statusText: 'Internal Server Error',
      },
    });

    const client = new ObmApiClient();
    client.initialize();

    await expect(client.postEvent({ event: {} } as never)).rejects.toThrow(
      /OBM API error: 500 Internal Server Error/
    );
  });

  it('wraps request errors when no response present', async () => {
    axiosInstance.post.mockRejectedValue({
      request: {},
      message: 'ECONNRESET',
    });

    const client = new ObmApiClient();
    client.initialize();

    await expect(client.postEvent({ event: {} } as never)).rejects.toThrow(
      /OBM API request failed: ECONNRESET/
    );
  });

  it('uses API key authentication when method is apikey', async () => {
    jest.spyOn(configService, 'getConfig').mockReturnValue({
      obm: {
        ...baseConfig.obm,
        auth: {
          method: 'apikey',
          apiKey: 'token123',
        },
      },
    } as never);

    const client = new ObmApiClient();
    client.initialize();
    axiosInstance.post.mockResolvedValue({ status: 200, data: {}, headers: {} });
    await client.postEvent({ event: {} } as never);

    expect(axiosInstance.post).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-API-Key': 'token123',
        }),
      })
    );
  });

  it('reads credentials from credential store when alias provided', async () => {
    jest.spyOn(credentialStore, 'getSecret').mockReturnValue('stored-secret');
    jest.spyOn(configService, 'getConfig').mockReturnValue({
      obm: {
        ...baseConfig.obm,
        auth: {
          method: 'basic',
          credentialAlias: 'obm.password',
          username: 'adapter',
        },
      },
    } as never);

    const client = new ObmApiClient();
    client.initialize();
    axiosInstance.post.mockResolvedValue({ status: 200, data: {}, headers: {} });
    await client.postEvent({ event: {} } as never);

    expect(credentialStore.getSecret).toHaveBeenCalledWith('obm.password');
  });
});

