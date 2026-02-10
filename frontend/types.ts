export interface ApiKey {
  id: string;
  name: string;
  createdAt?: string;
  dailyLimit?: number | null;
  monthlyLimit?: number | null;
}

export interface SubApiKey {
  id: string;
  parentId: string;
  name: string;
  createdAt?: string;
  canRead: boolean;
  canWrite: boolean;
  dailyLimit?: number | null;
  monthlyLimit?: number | null;
  apiKey?: string;
}

export type View = 'home' | 'dashboard' | 'login';
export type ThemeMode = 'light' | 'dark';
export type Visibility = 'private' | 'team';
export type SearchSource = 'local' | 'remote' | 'all';

export interface SolutionInput {
  title: string;
  errorMessage: string;
  errorType: string;
  context: string;
  rootCause: string;
  solution: string;
  tags: string;
}

export interface Solution {
  id: string;
  title?: string;
  errorType?: string;
  tags?: string[];
  createdAt?: string;
  errorMessage?: string;
  preview?: string;
  context?: string;
  rootCause?: string;
  solution?: string;
  projectPath?: string | null;
  visibility?: Visibility;
  apiKeyId?: string;
  apiKeyName?: string;
  author?: string;
  views?: number;
  upvotes?: number;
  downvotes?: number;
  voteScore?: number;
  myVote?: number | null;
}

export interface SearchResponse {
  total: number;
  results: SearchResult[];
}

export interface SearchResult {
  id: string;
  title?: string;
  errorType?: string;
  tags?: string[];
  createdAt?: string;
  preview?: string;
  errorMessage?: string;
  solution?: string;
  visibility?: Visibility;
  apiKeyId?: string;
  upvotes?: number;
  downvotes?: number;
  voteScore?: number;
  source?: SearchSource;
}

export type SystemComponentStatus = 'ok' | 'error' | 'disabled';

export interface StatusComponentBase {
  status: SystemComponentStatus;
  detail?: string;
}

export interface StatusDbComponent extends StatusComponentBase {}

export interface StatusEsComponent extends StatusComponentBase {
  cluster?: string;
  version?: string;
  index?: string;
  indexExists?: boolean;
}

export interface StatusRemoteComponent extends StatusComponentBase {
  base?: string;
  total?: number;
}

export interface StatusEmbeddingComponent extends StatusComponentBase {
  healthUrl?: string;
  payload?: unknown;
}

export interface StatusConfig {
  frontendPort?: string;
  timingLogs?: boolean;
  cors?: {
    allowOrigins?: string[];
    originRegex?: string | null;
    allowCredentials?: boolean;
  };
  es?: {
    url?: string | null;
    index?: string;
    timeoutSec?: number;
    bm25Weight?: number;
    knnWeight?: number;
    embeddingDim?: number;
  };
  embedding?: {
    apiUrl?: string | null;
    timeoutSec?: number;
    strict?: boolean;
  };
  remote?: {
    base?: string | null;
    configured?: boolean;
    allowOverride?: boolean;
    timeoutSec?: number;
    allowedHosts?: string[];
  };
  timeouts?: {
    searchEsSec?: number;
    searchEmbedSec?: number;
    statusSec?: number;
    statusRemoteSec?: number;
    statusEmbedSec?: number;
  };
}

export interface StatusResponse {
  updatedAt: string;
  uptimeSec: number;
  version: string;
  environment: string;
  status: string;
  components: {
    db?: StatusDbComponent;
    es?: StatusEsComponent;
    remote?: StatusRemoteComponent;
    embedding?: StatusEmbeddingComponent;
    [key: string]: StatusComponentBase | undefined;
  };
  config?: StatusConfig;
  queueLengths?: Record<string, number | null>;
}

export interface StatusSummaryResponse {
  page: string;
  status: string;
  components: StatusResponse['components'];
  updatedAt: string;
}
