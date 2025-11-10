import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ConfigDrawer from '../ConfigDrawer';
import type {
  AdapterConfigUpdateRequest,
  AdapterConfigUpdateResponse,
  AdapterConfigViewModel,
  AdapterSecretUpdateRequest,
  AdapterSecretUpdateResponse,
} from '../../types';

const createConfig = (overrides?: Partial<AdapterConfigViewModel>): AdapterConfigViewModel => ({
  environment: 'development',
  obm: {
    baseUrl: 'https://obm.example.com',
    eventEndpoint: '/opr-web/rest/9.10/event_list',
    auth: {
      method: 'basic',
      username: 'obm_user',
      credentialAlias: undefined,
      tokenEndpoint: undefined,
      audience: undefined,
      hasPassword: true,
      hasApiKey: false,
    },
    tls: {
      verify: true,
      minVersion: 'TLSv1.2',
      allowSelfSigned: false,
    },
    rateLimitMs: 500,
    connectionTimeoutMs: 30000,
    readTimeoutMs: 60000,
    keepAlive: true,
    maxSockets: 10,
  },
  scom: {
    xmlDirectory: 'C:/scm/events',
    filePattern: '*.xml',
    pollingIntervalMs: 30000,
    encoding: 'utf8',
    concurrentParsers: 2,
    schemaPath: undefined,
    maxFileSizeMb: 100,
  },
  processing: {
    batchSize: 50,
    batchTimeoutMs: 10000,
    maxConcurrentBatches: 4,
    queueCapacity: 1000,
    rateLimitMs: 500,
    maxEventsPerFile: 1000,
  },
  retry: {
    maxAttempts: 5,
    initialDelayMs: 1000,
    maxDelayMs: 16000,
    backoffMultiplier: 2,
    jitterFactor: 0.2,
    retryableStatusCodes: [429, 500, 502, 503, 504],
    retryableErrors: ['ECONNREFUSED', 'ETIMEDOUT'],
    budgetPerMinute: 500,
  },
  circuitBreaker: {
    failureThreshold: 10,
    successThreshold: 3,
    timeoutMs: 60000,
    volumeThreshold: 20,
    errorThresholdPercentage: 50,
    halfOpenMaxCalls: 5,
  },
  dlq: {
    enabled: true,
    directory: './data/dlq',
    fileName: 'dlq.jsonl',
    maxFileSizeMb: 100,
    maxEvents: 10000,
    rotationStrategy: 'size',
    retentionDays: 90,
    alertThreshold: 100,
  },
  logging: {
    level: 'info',
    prettyPrint: false,
    directory: './logs',
    maxSizeMb: 100,
    maxFiles: 7,
    includeRequestId: true,
    redact: ['password', 'apiKey'],
  },
  metrics: {
    enabled: true,
    port: 9090,
    path: '/metrics',
    defaultLabels: { service: 'scom-obm-adapter' },
  },
  dashboard: {
    enabled: true,
    port: 3000,
    host: '0.0.0.0',
    corsOrigins: ['http://localhost:5173'],
    sessionTimeoutMinutes: 30,
  },
  audit: {
    directory: './logs/audit',
    retentionDays: 90,
    maxFileSizeMb: 100,
    exportDirectory: './logs/audit/exports',
  },
  security: {
    credentialStore: 'file',
    credentialStoreNamespace: 'local',
    redactFields: ['password', 'apiKey'],
    hasEncryptionKey: true,
  },
  monitoring: {
    alertEvaluationIntervalMs: 60000,
    alertRules: [],
  },
  ...overrides,
});

const createUpdateResponse = (
  config: AdapterConfigViewModel,
  overrides?: Partial<AdapterConfigUpdateResponse['meta']>
): AdapterConfigUpdateResponse => ({
  ...config,
  meta: {
    requiresRestart: false,
    changedKeys: [],
    ...overrides,
  },
});

describe('ConfigDrawer', () => {
  const user = userEvent.setup();

  const baseConfig = createConfig();
  const loadConfigMock = vi.fn<[], Promise<AdapterConfigViewModel>>().mockResolvedValue(baseConfig);
  const updateConfigMock = vi
    .fn<[AdapterConfigUpdateRequest], Promise<AdapterConfigUpdateResponse>>()
    .mockResolvedValue(createUpdateResponse(baseConfig));
  const updateSecretsMock = vi
    .fn<[AdapterSecretUpdateRequest], Promise<AdapterSecretUpdateResponse>>()
    .mockResolvedValue({ updated: ['obm.password'], message: 'Secrets updated successfully.' });

  const renderDrawer = (configOverrides?: Partial<AdapterConfigViewModel>) => {
    const loadSpy = configOverrides
      ? vi.fn().mockResolvedValue(createConfig(configOverrides))
      : loadConfigMock;
    return render(
      <ConfigDrawer
        isOpen
        onClose={() => undefined}
        loadConfig={loadSpy}
        updateConfig={updateConfigMock}
        updateSecrets={updateSecretsMock}
      />
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    loadConfigMock.mockResolvedValue(baseConfig);
    updateConfigMock.mockResolvedValue(createUpdateResponse(baseConfig));
    updateSecretsMock.mockResolvedValue({ updated: ['obm.password'], message: 'Secrets updated successfully.' });
  });

  it('loads configuration and displays initial values', async () => {
    renderDrawer();

    await waitFor(() => expect(loadConfigMock).toHaveBeenCalled());

    expect(await screen.findByDisplayValue('https://obm.example.com')).toBeInTheDocument();
    expect(screen.getByDisplayValue('/opr-web/rest/9.10/event_list')).toBeInTheDocument();
  });

  it('validates required fields before saving', async () => {
    renderDrawer();
    await waitFor(() => screen.getByLabelText(/Base URL/i));

    const baseUrlInput = screen.getByLabelText(/Base URL/i);
    await user.clear(baseUrlInput);

    const saveButton = screen.getByRole('button', { name: /save changes/i });
    await waitFor(() => expect(saveButton).not.toBeDisabled());
    await user.click(saveButton);

    await waitFor(() =>
      expect(screen.queryByText(/Configuration updated successfully/i)).not.toBeInTheDocument()
    );
    expect(updateConfigMock).not.toHaveBeenCalled();
  });

  it('submits configuration updates when valid', async () => {
    const updatedConfig = createConfig({
      obm: {
        ...baseConfig.obm,
        baseUrl: 'https://updated.example.com',
      },
    });

    updateConfigMock.mockResolvedValueOnce(
      createUpdateResponse(updatedConfig, {
        changedKeys: ['obm.baseUrl'],
        requiresRestart: true,
      })
    );

    render(
      <ConfigDrawer
        isOpen
        onClose={() => undefined}
        loadConfig={loadConfigMock}
        updateConfig={updateConfigMock}
        updateSecrets={updateSecretsMock}
      />
    );

    await waitFor(() => screen.getByLabelText(/Base URL/i));
    const baseUrlInput = screen.getByLabelText(/Base URL/i);
    await user.clear(baseUrlInput);
    await user.type(baseUrlInput, 'https://updated.example.com');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() =>
      expect(updateConfigMock).toHaveBeenCalledWith(
        expect.objectContaining({
          obm: expect.objectContaining({
            baseUrl: 'https://updated.example.com',
          }),
        })
      )
    );

    expect(await screen.findAllByText(/Restart required for some changes/i)).not.toHaveLength(0);
  });

  it('requires secret input before rotation', async () => {
    renderDrawer();
    await waitFor(() => screen.getByLabelText(/Base URL/i));

    await user.click(screen.getByRole('button', { name: /Rotate secret/i }));

    expect(
      await screen.findByText(/Provide a new password/i)
    ).toBeInTheDocument();
    expect(updateSecretsMock).not.toHaveBeenCalled();
  });

  it('rotates password secret successfully', async () => {
    renderDrawer();
    await waitFor(() => screen.getByLabelText(/New password/i));

    await user.type(screen.getByLabelText(/New password/i), 'N3wP@ssw0rd!');
    await user.click(screen.getByRole('button', { name: /Rotate secret/i }));

    await waitFor(() =>
      expect(updateSecretsMock).toHaveBeenCalledWith(
        expect.objectContaining({
          obm: expect.objectContaining({ password: 'N3wP@ssw0rd!' }),
        })
      )
    );

    expect(
      await screen.findByText(/Secrets updated successfully/i)
    ).toBeInTheDocument();
  });

  it('supports API key rotation workflow', async () => {
    const apiKeyConfig = createConfig({
      obm: {
        ...baseConfig.obm,
        auth: {
          ...baseConfig.obm.auth,
          method: 'apikey',
          hasPassword: false,
          hasApiKey: true,
        },
      },
    });

    updateSecretsMock.mockResolvedValueOnce({ updated: ['obm.apiKey'], message: 'Secrets updated successfully.' });

    render(
      <ConfigDrawer
        isOpen
        onClose={() => undefined}
        loadConfig={vi.fn().mockResolvedValue(apiKeyConfig)}
        updateConfig={updateConfigMock}
        updateSecrets={updateSecretsMock}
      />
    );

    await waitFor(() => screen.getByPlaceholderText(/Enter new OBM API key/i));
    await user.type(screen.getByPlaceholderText(/Enter new OBM API key/i), 'api-key-123');
    await user.click(screen.getByRole('button', { name: /Rotate secret/i }));

    await waitFor(() =>
      expect(updateSecretsMock).toHaveBeenCalledWith(
        expect.objectContaining({
          obm: expect.objectContaining({ apiKey: 'api-key-123' }),
        })
      )
    );

    expect(
      await screen.findByText(/Secrets updated successfully/i)
    ).toBeInTheDocument();
  });
});

