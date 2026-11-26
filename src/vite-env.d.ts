/// <reference types="vite/client" />

type ImportMetaEnv = {
  readonly PROD: boolean;
  readonly BASE_URL: string;
};

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
