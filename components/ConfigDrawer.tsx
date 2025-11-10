import React, { useEffect, useMemo, useState } from 'react';

import type {
  AdapterConfigUpdateRequest,
  AdapterConfigUpdateResponse,
  AdapterConfigViewModel,
  DashboardConfigAuth,
} from '../types';

interface ConfigDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  loadConfig: () => Promise<AdapterConfigViewModel>;
  updateConfig: (payload: AdapterConfigUpdateRequest) => Promise<AdapterConfigUpdateResponse>;
  updateSecrets: (payload: AdapterSecretUpdateRequest) => Promise<AdapterSecretUpdateResponse>;
}

interface EditableConfigForm {
  obmBaseUrl: string;
  obmEventEndpoint: string;
  obmAuthMethod: DashboardConfigAuth['method'];
  obmUsername: string;
  obmAllowSelfSigned: boolean;
  scomXmlDirectory: string;
  scomFilePattern: string;
  scomPollingIntervalMs: string;
  scomMaxFileSizeMb: string;
}

interface SecretFormState {
  password: string;
  apiKey: string;
}

const buildForm = (config: AdapterConfigViewModel): EditableConfigForm => ({
  obmBaseUrl: config.obm.baseUrl,
  obmEventEndpoint: config.obm.eventEndpoint,
  obmAuthMethod: config.obm.auth.method,
  obmUsername: config.obm.auth.username ?? '',
  obmAllowSelfSigned: config.obm.tls.allowSelfSigned ?? false,
  scomXmlDirectory: config.scom.xmlDirectory,
  scomFilePattern: config.scom.filePattern,
  scomPollingIntervalMs: config.scom.pollingIntervalMs.toString(),
  scomMaxFileSizeMb: config.scom.maxFileSizeMb.toString(),
});

const validateForm = (form: EditableConfigForm): string[] => {
  const messages: string[] = [];
  if (!form.obmBaseUrl.trim()) {
    messages.push('OBM base URL is required.');
  }
  if (!form.obmEventEndpoint.trim()) {
    messages.push('OBM event endpoint is required.');
  }
  if (!form.scomXmlDirectory.trim()) {
    messages.push('SCOM XML directory is required.');
  }
  const polling = Number(form.scomPollingIntervalMs);
  if (!Number.isFinite(polling) || polling <= 0) {
    messages.push('Polling interval must be a positive number.');
  }
  const maxFileSize = Number(form.scomMaxFileSizeMb);
  if (!Number.isFinite(maxFileSize) || maxFileSize <= 0) {
    messages.push('Max file size must be a positive number.');
  }
  return messages;
};

const ConfigDrawer: React.FC<ConfigDrawerProps> = ({
  isOpen,
  onClose,
  loadConfig,
  updateConfig,
  updateSecrets,
}) => {
  const [config, setConfig] = useState<AdapterConfigViewModel | null>(null);
  const [form, setForm] = useState<EditableConfigForm | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [requiresRestart, setRequiresRestart] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [secretForm, setSecretForm] = useState<SecretFormState>({ password: '', apiKey: '' });
  const [secretSaving, setSecretSaving] = useState(false);
  const [secretError, setSecretError] = useState<string | null>(null);
  const [secretSuccess, setSecretSuccess] = useState<string | null>(null);
  const [secretValidationErrors, setSecretValidationErrors] = useState<string[]>([]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setLoading(true);
    setError(null);
    setSaveError(null);
    setSaveSuccess(null);
    setRequiresRestart(false);
    setSecretError(null);
    setSecretSuccess(null);
    setSecretValidationErrors([]);
    setSecretForm({ password: '', apiKey: '' });
    void loadConfig()
      .then((data) => {
        setConfig(data);
        setForm(buildForm(data));
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Unknown error loading configuration';
        setError(message);
      })
      .finally(() => setLoading(false));
  }, [isOpen, loadConfig]);

  const authSummary = useMemo(() => {
    if (!config) return null;
    const { auth } = config.obm;
    if (auth.method === 'basic') {
      return auth.username ? `Basic (user: ${auth.username})` : 'Basic authentication';
    }
    if (auth.method === 'apikey') {
      return 'API key authentication';
    }
    return 'Certificate authentication';
  }, [config]);

  const isDirty = useMemo(() => {
    if (!config || !form) {
      return false;
    }
    const baseline = buildForm(config);
    return Object.keys(baseline).some((key) => baseline[key as keyof EditableConfigForm] !== form[key as keyof EditableConfigForm]);
  }, [config, form]);

  const handleFieldChange = <K extends keyof EditableConfigForm>(key: K, value: EditableConfigForm[K]) => {
    setForm((previous) => (previous ? { ...previous, [key]: value } : previous));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaveError(null);
    setSaveSuccess(null);
    if (!form) {
      return;
    }
    const issues = validateForm(form);
    setValidationErrors(issues);
    if (issues.length > 0) {
      return;
    }

    const payload: AdapterConfigUpdateRequest = {
      obm: {
        baseUrl: form.obmBaseUrl.trim(),
        eventEndpoint: form.obmEventEndpoint.trim(),
        auth: {
          method: form.obmAuthMethod,
          username: form.obmAuthMethod === 'basic' ? form.obmUsername.trim() || undefined : undefined,
        },
        tls: {
          allowSelfSigned: form.obmAllowSelfSigned,
        },
      },
      scom: {
        xmlDirectory: form.scomXmlDirectory.trim(),
        filePattern: form.scomFilePattern.trim() || '*.xml',
        pollingIntervalMs: Number(form.scomPollingIntervalMs),
        maxFileSizeMb: Number(form.scomMaxFileSizeMb),
      },
    };

    setSaving(true);
    try {
      const response = await updateConfig(payload);
      setConfig(response);
      setForm(buildForm(response));
      setSaveSuccess(response.meta.requiresRestart
        ? 'Configuration updated. Restart required for some changes.'
        : 'Configuration updated successfully.');
      setRequiresRestart(response.meta.requiresRestart);
      setValidationErrors([]);
    } catch (updateErr) {
      const message =
        updateErr instanceof Error ? updateErr.message : 'Failed to update configuration.';
      setSaveError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleSecretFieldChange = <K extends keyof SecretFormState>(key: K, value: SecretFormState[K]) => {
    setSecretForm((previous) => ({ ...previous, [key]: value }));
  };

  const handleSecretSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSecretError(null);
    setSecretSuccess(null);
    setSecretValidationErrors([]);
    if (!config) return;

    const payload: AdapterSecretUpdateRequest = {};
    if (config.obm.auth.method === 'basic' && secretForm.password.trim()) {
      payload.obm = { ...(payload.obm ?? {}), password: secretForm.password.trim() };
    }
    if (config.obm.auth.method === 'apikey' && secretForm.apiKey.trim()) {
      payload.obm = { ...(payload.obm ?? {}), apiKey: secretForm.apiKey.trim() };
    }

    if (!payload.obm || Object.keys(payload.obm).length === 0) {
      setSecretValidationErrors([
        config.obm.auth.method === 'basic'
          ? 'Provide a new password to rotate the OBM credential.'
          : 'Provide a new API key to rotate the OBM credential.',
      ]);
      return;
    }

    setSecretSaving(true);
    try {
      const response = await updateSecrets(payload);
      setSecretSuccess(response.message);
      setSecretForm({ password: '', apiKey: '' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update secrets.';
      setSecretError(message);
    } finally {
      setSecretSaving(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 flex items-stretch justify-end bg-black/50 backdrop-blur-sm">
      <div className="relative flex h-full w-full max-w-4xl flex-col overflow-hidden border-l border-cyan-700/40 bg-gray-950/95 shadow-2xl shadow-cyan-500/20">
        <header className="flex items-start justify-between border-b border-gray-800/80 bg-black/40 px-6 py-5">
          <div>
            <h2 className="text-xl font-semibold text-white">Adapter configuration</h2>
            <p className="text-sm text-gray-400">
              Adjust OBM connectivity and SCOM ingestion settings. Credentials remain managed through the secure store.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-700 bg-gray-800 px-3 py-1 text-sm font-medium text-gray-300 transition hover:bg-gray-700 hover:text-white"
          >
            Close
          </button>
        </header>

        <main className="flex-1 overflow-y-auto px-6 py-6">
          {loading ? (
            <div className="rounded-md border border-cyan-500/30 bg-cyan-500/10 p-4 text-sm text-cyan-100">
              Loading configuration…
            </div>
          ) : null}
          {error ? (
            <div className="rounded-md border border-rose-500/30 bg-rose-900/30 p-4 text-sm text-rose-100">
              {error}
            </div>
          ) : null}

          {!loading && !error && config && form ? (
            <form className="space-y-8" onSubmit={handleSubmit}>
              <section className="rounded-lg border border-gray-800 bg-gray-900/60 p-5 shadow-inner shadow-black/20">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white">OBM connectivity</h3>
                  <span className="text-xs uppercase tracking-wide text-gray-500">{authSummary}</span>
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="flex flex-col text-sm text-gray-200">
                    Base URL
                    <input
                      type="url"
                      className="mt-1 rounded-md border border-gray-700 bg-gray-950 px-3 py-2 font-mono text-sm text-gray-100 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                      value={form.obmBaseUrl}
                      onChange={(event) => handleFieldChange('obmBaseUrl', event.target.value)}
                      required
                    />
                  </label>
                  <label className="flex flex-col text-sm text-gray-200">
                    Event endpoint
                    <input
                      type="text"
                      className="mt-1 rounded-md border border-gray-700 bg-gray-950 px-3 py-2 font-mono text-sm text-gray-100 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                      value={form.obmEventEndpoint}
                      onChange={(event) => handleFieldChange('obmEventEndpoint', event.target.value)}
                      required
                    />
                  </label>
                  <label className="flex flex-col text-sm text-gray-200">
                    Authentication method
                    <select
                      className="mt-1 rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                      value={form.obmAuthMethod}
                      onChange={(event) =>
                        handleFieldChange('obmAuthMethod', event.target.value as DashboardConfigAuth['method'])
                      }
                    >
                      <option value="basic">Basic</option>
                      <option value="apikey">API key</option>
                      <option value="certificate">Certificate</option>
                    </select>
                  </label>
                  {form.obmAuthMethod === 'basic' ? (
                    <label className="flex flex-col text-sm text-gray-200">
                      Username
                      <input
                        type="text"
                        className="mt-1 rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                        value={form.obmUsername}
                        onChange={(event) => handleFieldChange('obmUsername', event.target.value)}
                      />
                    </label>
                  ) : (
                    <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100">
                      Secrets such as API keys or certificates are stored securely via the credential store. Use the CLI or
                      operations runbook to rotate them.
                    </div>
                  )}
                  <label className="flex items-center gap-3 text-sm text-gray-200">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-700 bg-gray-950 text-cyan-500 focus:ring-cyan-500"
                      checked={form.obmAllowSelfSigned}
                      onChange={(event) => handleFieldChange('obmAllowSelfSigned', event.target.checked)}
                    />
                    Allow self-signed certificates
                  </label>
                </div>
              </section>

              <section className="rounded-lg border border-gray-800 bg-gray-900/60 p-5 shadow-inner shadow-black/20">
                <h3 className="text-lg font-semibold text-white">SCOM ingestion</h3>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="flex flex-col text-sm text-gray-200 sm:col-span-2">
                    XML directory
                    <input
                      type="text"
                      className="mt-1 rounded-md border border-gray-700 bg-gray-950 px-3 py-2 font-mono text-sm text-gray-100 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                      value={form.scomXmlDirectory}
                      onChange={(event) => handleFieldChange('scomXmlDirectory', event.target.value)}
                      required
                    />
                  </label>
                  <label className="flex flex-col text-sm text-gray-200">
                    File pattern
                    <input
                      type="text"
                      className="mt-1 rounded-md border border-gray-700 bg-gray-950 px-3 py-2 font-mono text-sm text-gray-100 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                      value={form.scomFilePattern}
                      onChange={(event) => handleFieldChange('scomFilePattern', event.target.value)}
                    />
                  </label>
                  <label className="flex flex-col text-sm text-gray-200">
                    Polling interval (ms)
                    <input
                      type="number"
                      min={1000}
                      step={500}
                      className="mt-1 rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                      value={form.scomPollingIntervalMs}
                      onChange={(event) => handleFieldChange('scomPollingIntervalMs', event.target.value)}
                      required
                    />
                  </label>
                  <label className="flex flex-col text-sm text-gray-200">
                    Max file size (MB)
                    <input
                      type="number"
                      min={1}
                      className="mt-1 rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                      value={form.scomMaxFileSizeMb}
                      onChange={(event) => handleFieldChange('scomMaxFileSizeMb', event.target.value)}
                      required
                    />
                  </label>
                </div>
              </section>

              {validationErrors.length > 0 ? (
                <div className="rounded-md border border-rose-500/30 bg-rose-900/30 p-4 text-sm text-rose-100">
                  <h4 className="font-semibold">Please correct the following:</h4>
                  <ul className="mt-2 list-disc space-y-1 pl-4">
                    {validationErrors.map((message) => (
                      <li key={message}>{message}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {saveError ? (
                <div className="rounded-md border border-rose-500/30 bg-rose-900/30 p-4 text-sm text-rose-100">
                  {saveError}
                </div>
              ) : null}
              {saveSuccess ? (
                <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-100">
                  {saveSuccess}
                </div>
              ) : null}

              <div className="flex items-center justify-end gap-3">
                {requiresRestart ? (
                  <span className="text-xs font-medium uppercase tracking-wide text-amber-300">
                    Restart required for some changes
                  </span>
                ) : null}
                <button
                  type="submit"
                  disabled={!isDirty || saving}
                  className="inline-flex items-center gap-2 rounded-md border border-cyan-500/60 bg-cyan-500/20 px-5 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? 'Saving…' : isDirty ? 'Save changes' : 'Up to date'}
                </button>
              </div>
            </form>
          ) : null}

          {!loading && !error && config ? (
            <section className="mt-10 rounded-lg border border-gray-800 bg-gray-900/60 p-5 shadow-inner shadow-black/20">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">Credential rotation</h3>
                <span className="text-xs uppercase tracking-wide text-gray-500">
                  {config.obm.auth.method === 'basic'
                    ? 'Basic authentication secret'
                    : config.obm.auth.method === 'apikey'
                    ? 'API key authentication secret'
                    : 'Certificate authentication managed externally'}
                </span>
              </div>
              {config.obm.auth.method === 'certificate' ? (
                <div className="mt-4 rounded-md border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100">
                  Certificate-based authentication must be rotated via the underlying TLS files and secret management tooling.
                </div>
              ) : (
                <form className="mt-4 space-y-4" onSubmit={handleSecretSubmit}>
                  {config.obm.auth.method === 'basic' ? (
                    <label className="flex flex-col text-sm text-gray-200">
                      New password
                      <input
                        type="password"
                        className="mt-1 rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                        value={secretForm.password}
                        onChange={(event) => handleSecretFieldChange('password', event.target.value)}
                        placeholder="Enter new OBM password"
                      />
                    </label>
                  ) : null}
                  {config.obm.auth.method === 'apikey' ? (
                    <label className="flex flex-col text-sm text-gray-200">
                      New API key
                      <input
                        type="text"
                        className="mt-1 rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                        value={secretForm.apiKey}
                        onChange={(event) => handleSecretFieldChange('apiKey', event.target.value)}
                        placeholder="Enter new OBM API key"
                      />
                    </label>
                  ) : null}

                  {secretValidationErrors.length > 0 ? (
                    <div className="rounded-md border border-rose-500/30 bg-rose-900/30 p-4 text-sm text-rose-100">
                      <ul className="list-disc space-y-1 pl-4">
                        {secretValidationErrors.map((message) => (
                          <li key={message}>{message}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {secretError ? (
                    <div className="rounded-md border border-rose-500/30 bg-rose-900/30 p-4 text-sm text-rose-100">
                      {secretError}
                    </div>
                  ) : null}
                  {secretSuccess ? (
                    <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-100">
                      {secretSuccess}
                    </div>
                  ) : null}

                  <div className="flex items-center justify-end">
                    <button
                      type="submit"
                      disabled={secretSaving}
                      className="inline-flex items-center gap-2 rounded-md border border-indigo-500/60 bg-indigo-500/20 px-5 py-2 text-sm font-semibold text-indigo-100 transition hover:bg-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {secretSaving ? 'Rotating…' : 'Rotate secret'}
                    </button>
                  </div>
                </form>
              )}
            </section>
          ) : null}
        </main>

        <footer className="border-t border-gray-800/80 bg-black/40 px-6 py-4 text-xs text-gray-500">
          Secrets are stored using the configured credential store. Rotating a secret triggers audit logging and takes effect
          immediately for new outbound OBM requests.
        </footer>
      </div>
    </div>
  );
};

export default ConfigDrawer;

