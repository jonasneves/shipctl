import { useState, useCallback, useMemo } from 'react';
import { WORKFLOWS } from './useExtensionConfig';
import { GitHubService, type WorkflowRun, type WorkflowInfo } from '../services/github';

interface UseWorkflowOrchestrationProps {
  githubToken: string;
  githubRepoOwner: string;
  githubRepoName: string;
  onActiveDeploymentsChange?: (count: number) => void;
  onRefresh?: () => void;
  onTriggerSuccess?: (workflowName: string) => void;
  onTriggerError?: (workflowName: string, error: string) => void;
}

export function useWorkflowOrchestration({
  githubToken,
  githubRepoOwner,
  githubRepoName,
  onActiveDeploymentsChange,
  onRefresh,
  onTriggerSuccess,
  onTriggerError,
}: UseWorkflowOrchestrationProps) {
  // Workflows keyed by path (e.g., ".github/workflows/chat.yml")
  const [workflows, setWorkflows] = useState<Map<string, WorkflowInfo>>(new Map());
  // Active runs keyed by workflow path
  const [activeRuns, setActiveRuns] = useState<Map<string, WorkflowRun[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [triggering, setTriggering] = useState<string | null>(null);
  const [recentlyTriggered, setRecentlyTriggered] = useState<Set<string>>(new Set());

  const github = useMemo(
    () => new GitHubService(githubToken, githubRepoOwner, githubRepoName),
    [githubToken, githubRepoOwner, githubRepoName]
  );

  const fetchWorkflows = useCallback(async () => {
    if (!githubToken) {
      setLoading(false);
      return;
    }

    try {
      const fetchedWorkflows = await github.getWorkflows();
      const wfMap = new Map<string, WorkflowInfo>();

      // Store ALL workflows from GitHub, keyed by path
      for (const wf of fetchedWorkflows) {
        if (wf.path && wf.id) {
          wfMap.set(wf.path, {
            id: wf.id,
            name: wf.name || wf.path.replace('.github/workflows/', '').replace('.yml', ''),
            path: wf.path,
          });
        }
      }

      setWorkflows(wfMap);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    }
  }, [githubToken, github]);

  const fetchLatestRuns = useCallback(async () => {
    if (!githubToken || workflows.size === 0) return;

    const newActiveRuns = new Map<string, WorkflowRun[]>();
    let activeCount = 0;

    for (const [path, wf] of workflows) {
      try {
        const runsList = await github.getActiveRuns(wf.id);
        newActiveRuns.set(path, runsList);
        activeCount += runsList.filter(r =>
          r.status === 'in_progress' || r.status === 'queued'
        ).length;
      } catch {
        newActiveRuns.set(path, []);
      }
    }

    setActiveRuns(newActiveRuns);
    onActiveDeploymentsChange?.(activeCount);
    setLoading(false);
  }, [githubToken, github, workflows, onActiveDeploymentsChange]);

  // Trigger workflow by path (e.g., ".github/workflows/chat.yml") or short path ("chat.yml")
  const triggerWorkflow = useCallback(async (workflowPath: string, inputs?: Record<string, string>) => {
    // Find workflow by full path or short path
    const wf = workflows.get(workflowPath) ||
      Array.from(workflows.values()).find(w => w.path.endsWith(workflowPath));

    if (!wf) {
      setError(`Workflow ${workflowPath} not found`);
      return;
    }

    setTriggering(wf.path);
    try {
      await github.triggerWorkflow(wf.id, inputs);

      setRecentlyTriggered(prev => new Set(prev).add(wf.path));
      onTriggerSuccess?.(wf.name);

      [3000, 6000, 10000].forEach(ms => setTimeout(() => onRefresh?.(), ms));

      setTimeout(() => {
        setRecentlyTriggered(prev => {
          const next = new Set(prev);
          next.delete(wf.path);
          return next;
        });
      }, 15000);
    } catch (err: any) {
      setError(err.message);
      onTriggerError?.(wf.name, err.message);
    } finally {
      setTriggering(null);
    }
  }, [workflows, github, onRefresh, onTriggerSuccess, onTriggerError]);

  const triggerAllWorkflows = useCallback(async () => {
    // Trigger all service workflows from config + Chat
    const allServiceWorkflows = WORKFLOWS.filter(wf => wf.serviceKey);
    for (const wf of allServiceWorkflows) {
      const ghWf = Array.from(workflows.values()).find(w => w.path.endsWith(wf.path));
      if (ghWf) {
        await triggerWorkflow(ghWf.path, { model: wf.serviceKey! });
      }
    }
    // Trigger Chat workflow
    const chatWf = Array.from(workflows.values()).find(w => w.path.endsWith('chat.yml'));
    if (chatWf) await triggerWorkflow(chatWf.path);
  }, [workflows, triggerWorkflow]);

  const cancelAllRunning = useCallback(async () => {
    const runningRuns: { path: string; run: WorkflowRun }[] = [];
    for (const [path, runsList] of activeRuns) {
      for (const run of runsList) {
        if (run.status === 'in_progress' || run.status === 'queued') {
          runningRuns.push({ path, run });
        }
      }
    }

    if (runningRuns.length === 0) {
      onTriggerError?.('Stop All', 'No running workflows found');
      return;
    }

    setTriggering('stopping');
    let stopped = 0;
    for (const { path, run } of runningRuns) {
      try {
        await github.cancelRun(run.id);
        const wf = workflows.get(path);
        onTriggerSuccess?.(`${wf?.name || path} stopped`);
        stopped++;
      } catch (err: any) {
        onTriggerError?.(path, err.message);
      }
    }
    if (stopped > 0) {
      setTimeout(() => onRefresh?.(), 2000);
    }
    setTriggering(null);
  }, [activeRuns, workflows, github, onRefresh, onTriggerSuccess, onTriggerError]);

  const cancelWorkflowRun = useCallback(async (runId: number, displayName: string) => {
    setTriggering(`stopping:${runId}`);
    try {
      await github.cancelRun(runId);
      onTriggerSuccess?.(`${displayName} stopped`);
      setTimeout(() => onRefresh?.(), 2000);
    } catch (err: any) {
      onTriggerError?.(displayName, err.message);
    } finally {
      setTriggering(null);
    }
  }, [github, onRefresh, onTriggerSuccess, onTriggerError]);

  // Count active runs across all workflows
  const deployingCount = useMemo(() => {
    let count = 0;
    for (const runsList of activeRuns.values()) {
      count += runsList.filter(r =>
        r.status === 'in_progress' || r.status === 'queued'
      ).length;
    }
    return count;
  }, [activeRuns]);

  return {
    workflows,
    activeRuns,
    loading,
    error,
    triggering,
    recentlyTriggered,
    setLoading,
    fetchWorkflows,
    fetchLatestRuns,
    triggerWorkflow,
    triggerAllWorkflows,
    cancelAllRunning,
    cancelWorkflowRun,
    deployingCount,
  };
}
