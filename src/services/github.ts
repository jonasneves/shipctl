const REPO_OWNER = 'jonasneves';
const REPO_NAME = 'serverless-llm';

interface WorkflowInfo {
  id: number;
  name: string;
  path: string;
}

interface WorkflowRun {
  id: number;
  name: string;
  status: 'completed' | 'in_progress' | 'queued' | 'waiting' | 'failure';
  conclusion: 'success' | 'failure' | 'cancelled' | null;
  created_at: string;
  updated_at: string;
  html_url: string;
}

class GitHubService {
  private token: string;
  private headers: Record<string, string>;

  constructor(token: string) {
    this.token = token;
    this.headers = {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'serverless-llm-extension',
    };
  }

  async getWorkflows(): Promise<any[]> {
    const response = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/actions/workflows`,
      { headers: this.headers }
    );

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    return data.workflows || [];
  }

  async getLatestRun(workflowId: number): Promise<WorkflowRun | null> {
    const response = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/actions/workflows/${workflowId}/runs?per_page=1`,
      { headers: this.headers }
    );

    if (!response.ok) return null;

    const data = await response.json();
    return data.workflow_runs?.[0] || null;
  }

  async triggerWorkflow(workflowIdentifier: number | string): Promise<boolean> {
    const response = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/actions/workflows/${workflowIdentifier}/dispatches`,
      {
        method: 'POST',
        headers: { ...this.headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ref: 'main' }),
      }
    );

    return response.status === 204;
  }
}

export { GitHubService };
export type { WorkflowInfo, WorkflowRun };
