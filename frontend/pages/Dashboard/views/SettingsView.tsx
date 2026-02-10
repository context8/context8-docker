import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Copy,
  Database,
  Cloud,
  Server,
  Cpu,
  RefreshCw,
  Shield,
} from 'lucide-react';
import { Button } from '@/components/Common/Button';
import { ToastContainer } from '@/components/Common/Toast';
import { useToast } from '@/hooks/useToast';
import { useStatus } from '@/hooks/useStatus';
import type { StatusConfig, StatusResponse, SystemComponentStatus, ThemeMode } from '@/types';

export interface SettingsViewProps {
  theme: ThemeMode;
}

function formatUptime(seconds: number) {
  const s = Math.max(0, seconds);
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const mins = Math.floor((s % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function statusBadgeClass(status: SystemComponentStatus) {
  if (status === 'ok') return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300';
  if (status === 'disabled') return 'bg-alternative text-foreground-light';
  return 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300';
}

function dotClass(status: SystemComponentStatus) {
  if (status === 'ok') return 'bg-emerald-500';
  if (status === 'disabled') return 'bg-slate-400';
  return 'bg-rose-500';
}

function buildEmbeddingSnippet(state: {
  enabled: boolean;
  knnWeight: string;
  bm25Weight: string;
  embeddingApiUrl: string;
  embeddingStrict: boolean;
}) {
  const lines: string[] = [];
  lines.push(`# Semantic search (Elasticsearch kNN)`);
  lines.push(`ES_BM25_WEIGHT=${state.bm25Weight || '1'}`);
  lines.push(`ES_KNN_WEIGHT=${state.enabled ? (state.knnWeight || '1') : '0'}`);
  lines.push(`EMBEDDING_API_URL=${state.embeddingApiUrl || 'http://embedding:8001/embed'}`);
  lines.push(`EMBEDDING_STRICT=${state.embeddingStrict ? 'true' : 'false'}`);
  lines.push('');
  lines.push(`# Apply:`);
  lines.push(
    state.enabled
      ? `# docker compose --profile semantic up -d --build`
      : `# docker compose up -d --build`
  );
  return lines.join('\n');
}

function buildRemoteSnippet(state: {
  remoteBase: string;
  remoteApiKey: string;
  allowOverride: boolean;
  allowedHosts: string;
  timeoutSec: string;
}) {
  const lines: string[] = [];
  lines.push(`# Federation / remote Context8`);
  lines.push(`REMOTE_CONTEXT8_BASE=${state.remoteBase || 'https://api.context8.org'}`);
  lines.push(`REMOTE_CONTEXT8_API_KEY=${state.remoteApiKey || 'ctx8_...'}`);
  lines.push(`REMOTE_CONTEXT8_ALLOW_OVERRIDE=${state.allowOverride ? 'true' : 'false'}`);
  lines.push(`REMOTE_CONTEXT8_ALLOWED_HOSTS=${state.allowedHosts || ''}`);
  lines.push(`REMOTE_CONTEXT8_TIMEOUT=${state.timeoutSec || '6'}`);
  return lines.join('\n');
}

function buildCorsSnippet(state: {
  frontendPort: string;
  allowOrigins: string;
  originRegex: string;
  allowCredentials: boolean;
}) {
  const lines: string[] = [];
  lines.push(`# Frontend / CORS`);
  lines.push(`FRONTEND_PORT=${state.frontendPort || '3000'}`);
  lines.push(`CORS_ALLOW_ORIGINS=${state.allowOrigins || ''}`);
  lines.push(`CORS_ALLOW_ORIGIN_REGEX=${state.originRegex || ''}`);
  lines.push(`CORS_ALLOW_CREDENTIALS=${state.allowCredentials ? 'true' : 'false'}`);
  return lines.join('\n');
}

function safeNumber(value: unknown, fallback: number) {
  if (typeof value !== 'number') return fallback;
  if (!Number.isFinite(value)) return fallback;
  return value;
}

function safeString(value: unknown, fallback: string) {
  if (typeof value !== 'string') return fallback;
  return value;
}

function safeBool(value: unknown, fallback: boolean) {
  if (typeof value !== 'boolean') return fallback;
  return value;
}

function normalizeConfig(input?: StatusConfig | null) {
  const cfg = input || {};
  const frontendPort = safeString(cfg.frontendPort, '3000');
  const allowOrigins = Array.isArray(cfg.cors?.allowOrigins) ? cfg.cors?.allowOrigins.join(',') : '';
  const originRegex = safeString(cfg.cors?.originRegex ?? '', '');
  const allowCredentials = safeBool(cfg.cors?.allowCredentials, false);

  const bm25Weight = String(safeNumber(cfg.es?.bm25Weight, 1));
  const knnWeight = String(safeNumber(cfg.es?.knnWeight, 0));
  const enabled = safeNumber(cfg.es?.knnWeight, 0) > 0;
  const embeddingApiUrl = safeString(cfg.embedding?.apiUrl, 'http://embedding:8001/embed');
  const embeddingStrict = safeBool(cfg.embedding?.strict, false);

  const remoteBase = safeString(cfg.remote?.base, '');
  const remoteConfigured = safeBool(cfg.remote?.configured, false);
  const remoteAllowOverride = safeBool(cfg.remote?.allowOverride, false);
  const remoteAllowedHosts = Array.isArray(cfg.remote?.allowedHosts) ? cfg.remote?.allowedHosts.join(',') : '';
  const remoteTimeoutSec = String(safeNumber(cfg.remote?.timeoutSec, 6));

  return {
    frontendPort,
    allowOrigins,
    originRegex,
    allowCredentials,
    bm25Weight,
    knnWeight,
    enabled,
    embeddingApiUrl,
    embeddingStrict,
    remoteBase,
    remoteConfigured,
    remoteAllowOverride,
    remoteAllowedHosts,
    remoteTimeoutSec,
  };
}

function ComponentCard(props: {
  title: string;
  icon: React.ReactNode;
  status: SystemComponentStatus;
  lines?: Array<{ label: string; value?: string | number | null }>;
  detail?: string;
}) {
  const { title, icon, status, lines = [], detail } = props;
  return (
    <div className="p-4 rounded-xl border border-default bg-surface">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg border border-default bg-alternative flex items-center justify-center text-foreground">
          {icon}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${dotClass(status)}`} />
            <div className="text-sm font-semibold tracking-tight text-foreground">{title}</div>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span className={`inline-flex items-center px-2 py-0.5 rounded border border-default text-xs ${statusBadgeClass(status)}`}>
              {status}
            </span>
          </div>
        </div>
      </div>
      <div className="mt-3 space-y-1 text-xs text-foreground-light">
        {lines
          .filter((l) => l.value !== undefined && l.value !== null && String(l.value).length > 0)
          .map((line) => (
            <div key={line.label} className="flex items-center justify-between gap-4">
              <span>{line.label}</span>
              <span className="text-foreground">{String(line.value)}</span>
            </div>
          ))}
        {detail && (
          <div className="pt-2 text-[11px] leading-relaxed text-foreground-light">
            {detail}
          </div>
        )}
      </div>
    </div>
  );
}

function CodePanel(props: { title: string; body: string; onCopy: () => void; helper?: string }) {
  return (
    <div className="p-4 rounded-xl border border-default bg-surface">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold tracking-tight text-foreground">{props.title}</div>
          {props.helper && <div className="mt-1 text-xs text-foreground-light">{props.helper}</div>}
        </div>
        <Button variant="secondary" size="sm" onClick={props.onCopy} className="shrink-0">
          <Copy size={14} />
          <span className="ml-2">Copy</span>
        </Button>
      </div>
      <pre className="mt-3 text-xs rounded-lg border border-default bg-alternative p-3 overflow-auto custom-scrollbar">
        <code>{props.body}</code>
      </pre>
    </div>
  );
}

export const SettingsView: React.FC<SettingsViewProps> = ({ theme }) => {
  const { status, isLoading, error: statusError, refresh } = useStatus(12_000);
  const { toasts, success, error, dismiss } = useToast();
  const isDark = theme === 'dark';

  const serverConfig = useMemo(() => normalizeConfig(status?.config), [status?.config]);
  const [initialized, setInitialized] = useState(false);

  const [frontendPort, setFrontendPort] = useState(serverConfig.frontendPort);
  const [allowOrigins, setAllowOrigins] = useState(serverConfig.allowOrigins);
  const [originRegex, setOriginRegex] = useState(serverConfig.originRegex);
  const [allowCredentials, setAllowCredentials] = useState(serverConfig.allowCredentials);

  const [semanticEnabled, setSemanticEnabled] = useState(serverConfig.enabled);
  const [knnWeight, setKnnWeight] = useState(serverConfig.knnWeight);
  const [bm25Weight, setBm25Weight] = useState(serverConfig.bm25Weight);
  const [embeddingApiUrl, setEmbeddingApiUrl] = useState(serverConfig.embeddingApiUrl);
  const [embeddingStrict, setEmbeddingStrict] = useState(serverConfig.embeddingStrict);

  const [remoteBase, setRemoteBase] = useState(serverConfig.remoteBase);
  const [remoteApiKey, setRemoteApiKey] = useState('');
  const [remoteAllowOverride, setRemoteAllowOverride] = useState(serverConfig.remoteAllowOverride);
  const [remoteAllowedHosts, setRemoteAllowedHosts] = useState(serverConfig.remoteAllowedHosts);
  const [remoteTimeoutSec, setRemoteTimeoutSec] = useState(serverConfig.remoteTimeoutSec);

  useEffect(() => {
    if (initialized) return;
    if (!status?.config) return;
    setFrontendPort(serverConfig.frontendPort);
    setAllowOrigins(serverConfig.allowOrigins);
    setOriginRegex(serverConfig.originRegex);
    setAllowCredentials(serverConfig.allowCredentials);
    setSemanticEnabled(serverConfig.enabled);
    setKnnWeight(serverConfig.knnWeight);
    setBm25Weight(serverConfig.bm25Weight);
    setEmbeddingApiUrl(serverConfig.embeddingApiUrl);
    setEmbeddingStrict(serverConfig.embeddingStrict);
    setRemoteBase(serverConfig.remoteBase);
    setRemoteAllowOverride(serverConfig.remoteAllowOverride);
    setRemoteAllowedHosts(serverConfig.remoteAllowedHosts);
    setRemoteTimeoutSec(serverConfig.remoteTimeoutSec);
    setInitialized(true);
  }, [initialized, status?.config, serverConfig]);

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      success('Copied to clipboard');
    } catch {
      error('Copy failed (clipboard permissions)');
    }
  };

  const statusPayload: StatusResponse | null = status || null;
  const overall = statusPayload?.status || 'unknown';
  const updatedAt = statusPayload?.updatedAt ? new Date(statusPayload.updatedAt) : null;

  const dbComp = statusPayload?.components?.db;
  const esComp = statusPayload?.components?.es;
  const remoteComp = statusPayload?.components?.remote;
  const embedComp = statusPayload?.components?.embedding;

  const embeddingSnippet = useMemo(
    () =>
      buildEmbeddingSnippet({
        enabled: semanticEnabled,
        knnWeight,
        bm25Weight,
        embeddingApiUrl,
        embeddingStrict,
      }),
    [semanticEnabled, knnWeight, bm25Weight, embeddingApiUrl, embeddingStrict]
  );

  const remoteSnippet = useMemo(
    () =>
      buildRemoteSnippet({
        remoteBase,
        remoteApiKey,
        allowOverride: remoteAllowOverride,
        allowedHosts: remoteAllowedHosts,
        timeoutSec: remoteTimeoutSec,
      }),
    [remoteBase, remoteApiKey, remoteAllowOverride, remoteAllowedHosts, remoteTimeoutSec]
  );

  const corsSnippet = useMemo(
    () =>
      buildCorsSnippet({
        frontendPort,
        allowOrigins,
        originRegex,
        allowCredentials,
      }),
    [frontendPort, allowOrigins, originRegex, allowCredentials]
  );

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} onClose={dismiss} />

      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">Settings</h2>
          <p className="mt-1 text-sm text-foreground-light">
            Runtime status plus config snippets. Env changes require a container restart.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => void refresh()} isLoading={isLoading}>
            <RefreshCw size={14} />
            <span className="ml-2">Refresh</span>
          </Button>
        </div>
      </div>

      {statusError && (
        <div className="p-4 rounded-xl border border-default bg-surface">
          <div className="text-sm font-semibold text-foreground">Status fetch failed</div>
          <div className="mt-1 text-xs text-foreground-light">{statusError}</div>
        </div>
      )}

      <div className="p-4 rounded-xl border border-default bg-surface">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg border border-default bg-alternative flex items-center justify-center text-foreground">
              <Activity size={18} />
            </div>
            <div>
              <div className="text-sm font-semibold tracking-tight text-foreground">System</div>
              <div className="mt-1 text-xs text-foreground-light">
                Status: <span className="text-foreground">{overall}</span>
                {statusPayload?.version ? (
                  <>
                    {' '}
                    · Version <span className="text-foreground">{statusPayload.version}</span>
                  </>
                ) : null}
                {statusPayload?.environment ? (
                  <>
                    {' '}
                    · Env <span className="text-foreground">{statusPayload.environment}</span>
                  </>
                ) : null}
              </div>
            </div>
          </div>
          <div className="text-xs text-foreground-light text-right">
            <div>Uptime: <span className="text-foreground">{statusPayload ? formatUptime(statusPayload.uptimeSec) : '-'}</span></div>
            <div>Updated: <span className="text-foreground">{updatedAt ? updatedAt.toLocaleString() : '-'}</span></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ComponentCard
          title="Database"
          icon={<Database size={18} />}
          status={(dbComp?.status as SystemComponentStatus) || 'disabled'}
          detail={dbComp?.detail}
        />
        <ComponentCard
          title="Elasticsearch"
          icon={<Server size={18} />}
          status={(esComp?.status as SystemComponentStatus) || 'disabled'}
          lines={[
            { label: 'Index', value: esComp?.index },
            { label: 'Index exists', value: typeof esComp?.indexExists === 'boolean' ? String(esComp.indexExists) : '' },
            { label: 'Version', value: esComp?.version },
          ]}
          detail={esComp?.detail}
        />
        <ComponentCard
          title="Remote"
          icon={<Cloud size={18} />}
          status={(remoteComp?.status as SystemComponentStatus) || 'disabled'}
          lines={[
            { label: 'Base', value: remoteComp?.base },
            { label: 'Total', value: typeof remoteComp?.total === 'number' ? remoteComp.total : null },
          ]}
          detail={remoteComp?.detail}
        />
        <ComponentCard
          title="Embedding"
          icon={<Cpu size={18} />}
          status={(embedComp?.status as SystemComponentStatus) || 'disabled'}
          lines={[
            { label: 'Health', value: embedComp?.healthUrl },
          ]}
          detail={embedComp?.detail}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div className="p-4 rounded-xl border border-default bg-surface">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold tracking-tight text-foreground">Semantic search</div>
                <div className="mt-1 text-xs text-foreground-light">
                  Enable ES kNN. When enabled, start the embedding container profile.
                </div>
              </div>
              <label className="inline-flex items-center gap-2 text-xs text-foreground-light select-none">
                <input
                  type="checkbox"
                  checked={semanticEnabled}
                  onChange={(e) => setSemanticEnabled(e.target.checked)}
                />
                Enable
              </label>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1 text-foreground-light">ES_KNN_WEIGHT</label>
                <input
                  type="text"
                  value={knnWeight}
                  onChange={(e) => setKnnWeight(e.target.value)}
                  className="dash-input h-10"
                  placeholder="1"
                  disabled={!semanticEnabled}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 text-foreground-light">ES_BM25_WEIGHT</label>
                <input
                  type="text"
                  value={bm25Weight}
                  onChange={(e) => setBm25Weight(e.target.value)}
                  className="dash-input h-10"
                  placeholder="1"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium mb-1 text-foreground-light">EMBEDDING_API_URL</label>
                <input
                  type="text"
                  value={embeddingApiUrl}
                  onChange={(e) => setEmbeddingApiUrl(e.target.value)}
                  className="dash-input h-10"
                  placeholder="http://embedding:8001/embed"
                />
              </div>
              <div className="md:col-span-2 flex items-center justify-between gap-4">
                <label className="inline-flex items-center gap-2 text-xs text-foreground-light select-none">
                  <input
                    type="checkbox"
                    checked={embeddingStrict}
                    onChange={(e) => setEmbeddingStrict(e.target.checked)}
                  />
                  Strict embedding (fail hard if embedding service is down)
                </label>
                <div className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                  Current: kNN weight {typeof status?.config?.es?.knnWeight === 'number' ? status.config.es.knnWeight : '-'}
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-default bg-surface">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold tracking-tight text-foreground">Federation</div>
                <div className="mt-1 text-xs text-foreground-light">
                  Configure a default remote. Optionally allow per-request overrides (recommended: keep disabled).
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-foreground-light">
                <Shield size={14} />
                <span>{serverConfig.remoteConfigured ? 'Configured' : 'Not configured'}</span>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <label className="block text-xs font-medium mb-1 text-foreground-light">REMOTE_CONTEXT8_BASE</label>
                <input
                  type="text"
                  value={remoteBase}
                  onChange={(e) => setRemoteBase(e.target.value)}
                  className="dash-input h-10"
                  placeholder="https://api.context8.org"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium mb-1 text-foreground-light">REMOTE_CONTEXT8_API_KEY (secret)</label>
                <input
                  type="password"
                  value={remoteApiKey}
                  onChange={(e) => setRemoteApiKey(e.target.value)}
                  className="dash-input h-10"
                  placeholder="ctx8_..."
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 text-foreground-light">REMOTE_CONTEXT8_TIMEOUT</label>
                <input
                  type="text"
                  value={remoteTimeoutSec}
                  onChange={(e) => setRemoteTimeoutSec(e.target.value)}
                  className="dash-input h-10"
                  placeholder="6"
                />
              </div>
              <div className="flex items-end justify-between gap-4">
                <label className="inline-flex items-center gap-2 text-xs text-foreground-light select-none">
                  <input
                    type="checkbox"
                    checked={remoteAllowOverride}
                    onChange={(e) => setRemoteAllowOverride(e.target.checked)}
                  />
                  Allow override headers
                </label>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium mb-1 text-foreground-light">
                  REMOTE_CONTEXT8_ALLOWED_HOSTS (comma-separated)
                </label>
                <input
                  type="text"
                  value={remoteAllowedHosts}
                  onChange={(e) => setRemoteAllowedHosts(e.target.value)}
                  className="dash-input h-10"
                  placeholder="api.context8.org,localhost"
                />
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-default bg-surface">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold tracking-tight text-foreground">CORS</div>
                <div className="mt-1 text-xs text-foreground-light">
                  Default allows localhost only. Avoid wildcard with credentials.
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-foreground-light">
                <Shield size={14} />
                <span>{allowCredentials ? 'Credentials on' : 'Credentials off'}</span>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1 text-foreground-light">FRONTEND_PORT</label>
                <input
                  type="text"
                  value={frontendPort}
                  onChange={(e) => setFrontendPort(e.target.value)}
                  className="dash-input h-10"
                  placeholder="3000"
                />
              </div>
              <div className="flex items-end justify-between gap-4">
                <label className="inline-flex items-center gap-2 text-xs text-foreground-light select-none">
                  <input
                    type="checkbox"
                    checked={allowCredentials}
                    onChange={(e) => setAllowCredentials(e.target.checked)}
                  />
                  Allow credentials
                </label>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium mb-1 text-foreground-light">CORS_ALLOW_ORIGINS</label>
                <input
                  type="text"
                  value={allowOrigins}
                  onChange={(e) => setAllowOrigins(e.target.value)}
                  className="dash-input h-10"
                  placeholder="http://localhost:3000,http://127.0.0.1:3000"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium mb-1 text-foreground-light">CORS_ALLOW_ORIGIN_REGEX</label>
                <input
                  type="text"
                  value={originRegex}
                  onChange={(e) => setOriginRegex(e.target.value)}
                  className="dash-input h-10"
                  placeholder=""
                />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <CodePanel
            title="Embedding snippet"
            helper="Put this into `.env`, then restart compose."
            body={embeddingSnippet}
            onCopy={() => void copyText(embeddingSnippet)}
          />
          <CodePanel
            title="Remote snippet"
            helper="Remote API key is not fetched from the server; paste it here if you want it in the snippet."
            body={remoteSnippet}
            onCopy={() => void copyText(remoteSnippet)}
          />
          <CodePanel
            title="CORS snippet"
            helper="Use explicit origins; keep `CORS_ALLOW_CREDENTIALS=false` unless you need cookies."
            body={corsSnippet}
            onCopy={() => void copyText(corsSnippet)}
          />
          <div className="p-4 rounded-xl border border-default bg-surface">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg border border-default bg-alternative flex items-center justify-center text-foreground">
                <Shield size={18} />
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold tracking-tight text-foreground">Operational note</div>
                <div className="mt-1 text-xs text-foreground-light">
                  This UI does not mutate server env. It generates safe snippets and shows live `/status`.
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void copyText(`docker compose ${semanticEnabled ? '--profile semantic ' : ''}up -d --build`)}
              >
                <Copy size={14} />
                <span className="ml-2">Copy compose</span>
              </Button>
            </div>
            <div className="mt-3 text-xs text-foreground-light">
              Compose command:
              <div className="mt-1 font-mono text-[11px] text-foreground">
                docker compose {semanticEnabled ? '--profile semantic ' : ''}up -d --build
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
