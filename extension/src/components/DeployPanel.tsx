import { useState, useEffect, useCallback } from 'react';
import {
  Rocket,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
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
      return (
        <span className="badge badge-neutral">
          <Clock className="w-3 h-3" />
          No runs
        </span>
      );
    }
    if (run.status === 'in_progress' || run.status === 'queued') {
      return (
        <span className="badge badge-warning">
          <RefreshCw className="w-3 h-3 animate-spin" />
          Running
        </span>
      );
    }
    if (run.conclusion === 'success') {
      return (
        <span className="badge badge-success">
          <CheckCircle className="w-3 h-3" />
          Success
        </span>
      );
    }
    if (run.conclusion === 'failure') {
      return (
        <span className="badge badge-danger">
          <XCircle className="w-3 h-3" />
          Failed
        </span>
      );
    }
    return (
      <span className="badge badge-neutral">
        <Clock className="w-3 h-3" />
        Unknown
      </span>
    );
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
      <div className="text-center py-12">
        <Rocket className="w-12 h-12 mx-auto mb-3 text-muted" />
        <p className="text-secondary">Select a project to deploy</p>
      </div>
    );
  }

  if (!githubToken) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 mx-auto mb-3 text-warning opacity-50" />
        <p className="text-secondary mb-1">GitHub token required</p>
        <p className="text-xs text-muted">Configure in Settings</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 card border-l-4 border-l-red-500">
          <p className="text-sm text-danger">{error}</p>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-primary flex items-center gap-2">
          <Rocket className="w-4 h-4" />
          Workflows
        </h2>
        <button
          onClick={fetchWorkflowRuns}
          disabled={loading}
          className="btn-ghost text-xs flex items-center gap-1 px-2 py-1"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Workflows */}
      <div className="space-y-2">
        {project.workflows.map((workflow) => {
          const run = runs.get(workflow);
          const isTriggering = triggering === workflow;
          const workflowName = workflow.replace('.yml', '').replace('.yaml', '');

          return (
            <div key={workflow} className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-primary">
                    {workflowName}
                  </span>
                  {getStatusBadge(run ?? null)}
                </div>
                {run && (
                  <a
                    href={run.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-secondary hover:text-info transition-colors"
                    title="View on GitHub"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-muted">
                  {run ? `Last run: ${formatTime(run.updated_at)}` : 'No previous runs'}
                </span>
                <button
                  onClick={() => triggerWorkflow(workflow)}
                  disabled={isTriggering || loading}
                  className="btn btn-primary text-xs"
                >
                  {isTriggering ? (
                    <>
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      Deploying...
                    </>
                  ) : (
                    <>
                      <Play className="w-3 h-3" />
                      Deploy
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {project.workflows.length === 0 && (
        <div className="text-center py-8 card">
          <p className="text-secondary text-sm">No workflows configured</p>
          <p className="text-muted text-xs mt-1">Add workflows in Settings</p>
        </div>
      )}
    </div>
  );
}
