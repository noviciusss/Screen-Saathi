declare module "*.css" {
  const classNames: Record<string, string>;
  export default classNames;
}

interface ImportMetaEnv {
  readonly VITE_SAATHI_BACKEND_URL?: string;
  readonly VITE_SAATHI_SESSION_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface SaathiRuntimeConfig {
  readonly backendUrl?: string;
  readonly sessionToken?: string;
}

declare var __SAATHI_CONFIG__: SaathiRuntimeConfig | undefined;
