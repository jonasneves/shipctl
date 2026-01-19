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
  domain: { base: string; useHttps: boolean };
  chatApi: { localPort: number; healthPath: string };
}

export const REGISTRY_CONFIG: RegistryConfig = (extensionConfig as any).config || {
  domain: { base: 'neevs.io', useHttps: true },
  chatApi: { localPort: 8080, healthPath: '/health' }
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

export interface EnvConfig {
  githubToken: string;
  githubUsername?: string;
  githubRepoOwner: string;
  githubRepoName: string;
  chatApiBaseUrl: string;
  modelsBaseDomain: string;
  modelsUseHttps: boolean;
}

export const DEFAULT_CONFIG: EnvConfig = {
  githubToken: '',
  githubRepoOwner: '',
  githubRepoName: '',
  chatApiBaseUrl: `http://localhost:${REGISTRY_CONFIG.chatApi.localPort}`,
  modelsBaseDomain: REGISTRY_CONFIG.domain.base,
  modelsUseHttps: REGISTRY_CONFIG.domain.useHttps,
};

export function normalizeEnvConfig(raw: unknown): EnvConfig {
  const merged = { ...DEFAULT_CONFIG, ...(raw as any) } as any;

  return {
    githubToken: typeof merged.githubToken === 'string' ? merged.githubToken : DEFAULT_CONFIG.githubToken,
    githubUsername: typeof merged.githubUsername === 'string' ? merged.githubUsername : undefined,
    githubRepoOwner: typeof merged.githubRepoOwner === 'string' ? merged.githubRepoOwner : DEFAULT_CONFIG.githubRepoOwner,
    githubRepoName: typeof merged.githubRepoName === 'string' ? merged.githubRepoName : DEFAULT_CONFIG.githubRepoName,
    chatApiBaseUrl: normalizeBaseUrl(typeof merged.chatApiBaseUrl === 'string' ? merged.chatApiBaseUrl : '') || DEFAULT_CONFIG.chatApiBaseUrl,
    modelsBaseDomain: (typeof merged.modelsBaseDomain === 'string' && merged.modelsBaseDomain) ? merged.modelsBaseDomain : DEFAULT_CONFIG.modelsBaseDomain,
    modelsUseHttps: typeof merged.modelsUseHttps === 'boolean' ? merged.modelsUseHttps : DEFAULT_CONFIG.modelsUseHttps,
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
