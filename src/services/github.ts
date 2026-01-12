interface WorkflowInfo {
  id: number;
  name: string;
  path: string;
}

export interface WorkflowRun {
  id: number;
  name: string;
  status: 'completed' | 'in_progress' | 'queued' | 'waiting' | 'failure';
  conclusion: 'success' | 'failure' | 'cancelled' | null;
  created_at: string;
  updated_at: string;
  html_url: string;
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

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    return data.workflows || [];
  }

  async getLatestRun(
    workflowId: number,
    filterByName?: string
  ): Promise<WorkflowRun | null> {
    // Fetch more runs if we need to filter
    const perPage = filterByName ? 20 : 1;
    const response = await fetch(
      `https://api.github.com/repos/${this.owner}/${this.repo}/actions/workflows/${workflowId}/runs?per_page=${perPage}`,
      { headers: this.headers }
    );

    if (!response.ok) return null;

    const data = await response.json();
    const runs = data.workflow_runs || [];

    if (!filterByName || runs.length === 0) {
      return runs[0] || null;
    }

    // Filter by display_title (run name) - should start with model name
    // e.g., "qwen • 5h × 1" starts with "qwen"
    const filtered = runs.find((run: any) =>
      run.display_title?.toLowerCase().startsWith(filterByName.toLowerCase())
    );

    return filtered || null;
  }

  async triggerWorkflow(
    workflowIdentifier: number | string,
    inputs?: Record<string, string>
  ): Promise<boolean> {
    const body: any = { ref: 'main' };
    if (inputs) {
      body.inputs = inputs;
    }

    const response = await fetch(
      `https://api.github.com/repos/${this.owner}/${this.repo}/actions/workflows/${workflowIdentifier}/dispatches`,
      {
        method: 'POST',
        headers: { ...this.headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );

    return response.status === 204;
  }
}

export { GitHubService };
export type { WorkflowInfo };
