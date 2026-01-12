import { useState, useCallback, useMemo } from 'react';
import { WORKFLOWS, WORKFLOW_PATHS } from './useExtensionConfig';
import { GitHubService, type WorkflowRun, type WorkflowInfo } from '../services/github';

interface UseWorkflowOrchestrationProps {
  githubToken: string;
  githubRepoOwner: string;
  githubRepoName: string;
  onActiveDeploymentsChange?: (count: number) => void;
  onRefresh?: () => void;
}

export function useWorkflowOrchestration({
  githubToken,
  githubRepoOwner,
  githubRepoName,
  onActiveDeploymentsChange,
  onRefresh,
}: UseWorkflowOrchestrationProps) {
  const [workflows, setWorkflows] = useState<Map<string, WorkflowInfo>>(new Map());
  const [runs, setRuns] = useState<Map<string, WorkflowRun | null>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [triggering, setTriggering] = useState<string | null>(null);

  const github = useMemo(
    () => new GitHubService(githubToken, githubRepoOwner, githubRepoName),
    [githubToken, githubRepoOwner, githubRepoName]
  );

  const fetchWorkflows = useCallback(async () => {
    if (!githubToken) {
      setError('GitHub token required');
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
        setTimeout(() => onRefresh?.(), 3000);
      } else {
        setError(`Failed to trigger ${workflowName}`);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setTriggering(null);
    }
  }, [workflows, github, onRefresh]);

  const triggerAllWorkflows = useCallback(async () => {
    const allServiceWorkflows = WORKFLOWS.filter(wf => wf.serviceKey);
    for (const wf of allServiceWorkflows) {
      await triggerWorkflow(wf.name);
    }
    await triggerWorkflow('Chat');
  }, [triggerWorkflow]);

  // Deploying count for stats
  const deployingCount = useMemo(() => {
    return [...runs.values()].filter(r => r?.status === 'in_progress' || r?.status === 'queued').length;
  }, [runs]);

  return {
    workflows,
    runs,
    loading,
    error,
    triggering,
    setLoading,
    setError,
    fetchWorkflows,
    fetchLatestRuns,
    triggerWorkflow,
    triggerAllWorkflows,
    deployingCount,
  };
}
