/**
 * Hook to load extension configuration
 * - Extension mode: from chrome.storage, sets API base URL
 * - Web mode: uses relative URLs (same origin)
 * 
 * IMPORTANT: Service definitions are generated from config/models.py
 * Run `python3 scripts/generate_extension_config.py` to update.
 */

import extensionConfig from '../data/extension-config.json';
import { normalizeBaseUrl } from '../utils/url';

// Registry config from apps.json
export interface RegistryConfig {
  github: { owner: string; repo: string };
  domain: { base: string; useHttps: boolean };
  chatApi: { localPort: number; healthPath: string };
  nativeHost: { name: string };
}

export const REGISTRY_CONFIG: RegistryConfig = (extensionConfig as any).config || {
  github: { owner: '', repo: '' },
  domain: { base: 'neevs.io', useHttps: true },
  chatApi: { localPort: 8080, healthPath: '/health' },
  nativeHost: { name: 'io.neevs.serverless_llm' }
};

// Types for generated config
export interface ServiceConfig {
  key: string;
  name: string;
  localPort: number;
  category: 'core' | 'small' | 'medium' | 'reasoning';
  modelId: string;
  rank: number;
}

export interface WorkflowConfig {
  name: string;
  path: string;
  category: 'core' | 'small' | 'medium' | 'reasoning';
  serviceKey?: string;
}

// Service definitions - GENERATED from config/models.py
// Do not edit manually! Run: python3 scripts/generate_extension_config.py
export const SERVICES: ServiceConfig[] = extensionConfig.services as ServiceConfig[];
export const WORKFLOWS: WorkflowConfig[] = extensionConfig.workflows as WorkflowConfig[];
// Build workflow name -> path map for quick lookups
export const WORKFLOW_PATHS = new Map(WORKFLOWS.map(wf => [wf.name, wf.path]));

// Build service key -> workflow name map
export const SERVICE_TO_WORKFLOW = new Map(
  WORKFLOWS.filter(wf => wf.serviceKey).map(wf => [wf.serviceKey!, wf.name])
);

export type ProfileId = 'remote_all' | 'local_chat_remote_models' | 'local_all' | 'custom';

export interface EnvConfig {
  githubToken: string;
  githubUsername?: string;
  githubRepoOwner: string;
  githubRepoName: string;
  profile: ProfileId;
  chatApiBaseUrl: string;
  modelsBaseDomain: string;
  modelsUseHttps: boolean;
  repoPath?: string;
  pythonPath?: string;
}

export const DEFAULT_CONFIG: EnvConfig = {
  githubToken: '',
  githubRepoOwner: REGISTRY_CONFIG.github.owner,
  githubRepoName: REGISTRY_CONFIG.github.repo,
  profile: 'local_all',
  chatApiBaseUrl: `http://localhost:${REGISTRY_CONFIG.chatApi.localPort}`,
  modelsBaseDomain: REGISTRY_CONFIG.domain.base,
  modelsUseHttps: REGISTRY_CONFIG.domain.useHttps,
};

export function normalizeEnvConfig(raw: unknown): EnvConfig {
  const merged = { ...DEFAULT_CONFIG, ...(raw as any) } as any;

  // Legacy support: { baseDomain, useHttps } drove both chat + models.
  if ((!merged.chatApiBaseUrl || typeof merged.chatApiBaseUrl !== 'string') && typeof merged.baseDomain === 'string') {
    merged.chatApiBaseUrl = merged.baseDomain
      ? `${merged.useHttps === false ? 'http' : 'https'}://chat.${merged.baseDomain}`
      : 'http://localhost:8080';
    merged.profile = 'custom';
  }

  if ((!merged.modelsBaseDomain || typeof merged.modelsBaseDomain !== 'string') && typeof merged.baseDomain === 'string') {
    merged.modelsBaseDomain = merged.baseDomain;
    merged.profile = 'custom';
  }

  if (typeof merged.modelsUseHttps !== 'boolean' && typeof merged.useHttps === 'boolean') {
    merged.modelsUseHttps = merged.useHttps;
    merged.profile = 'custom';
  }

  const profile: ProfileId =
    merged.profile === 'remote_all' ||
      merged.profile === 'local_chat_remote_models' ||
      merged.profile === 'local_all' ||
      merged.profile === 'custom'
      ? merged.profile
      : DEFAULT_CONFIG.profile;

  return {
    githubToken: typeof merged.githubToken === 'string' ? merged.githubToken : DEFAULT_CONFIG.githubToken,
    githubUsername: typeof merged.githubUsername === 'string' ? merged.githubUsername : undefined,
    githubRepoOwner: typeof merged.githubRepoOwner === 'string' ? merged.githubRepoOwner : DEFAULT_CONFIG.githubRepoOwner,
    githubRepoName: typeof merged.githubRepoName === 'string' ? merged.githubRepoName : DEFAULT_CONFIG.githubRepoName,
    profile,
    chatApiBaseUrl: normalizeBaseUrl(typeof merged.chatApiBaseUrl === 'string' ? merged.chatApiBaseUrl : '') || 'http://localhost:8080',
    modelsBaseDomain: typeof merged.modelsBaseDomain === 'string' ? merged.modelsBaseDomain : DEFAULT_CONFIG.modelsBaseDomain,
    modelsUseHttps: typeof merged.modelsUseHttps === 'boolean' ? merged.modelsUseHttps : DEFAULT_CONFIG.modelsUseHttps,
    repoPath: typeof merged.repoPath === 'string' ? merged.repoPath : undefined,
    pythonPath: typeof merged.pythonPath === 'string' ? merged.pythonPath : undefined,
  };
}

export function buildEndpoint(
  serviceKey: string,
  localPort: number,
  modelsBaseDomain: string,
  modelsUseHttps: boolean
): string {
  if (!modelsBaseDomain) {
    return `http://localhost:${localPort}`;
  }
  return `${modelsUseHttps ? 'https' : 'http'}://${serviceKey}.${modelsBaseDomain}`;
}
