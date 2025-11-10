import { Router } from 'express';

import { adapterConfigUpdateSchema } from '@/config/config.schema';
import { configService } from '@/config/config.service';
import type {
  AdapterConfig,
  ObmAuthConfig,
  SecurityConfig,
} from '@/types/config';
import { credentialStore } from '@/security/credential.store';
import { logger } from '@/logger';
import { z } from 'zod';

interface SanitizedAuth
  extends Omit<ObmAuthConfig, 'password' | 'apiKey'> {
  hasPassword: boolean;
  hasApiKey: boolean;
}

interface SanitizedSecurity extends Omit<SecurityConfig, 'encryptionKey'> {
  hasEncryptionKey: boolean;
}

export interface AdapterConfigResponse
  extends Omit<AdapterConfig, 'obm' | 'security'> {
  obm: Omit<AdapterConfig['obm'], 'auth'> & { auth: SanitizedAuth };
  security: SanitizedSecurity;
}

export interface AdapterConfigUpdateResponse extends AdapterConfigResponse {
  meta: {
    requiresRestart: boolean;
    changedKeys: string[];
  };
}

const secretUpdateSchema = z.object({
  obm: z
    .object({
      password: z.string().min(1).optional(),
      apiKey: z.string().min(1).optional(),
    })
    .optional(),
});

const redactConfig = (config: AdapterConfig): AdapterConfigResponse => {
  const { obm, security, ...rest } = config;
  const hasPassword = Boolean(obm.auth.password);
  const hasApiKey = Boolean(obm.auth.apiKey);
  const sanitizedAuth: SanitizedAuth = {
    ...obm.auth,
    password: undefined,
    apiKey: undefined,
    hasPassword,
    hasApiKey,
  };

  const sanitizedSecurity: SanitizedSecurity = {
    ...security,
    encryptionKey: undefined,
    hasEncryptionKey: Boolean(security.encryptionKey),
  };

  return {
    ...rest,
    obm: {
      ...obm,
      auth: sanitizedAuth,
    },
    security: sanitizedSecurity,
  };
};

export const createConfigRouter = () => {
  const router = Router();

  router.get('/', (_req, res) => {
    const config = configService.getConfig();
    res.json(redactConfig(config));
  });

  router.patch('/', async (req, res) => {
    const parseResult = adapterConfigUpdateSchema.safeParse(req.body ?? {});
    if (!parseResult.success) {
      const message = parseResult.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ');
      return res.status(400).json({ message });
    }

    const updates = extractEditableUpdates(parseResult.data);
    if (!updates) {
      return res.status(400).json({ message: 'No editable configuration fields supplied.' });
    }

    try {
      const result = await configService.updateConfig(updates);
      const payload: AdapterConfigUpdateResponse = {
        ...redactConfig(result.config),
        meta: {
          requiresRestart: result.requiresRestart,
          changedKeys: result.changedKeys,
        },
      };
      return res.status(result.requiresRestart ? 202 : 200).json(payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update configuration';
      return res.status(400).json({ message });
    }
  });

  router.post('/secrets', async (req, res) => {
    const result = secretUpdateSchema.safeParse(req.body ?? {});
    if (!result.success) {
      const message = result.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ');
      return res.status(400).json({ message });
    }

    const updates = result.data;
    const updatedFields: string[] = [];

    if (updates.obm?.password) {
      credentialStore.setSecret('obm.password', updates.obm.password);
      updatedFields.push('obm.password');
    }

    if (updates.obm?.apiKey) {
      credentialStore.setSecret('obm.apiKey', updates.obm.apiKey);
      updatedFields.push('obm.apiKey');
    }

    if (updatedFields.length === 0) {
      return res.status(400).json({ message: 'No secrets provided for update.' });
    }

    logger().info(
      {
        component: 'ConfigRouter',
        updatedFields,
      },
      'Secrets rotated via configuration endpoint'
    );

    return res.status(200).json({
      updated: updatedFields,
      message: 'Secrets updated successfully.',
    });
  });

  return router;
};

function extractEditableUpdates(input: Record<string, unknown>) {
  const updates: Partial<AdapterConfig> = {};
  let hasChanges = false;

  if (input.obm && typeof input.obm === 'object') {
    const obmUpdate: Partial<AdapterConfig['obm']> = {};
    const source = input.obm as Record<string, unknown>;
    if (typeof source.baseUrl === 'string') {
      obmUpdate.baseUrl = source.baseUrl;
      hasChanges = true;
    }
    if (typeof source.eventEndpoint === 'string') {
      obmUpdate.eventEndpoint = source.eventEndpoint;
      hasChanges = true;
    }
    if (source.auth && typeof source.auth === 'object') {
      const authSource = source.auth as Record<string, unknown>;
      let authUpdate: Partial<ObmAuthConfig> | undefined;
      if (typeof authSource.method === 'string') {
        authUpdate = authUpdate ?? {};
        authUpdate.method = authSource.method as ObmAuthConfig['method'];
        hasChanges = true;
      }
      if (typeof authSource.username === 'string' || authSource.username === null) {
        authUpdate = authUpdate ?? {};
        authUpdate.username =
          typeof authSource.username === 'string' ? authSource.username : undefined;
        hasChanges = true;
      }
      if (typeof authSource.credentialAlias === 'string' || authSource.credentialAlias === null) {
        authUpdate = authUpdate ?? {};
        authUpdate.credentialAlias =
          typeof authSource.credentialAlias === 'string' ? authSource.credentialAlias : undefined;
        hasChanges = true;
      }
      if (authUpdate) {
        obmUpdate.auth = {
          ...(obmUpdate.auth ?? {}),
          ...authUpdate,
        };
      }
    }
    if (source.tls && typeof source.tls === 'object') {
      const tlsSource = source.tls as Record<string, unknown>;
      let tlsUpdate: Partial<AdapterConfig['obm']['tls']> | undefined;
      if (typeof tlsSource.allowSelfSigned === 'boolean') {
        tlsUpdate = tlsUpdate ?? {};
        tlsUpdate.allowSelfSigned = tlsSource.allowSelfSigned;
        hasChanges = true;
      }
      if (typeof tlsSource.minVersion === 'string') {
        tlsUpdate = tlsUpdate ?? {};
        tlsUpdate.minVersion = tlsSource.minVersion as AdapterConfig['obm']['tls']['minVersion'];
        hasChanges = true;
      }
      if (tlsUpdate) {
        obmUpdate.tls = {
          ...(obmUpdate.tls ?? {}),
          ...tlsUpdate,
        };
      }
    }
    if (Object.keys(obmUpdate).length > 0) {
      updates.obm = {
        ...(updates.obm ?? {}),
        ...obmUpdate,
      };
    }
  }

  if (input.scom && typeof input.scom === 'object') {
    const scomSource = input.scom as Record<string, unknown>;
    const scomUpdate: Partial<AdapterConfig['scom']> = {};
    if (typeof scomSource.xmlDirectory === 'string') {
      scomUpdate.xmlDirectory = scomSource.xmlDirectory;
      hasChanges = true;
    }
    if (typeof scomSource.filePattern === 'string') {
      scomUpdate.filePattern = scomSource.filePattern;
      hasChanges = true;
    }
    if (typeof scomSource.pollingIntervalMs === 'number') {
      scomUpdate.pollingIntervalMs = scomSource.pollingIntervalMs;
      hasChanges = true;
    }
    if (typeof scomSource.maxFileSizeMb === 'number') {
      scomUpdate.maxFileSizeMb = scomSource.maxFileSizeMb;
      hasChanges = true;
    }
    if (Object.keys(scomUpdate).length > 0) {
      updates.scom = {
        ...(updates.scom ?? {}),
        ...scomUpdate,
      };
    }
  }

  return hasChanges ? updates : null;
}


