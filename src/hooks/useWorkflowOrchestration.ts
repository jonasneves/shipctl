import { useState, useCallback, useMemo } from 'react';
import { WORKFLOWS, WORKFLOW_PATHS } from './useExtensionConfig';
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
  const [workflows, setWorkflows] = useState<Map<string, WorkflowInfo>>(new Map());
  const [runs, setRuns] = useState<Map<string, WorkflowRun | null>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [triggering, setTriggering] = useState<string | null>(null);
  // Track workflows that were just triggered (for immediate "starting" feedback)
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

      for (const keyWf of WORKFLOWS) {
        const matchingGhWf = fetchedWorkflows.find(wf =>
          wf.path === keyWf.path || wf.path?.endsWith(`/${keyWf.path}`)
        );
        if (matchingGhWf) {
          wfMap.set(keyWf.name, {
            id: matchingGhWf.id,
            name: keyWf.name,
            path: matchingGhWf.path
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

    const newRuns = new Map<string, WorkflowRun | null>();
    let activeCount = 0;

    for (const [name, wf] of workflows) {
      try {
        const workflowConfig = WORKFLOWS.find(w => w.name === name);
        const filterByModel = workflowConfig?.serviceKey;
        const run = await github.getLatestRun(wf.id, filterByModel);
        newRuns.set(name, run);
        if (run?.status === 'in_progress' || run?.status === 'queued') activeCount++;
      } catch {
        newRuns.set(name, null);
      }
    }

    setRuns(newRuns);
    onActiveDeploymentsChange?.(activeCount);
    setLoading(false);
  }, [githubToken, github, workflows, onActiveDeploymentsChange]);

  const triggerWorkflow = useCallback(async (workflowName: string) => {
    const wf = workflows.get(workflowName);
    const fallbackPath = WORKFLOW_PATHS.get(workflowName);
    if (!wf && !fallbackPath) {
      setError(`Workflow ${workflowName} not found`);
      return;
    }

    setTriggering(workflowName);
    try {
      const workflowIdentifier = wf?.id ?? fallbackPath;
      const workflowConfig = WORKFLOWS.find(w => w.name === workflowName);
      const inputs = workflowConfig?.serviceKey
        ? { model: workflowConfig.serviceKey }
        : undefined;

      const success = await github.triggerWorkflow(workflowIdentifier!, inputs);

      if (success) {
        // Mark as recently triggered for immediate "starting" feedback
        setRecentlyTriggered(prev => new Set(prev).add(workflowName));
        onTriggerSuccess?.(workflowName);

        // Aggressive refresh polling at 3s, 6s, 10s
        [3000, 6000, 10000].forEach(ms => setTimeout(() => onRefresh?.(), ms));

        // Clear from recentlyTriggered after 15s
        setTimeout(() => {
          setRecentlyTriggered(prev => {
            const next = new Set(prev);
            next.delete(workflowName);
            return next;
          });
        }, 15000);
      } else {
        const errorMsg = `Failed to trigger ${workflowName}`;
        setError(errorMsg);
        onTriggerError?.(workflowName, errorMsg);
      }
    } catch (err: any) {
      setError(err.message);
      onTriggerError?.(workflowName, err.message);
    } finally {
      setTriggering(null);
    }
  }, [workflows, github, onRefresh, onTriggerSuccess, onTriggerError]);

  const triggerAllWorkflows = useCallback(async () => {
    const allServiceWorkflows = WORKFLOWS.filter(wf => wf.serviceKey);
    for (const wf of allServiceWorkflows) {
      await triggerWorkflow(wf.name);
    }
    await triggerWorkflow('Chat');
  }, [triggerWorkflow]);

  const cancelAllRunning = useCallback(async () => {
    const runningRuns = Array.from(runs.entries())
      .filter(([_, run]) => run?.status === 'in_progress' || run?.status === 'queued')
      .map(([name, run]) => ({ name, run: run! }));

    if (runningRuns.length === 0) {
      onTriggerError?.('Stop All', 'No running workflows found');
      return;
    }

    setTriggering('stopping');
    let stopped = 0;
    for (const { name, run } of runningRuns) {
      try {
        const success = await github.cancelRun(run.id);
        if (success) {
          onTriggerSuccess?.(`${name} stopped`);
          stopped++;
        } else {
          onTriggerError?.(name, 'Failed to cancel');
        }
      } catch (err: any) {
        onTriggerError?.(name, err.message);
      }
    }
    if (stopped > 0) {
      setTimeout(() => onRefresh?.(), 2000);
    }
    setTriggering(null);
  }, [runs, github, onRefresh, onTriggerSuccess, onTriggerError]);

  const cancelWorkflow = useCallback(async (workflowName: string) => {
    const run = runs.get(workflowName);
    if (!run || (run.status !== 'in_progress' && run.status !== 'queued')) {
      onTriggerError?.(workflowName, 'No running workflow to stop');
      return;
    }

    setTriggering(`stopping:${workflowName}`);
    try {
      const success = await github.cancelRun(run.id);
      if (success) {
        onTriggerSuccess?.(`${workflowName} stopped`);
        setTimeout(() => onRefresh?.(), 2000);
      } else {
        onTriggerError?.(workflowName, 'Failed to cancel workflow');
      }
    } catch (err: any) {
      onTriggerError?.(workflowName, err.message);
    } finally {
      setTriggering(null);
    }
  }, [runs, github, onRefresh, onTriggerSuccess, onTriggerError]);

  // Deploying count for stats - only counts non-service workflows (traditional CI/CD)
  // Service workflows with in_progress status means they're "running", not "deploying"
  const deployingCount = useMemo(() => {
    let count = 0;
    for (const [name, run] of runs) {
      if (!run) continue;
      if (run.status !== 'in_progress' && run.status !== 'queued') continue;

      // Check if this workflow is a long-running service (has serviceKey)
      const workflowConfig = WORKFLOWS.find(w => w.name === name);
      const isServiceWorkflow = !!workflowConfig?.serviceKey || name === 'Chat';

      // Only count as "deploying" if it's NOT a long-running service
      if (!isServiceWorkflow) {
        count++;
      }
    }
    return count;
  }, [runs]);

  return {
    workflows,
    runs,
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
    cancelWorkflow,
    deployingCount,
  };
}
