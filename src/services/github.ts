interface WorkflowInfo {
  id: number;
  name: string;
  path: string;
}

export interface WorkflowRun {
  id: number;
  name: string;
  display_title: string;
  status: 'completed' | 'in_progress' | 'queued' | 'waiting' | 'failure';
  conclusion: 'success' | 'failure' | 'cancelled' | null;
  created_at: string;
  updated_at: string;
  html_url: string;
}

const ERROR_MESSAGES: Record<number, string> = {
  401: 'Invalid GitHub token. Check Settings.',
  403: 'GitHub rate limit exceeded or insufficient permissions.',
  404: 'Repository not found. Check Settings.',
  422: 'Invalid request. Check repository configuration.',
};

function getErrorMessage(status: number): string {
  return ERROR_MESSAGES[status] || `GitHub API error (${status})`;
}

class GitHubService {
  private owner: string;
  private repo: string;
  private headers: Record<string, string>;

  constructor(token: string, owner: string, repo: string) {
    this.owner = owner;
    this.repo = repo;
    this.headers = {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'shipctl-extension',
    };
  }

  async getWorkflows(): Promise<any[]> {
    const response = await fetch(
      `https://api.github.com/repos/${this.owner}/${this.repo}/actions/workflows`,
      { headers: this.headers }
    );

    if (!response.ok) throw new Error(getErrorMessage(response.status));

    const data = await response.json();
    return data.workflows || [];
  }

  async getActiveRuns(workflowId: number): Promise<WorkflowRun[]> {
    const response = await fetch(
      `https://api.github.com/repos/${this.owner}/${this.repo}/actions/workflows/${workflowId}/runs?per_page=20`,
      { headers: this.headers }
    );

    if (!response.ok) return [];

    const data = await response.json();
    const runs = data.workflow_runs || [];

    // Return all active runs (in_progress, queued) plus the most recent completed one
    const active = runs.filter((run: any) =>
      run.status === 'in_progress' || run.status === 'queued'
    );

    // If no active runs, include the most recent run to show last status
    if (active.length === 0 && runs.length > 0) {
      return [runs[0]];
    }

    return active;
  }

  async triggerWorkflow(
    workflowIdentifier: number | string,
    inputs?: Record<string, string>
  ): Promise<void> {
    const body = inputs ? { ref: 'main', inputs } : { ref: 'main' };

    const response = await fetch(
      `https://api.github.com/repos/${this.owner}/${this.repo}/actions/workflows/${workflowIdentifier}/dispatches`,
      {
        method: 'POST',
        headers: { ...this.headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );

    if (response.status !== 204) {
      throw new Error(getErrorMessage(response.status));
    }
  }

  async cancelRun(runId: number): Promise<void> {
    const response = await fetch(
      `https://api.github.com/repos/${this.owner}/${this.repo}/actions/runs/${runId}/cancel`,
      {
        method: 'POST',
        headers: this.headers,
      }
    );

    if (response.status !== 202) {
      throw new Error(getErrorMessage(response.status));
    }
  }
}

export { GitHubService };
export type { WorkflowInfo };
