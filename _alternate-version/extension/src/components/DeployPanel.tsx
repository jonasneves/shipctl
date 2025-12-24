import { useState, useEffect, useCallback } from 'react';
import {
  Rocket,
  RefreshCw,
  CheckCircle,
  XCircle,
  Play,
  ExternalLink,
  AlertCircle,
} from 'lucide-react';
import { Project, WorkflowRun } from '../types';

interface DeployPanelProps {
  project: Project | null;
  githubToken: string;
}

export default function DeployPanel({ project, githubToken }: DeployPanelProps) {
  const [runs, setRuns] = useState<Map<string, WorkflowRun | null>>(new Map());
  const [loading, setLoading] = useState(false);
  const [triggering, setTriggering] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const headers = {
    Authorization: `Bearer ${githubToken}`,
    Accept: 'application/vnd.github.v3+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  const fetchWorkflowRuns = useCallback(async () => {
    if (!project || !githubToken) return;

    setLoading(true);
    setError(null);
    const runsMap = new Map<string, WorkflowRun | null>();

    try {
      await Promise.all(
        project.workflows.map(async (workflow) => {
          try {
            const response = await fetch(
              `https://api.github.com/repos/${project.repo}/actions/workflows/${workflow}/runs?per_page=1`,
              { headers, signal: AbortSignal.timeout(8000) }
            );

            if (response.ok) {
              const data = await response.json();
              if (data.workflow_runs?.length > 0) {
                const run = data.workflow_runs[0];
                runsMap.set(workflow, {
                  id: run.id,
                  name: run.name,
                  status: run.status,
                  conclusion: run.conclusion,
                  created_at: run.created_at,
                  updated_at: run.updated_at,
                  html_url: run.html_url,
                });
              } else {
                runsMap.set(workflow, null);
              }
            } else if (response.status === 401 || response.status === 403) {
              setError('Invalid or expired GitHub token');
            }
          } catch {
            runsMap.set(workflow, null);
          }
        })
      );

      setRuns(runsMap);
    } finally {
      setLoading(false);
    }
  }, [project, githubToken]);

  useEffect(() => {
    fetchWorkflowRuns();
    const interval = setInterval(fetchWorkflowRuns, 30000);
    return () => clearInterval(interval);
  }, [fetchWorkflowRuns]);

  const triggerWorkflow = async (workflow: string) => {
    if (!project || !githubToken) return;

    setTriggering(workflow);
    try {
      const response = await fetch(
        `https://api.github.com/repos/${project.repo}/actions/workflows/${workflow}/dispatches`,
        {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ ref: 'main' }),
          signal: AbortSignal.timeout(8000),
        }
      );

      if (!response.ok && response.status !== 204) {
        throw new Error(`Failed to trigger: ${response.status}`);
      }

      setTimeout(fetchWorkflowRuns, 2000);
    } catch (err) {
      console.error('Failed to trigger workflow:', err);
    } finally {
      setTriggering(null);
    }
  };

  const getStatusBadge = (run: WorkflowRun | null) => {
    if (!run) {
      return <span className="status-badge status-badge-neutral">No runs</span>;
    }
    if (run.status === 'in_progress' || run.status === 'queued') {
      return (
        <span className="status-badge status-badge-warning">
          <RefreshCw className="w-3 h-3 animate-spin" />
          Running
        </span>
      );
    }
    if (run.conclusion === 'success') {
      return (
        <span className="status-badge status-badge-success">
          <CheckCircle className="w-3 h-3" />
          Success
        </span>
      );
    }
    if (run.conclusion === 'failure') {
      return (
        <span className="status-badge status-badge-danger">
          <XCircle className="w-3 h-3" />
          Failed
        </span>
      );
    }
    return <span className="status-badge status-badge-neutral">Unknown</span>;
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  if (!project) {
    return (
      <div className="empty-state">
        <Rocket className="w-10 h-10 empty-state-icon mx-auto" />
        <p className="empty-state-title">No project selected</p>
        <p className="empty-state-text">Select a project to deploy</p>
      </div>
    );
  }

  if (!githubToken) {
    return (
      <div className="empty-state">
        <AlertCircle className="w-10 h-10 empty-state-icon mx-auto" />
        <p className="empty-state-title">GitHub token required</p>
        <p className="empty-state-text">Configure in Settings</p>
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div className="px-4 py-3 bg-danger/10 border-b border-danger/20">
          <p className="text-xs text-danger">{error}</p>
        </div>
      )}

      {/* Section header */}
      <div className="section-header flex items-center justify-between">
        <span className="section-title">Workflows</span>
        <button onClick={fetchWorkflowRuns} disabled={loading} className="btn btn-ghost btn-sm">
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Workflow list */}
      <div className="bg-primary">
        {project.workflows.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-text">No workflows configured</p>
          </div>
        ) : (
          project.workflows.map((workflow) => {
            const run = runs.get(workflow);
            const isTriggering = triggering === workflow;
            const workflowName = workflow.replace('.yml', '').replace('.yaml', '');

            return (
              <div key={workflow} className="list-item">
                <div className="list-item-content">
                  <div className="list-item-icon">
                    <Rocket className="w-4 h-4 text-secondary" />
                  </div>
                  <div className="list-item-text">
                    <div className="list-item-title">{workflowName}</div>
                    <div className="list-item-subtitle">
                      {run ? formatTime(run.updated_at) : 'No previous runs'}
                    </div>
                  </div>
                </div>
                <div className="list-item-actions">
                  {getStatusBadge(run ?? null)}
                  <button
                    onClick={() => triggerWorkflow(workflow)}
                    disabled={isTriggering || loading}
                    className="btn btn-primary btn-sm"
                  >
                    {isTriggering ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : (
                      <Play className="w-3 h-3" />
                    )}
                    Deploy
                  </button>
                  {run && (
                    <a
                      href={run.html_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-ghost btn-sm"
                      title="View on GitHub"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
