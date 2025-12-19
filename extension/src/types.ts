export interface Project {
  id: string;
  name: string;
  repo: string; // owner/repo format
  workflows: string[]; // workflow filenames
  localCommand?: string;
  localPort?: number;
  localDir?: string;
  healthEndpoint?: string;
  environments?: {
    production?: string;
    staging?: string;
    development?: string;
  };
}

export interface Settings {
  githubToken: string;
  defaultProfile: 'production' | 'staging' | 'development';
}

export interface WorkflowRun {
  id: number;
  name: string;
  status: 'completed' | 'in_progress' | 'queued' | 'waiting';
  conclusion: 'success' | 'failure' | 'cancelled' | null;
  created_at: string;
  updated_at: string;
  html_url: string;
}

export interface NativeResponse {
  ok: boolean;
  error?: string;
  status?: 'running' | 'stopped';
  pid?: number;
  logTail?: string;
}
