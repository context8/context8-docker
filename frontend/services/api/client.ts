import { API_BASE } from '../../constants';

export interface AuthOptions {
  token?: string;
  apiKey?: string;
  apiKeys?: string[];
}

let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

function buildHeaders(auth?: AuthOptions): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (auth?.apiKeys && auth.apiKeys.length > 0) {
    headers['X-API-Keys'] = auth.apiKeys.join(',');
  } else if (auth?.apiKey) {
    headers['X-API-Key'] = auth.apiKey;
  }

  if (auth?.token) {
    headers['Authorization'] = `Bearer ${auth.token}`;
  }

  return headers;
}

export async function request<T>(
  endpoint: string,
  options: RequestInit = {},
  auth?: AuthOptions
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      ...buildHeaders(auth),
      ...options.headers,
    },
  });

  if (!response.ok) {
    if ((response.status === 401 || response.status === 403) && auth?.token && unauthorizedHandler) {
      unauthorizedHandler();
    }
    const errorText = await response.text();
    throw new Error(errorText || `Request failed with status ${response.status}`);
  }

  return response.json();
}
