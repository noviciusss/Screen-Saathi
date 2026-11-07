export interface RuntimeConfig {
  readonly backendUrl?: string;
  readonly sessionToken?: string;
}

export interface ClientConfig {
  readonly sessionUrl: string;
  readonly sessionToken: string;
}

export const BACKEND_URL_STORAGE_KEY = "saathi_backend_url" as const;
export const SESSION_TOKEN_STORAGE_KEY = "saathi_session_token" as const;

export class ConfigurationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

function configuredValue(runtimeValue: string | undefined, buildValue: string | undefined): string | undefined {
  const value = runtimeValue ?? buildValue;
  const trimmed = value?.trim();
  return trimmed === undefined || trimmed.length === 0 ? undefined : trimmed;
}

export function sessionUrlFromBackendUrl(backendUrl: string): string {
  let url: URL;
  try {
    url = new URL(backendUrl);
  } catch {
    throw new ConfigurationError("SAATHI_BACKEND_URL is not a valid URL");
  }

  if (url.protocol === "http:") url.protocol = "ws:";
  if (url.protocol === "https:") url.protocol = "wss:";
  if (url.protocol !== "ws:" && url.protocol !== "wss:") {
    throw new ConfigurationError("SAATHI_BACKEND_URL must use http(s) or ws(s)");
  }
  if (!url.pathname.endsWith("/v1/session")) {
    url.pathname = `${url.pathname.replace(/\/$/, "")}/v1/session`;
  }
  return url.toString();
}

export function getClientConfig(): ClientConfig {
  const runtime = globalThis.__SAATHI_CONFIG__;
  const backendUrl = configuredValue(runtime?.backendUrl, import.meta.env.VITE_SAATHI_BACKEND_URL);
  const sessionToken = configuredValue(runtime?.sessionToken, import.meta.env.VITE_SAATHI_SESSION_TOKEN);
  if (backendUrl === undefined) {
    throw new ConfigurationError("Configure SAATHI_BACKEND_URL before connecting");
  }
  if (sessionToken === undefined) {
    throw new ConfigurationError("Configure SAATHI_SESSION_TOKEN before connecting");
  }
  return { sessionUrl: sessionUrlFromBackendUrl(backendUrl), sessionToken };
}

export async function getClientConfigAsync(): Promise<ClientConfig> {
  const stored = await chrome.storage.local.get([
    BACKEND_URL_STORAGE_KEY,
    SESSION_TOKEN_STORAGE_KEY,
  ]);
  const runtime = globalThis.__SAATHI_CONFIG__;
  const backendUrl = configuredValue(
    typeof stored[BACKEND_URL_STORAGE_KEY] === "string" ? stored[BACKEND_URL_STORAGE_KEY] : undefined,
    runtime?.backendUrl ?? import.meta.env.VITE_SAATHI_BACKEND_URL,
  );
  const sessionToken = configuredValue(
    typeof stored[SESSION_TOKEN_STORAGE_KEY] === "string" ? stored[SESSION_TOKEN_STORAGE_KEY] : undefined,
    runtime?.sessionToken ?? import.meta.env.VITE_SAATHI_SESSION_TOKEN,
  );
  if (backendUrl === undefined) throw new ConfigurationError("Configure the backend URL in Settings");
  if (sessionToken === undefined) throw new ConfigurationError("Configure the session token in Settings");
  return { sessionUrl: sessionUrlFromBackendUrl(backendUrl), sessionToken };
}
