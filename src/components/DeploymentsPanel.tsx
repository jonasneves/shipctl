import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Package, Workflow, Search, Rocket } from 'lucide-react';
import AppCard from './AppCard';
import WorkflowCard from './WorkflowCard';
import BuildPanel from './BuildPanel';
import ObservePanel from './ObservePanel';
import DeployPanel from './DeployPanel';
import StatusRing from './StatusRing';
import ErrorDisplay from './ErrorDisplay';
import { SERVICES, WORKFLOWS, WORKFLOW_PATHS, SERVICE_TO_WORKFLOW } from '../hooks/useExtensionConfig';
import { useHealthMonitoring } from '../hooks/useHealthMonitoring';
import { useBackendControl } from '../hooks/useBackendControl';
import { useWorkflowOrchestration } from '../hooks/useWorkflowOrchestration';
import { normalizeBaseUrl } from '../utils/url';

interface DeploymentsPanelProps {
  githubToken: string;
  githubRepoOwner: string;
  githubRepoName: string;
  chatApiBaseUrl: string;
  modelsBaseDomain: string;
  modelsUseHttps: boolean;
  showOnlyBackend?: boolean;
  onBackendStatusChange?: (status: { process: 'running' | 'stopped' | 'unknown'; mode: string | null }) => void;
  onActiveDeploymentsChange?: (count: number) => void;
  onOpenSettings?: () => void;
}

const DeploymentsPanel: React.FC<DeploymentsPanelProps> = ({
  githubToken,
  githubRepoOwner,
  githubRepoName,
  chatApiBaseUrl,
  modelsBaseDomain,
  modelsUseHttps,
  showOnlyBackend = false,
  onBackendStatusChange,
  onActiveDeploymentsChange,
  onOpenSettings,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'services' | 'workflows'>('services');
  const refreshInFlight = useRef(false);

  // Health monitoring hook
  const {
    backendHealth,
    modelHealthStatuses,
    backendHealthHistory,
    modelHealthHistory,
    checkBackendHealth,
    checkAllModelsHealth,
    stats: healthStats,
  } = useHealthMonitoring({ chatApiBaseUrl, modelsBaseDomain, modelsUseHttps });

  // Backend control hook
  const {
    backendProcess,
    backendPid,
    backendBusy,
    backendLogTail,
    backendNativeError,
    buildBusy,
    buildLogTail,
    buildNativeError,
    refreshBackendStatus,
    startBackend,
    stopBackend,
    fetchBackendLogs,
    runBuild,
  } = useBackendControl({
    chatApiBaseUrl,
    modelsBaseDomain,
    onBackendStatusChange,
    checkBackendHealth,
  });

  // Refresh function (needed by workflow orchestration)
  const refresh = useCallback(async () => {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    await Promise.all([
      checkBackendHealth(),
      checkAllModelsHealth(),
    ]);
    refreshInFlight.current = false;
  }, [checkBackendHealth, checkAllModelsHealth]);

  // Workflow orchestration hook
  const {
    workflows,
    runs,
    loading,
    error,
    triggering,
    setLoading,
    fetchWorkflows,
    fetchLatestRuns,
    triggerWorkflow,
    triggerAllWorkflows,
    deployingCount,
  } = useWorkflowOrchestration({
    githubToken,
    githubRepoOwner,
    githubRepoName,
    onActiveDeploymentsChange,
    onRefresh: refresh,
  });

  // Extended refresh that includes workflows
  const fullRefresh = useCallback(async () => {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    setLoading(true);
    await Promise.all([
      fetchWorkflows().then(() => fetchLatestRuns()),
      checkBackendHealth(),
      checkAllModelsHealth(),
    ]);
    refreshInFlight.current = false;
  }, [fetchWorkflows, fetchLatestRuns, checkBackendHealth, checkAllModelsHealth, setLoading]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key.toLowerCase() === 'r' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        fullRefresh();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fullRefresh]);

  // Initial load
  useEffect(() => {
    checkBackendHealth();
    refreshBackendStatus();
    checkAllModelsHealth();
    if (!showOnlyBackend) fetchWorkflows();
  }, [checkBackendHealth, refreshBackendStatus, checkAllModelsHealth, fetchWorkflows, showOnlyBackend]);

  // Fetch runs when workflows are loaded
  useEffect(() => {
    if (workflows.size > 0 && !showOnlyBackend) fetchLatestRuns();
  }, [workflows, fetchLatestRuns, showOnlyBackend]);

  // Polling interval
  useEffect(() => {
    if (showOnlyBackend) return;
    const interval = setInterval(() => {
      if (!refreshInFlight.current) fetchLatestRuns();
      checkAllModelsHealth();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchLatestRuns, showOnlyBackend, checkAllModelsHealth]);

  // Aggregate stats
  const stats = useMemo(() => ({
    ...healthStats,
    deploying: deployingCount,
  }), [healthStats, deployingCount]);

  // Deployment status helper
  const getDeploymentStatusForApp = (appId: string): 'success' | 'failure' | 'in_progress' | 'queued' | 'unknown' => {
    const workflowName = appId === 'chat-api' ? 'Chat' : SERVICE_TO_WORKFLOW.get(appId) || null;
    if (!workflowName) return 'unknown';
    const run = runs.get(workflowName);
    if (!run) return 'unknown';
    if (run.status === 'in_progress') return 'in_progress';
    if (run.status === 'queued') return 'queued';
    if (run.conclusion === 'success') return 'success';
    if (run.conclusion === 'failure') return 'failure';
    return 'unknown';
  };

  // URL helpers
  const publicDomain = modelsBaseDomain || 'neevs.io';
  const publicScheme = modelsBaseDomain ? (modelsUseHttps ? 'https' : 'http') : 'https';
  const chatPublicUrl = (chatApiBaseUrl.includes('localhost') || chatApiBaseUrl.includes('127.0.0.1'))
    ? `${publicScheme}://chat.${publicDomain}`
    : (normalizeBaseUrl(chatApiBaseUrl) || `${publicScheme}://chat.${publicDomain}`);

  // Build app data
  const buildApp = (appId: string, name: string, isChatApi = false) => {
    if (isChatApi) {
      const status = backendHealth.status === 'ok' ? 'running' as const :
                     backendHealth.status === 'down' ? 'stopped' as const : 'checking' as const;
      return {
        id: 'chat-api',
        name: 'Chat API',
        status,
        deploymentStatus: getDeploymentStatusForApp('chat-api'),
        latency: backendHealth.latency,
        publicEndpoint: `chat.${publicDomain}`,
        endpointUrl: chatPublicUrl,
      };
    }
    const health = modelHealthStatuses.get(appId) || { status: 'checking' as const };
    return {
      id: appId,
      name,
      status: health.status,
      deploymentStatus: getDeploymentStatusForApp(appId),
      latency: health.latency,
      publicEndpoint: `${appId}.${publicDomain}`,
      endpointUrl: `${publicScheme}://${appId}.${publicDomain}`,
    };
  };

  const allApps = [
    buildApp('chat-api', 'Chat API', true),
    ...SERVICES.map(service => buildApp(service.key, service.name))
  ];

  const filteredAndSortedApps = useMemo(() => {
    let apps = [...allApps];
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      apps = apps.filter(app => app.name.toLowerCase().includes(query) || app.id.toLowerCase().includes(query));
    }
    apps.sort((a, b) => {
      const getScore = (app: typeof a) => {
        const isDeploying = app.deploymentStatus === 'in_progress' || app.deploymentStatus === 'queued';
        if (app.status === 'running' || app.status === 'ok' || isDeploying) return 3;
        if (app.status === 'checking') return 2;
        return 1;
      };
      const diff = getScore(b) - getScore(a);
      return diff !== 0 ? diff : a.name.localeCompare(b.name);
    });
    return apps;
  }, [allApps, searchQuery]);

  // Workflow to service mapping
  const workflowToServiceMap = useMemo(() => {
    const map = new Map<string, string>();
    WORKFLOWS.forEach(wf => { if (wf.serviceKey) map.set(wf.name, wf.serviceKey); });
    allApps.forEach(app => {
      const serviceConfig = SERVICES.find(s => s.key === app.id);
      const wfName = serviceConfig ? WORKFLOWS.find(k => k.serviceKey === app.id)?.name : 'Chat';
      if (wfName && !map.has(wfName)) map.set(wfName, app.id);
    });
    return map;
  }, [allApps]);

  // Standalone workflows
  const standaloneWorkflows = useMemo(() => {
    return WORKFLOWS
      .filter(wf => !workflowToServiceMap.has(wf.name))
      .map(wf => ({
        name: wf.name,
        workflowInfo: workflows.get(wf.name),
        run: runs.get(wf.name),
      }));
  }, [workflows, runs, workflowToServiceMap]);

  // Stats for tabs
  const serviceStats = useMemo(() => ({
    online: filteredAndSortedApps.filter(app => app.status === 'running' || app.status === 'ok').length,
    down: filteredAndSortedApps.filter(app => app.status === 'stopped' || app.status === 'down').length,
    total: filteredAndSortedApps.length,
  }), [filteredAndSortedApps]);

  const workflowStats = useMemo(() => ({
    active: standaloneWorkflows.filter(wf => wf.run?.status === 'in_progress' || wf.run?.status === 'queued').length,
    recent: standaloneWorkflows.filter(wf => wf.run).length,
    total: standaloneWorkflows.length,
  }), [standaloneWorkflows]);

  return (
    <div className="space-y-2 pt-2">
      <StatusRing
        online={stats.online}
        down={stats.down}
        checking={stats.checking}
        deploying={stats.deploying}
        total={stats.total}
        loading={loading}
        onRefresh={fullRefresh}
        onSettings={onOpenSettings}
      />

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => triggerWorkflow('Build Images')}
          disabled={!!triggering || !githubToken}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-slate-300 hover:text-white bg-slate-800/30 hover:bg-slate-800/50 border border-slate-700/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Build all images"
        >
          <Package className="w-3.5 h-3.5" />
          <span>Build Images</span>
        </button>
        <button
          onClick={triggerAllWorkflows}
          disabled={!!triggering || !githubToken}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            triggering ? 'bg-blue-500/20 text-blue-400 cursor-wait' : 'bg-blue-500 hover:bg-blue-600 text-white'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
          title="Deploy all services"
        >
          <Rocket className="w-3.5 h-3.5" />
          <span>{triggering ? 'Deploying...' : 'Deploy All'}</span>
        </button>
        <a
          href={`https://github.com/${githubRepoOwner}/${githubRepoName}/actions`}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-slate-300 hover:text-white bg-slate-800/30 hover:bg-slate-800/50 border border-slate-700/30 transition-colors ${
            (!githubRepoOwner || !githubRepoName) ? 'opacity-50 pointer-events-none' : ''
          }`}
          title="Open GitHub Actions"
        >
          <Workflow className="w-3.5 h-3.5" />
          <span>View Actions</span>
        </a>
      </div>

      {/* Search Bar */}
      <div className="relative group">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter apps..."
          className="w-full pl-9 pr-4 py-2 bg-slate-800/40 border border-slate-700/30 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:bg-slate-800/60 focus:border-blue-500/60 transition-all"
        />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-700/30">
        <button
          onClick={() => setActiveTab('services')}
          className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors relative ${
            activeTab === 'services' ? 'text-white' : 'text-slate-400 hover:text-slate-300'
          }`}
        >
          Services
          <span className="ml-2 text-xs text-slate-500">
            {serviceStats.online} running{serviceStats.down > 0 ? `, ${serviceStats.down} down` : ''}
          </span>
          {activeTab === 'services' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />}
        </button>
        {standaloneWorkflows.length > 0 && (
          <button
            onClick={() => setActiveTab('workflows')}
            className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors relative ${
              activeTab === 'workflows' ? 'text-white' : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            Workflows
            <span className="ml-2 text-xs text-slate-500">
              {workflowStats.active > 0 ? `${workflowStats.active} active, ${workflowStats.recent} recent` : `${workflowStats.recent} recent`}
            </span>
            {activeTab === 'workflows' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />}
          </button>
        )}
      </div>

      {/* Services Tab */}
      {activeTab === 'services' && (
        <div className="space-y-2">
          {filteredAndSortedApps.map(app => {
            const serviceConfig = SERVICES.find(s => s.key === app.id);
            const wfName = serviceConfig ? WORKFLOWS.find(k => k.serviceKey === app.id)?.name : 'Chat';
            return (
              <AppCard
                key={app.id}
                name={app.name}
                status={app.status}
                deploymentStatus={app.deploymentStatus}
                latency={app.latency}
                publicEndpoint={app.publicEndpoint}
                endpointUrl={app.endpointUrl}
                latencyHistory={app.id === 'chat-api' ? backendHealthHistory : modelHealthHistory.get(app.id) || []}
                onDeploy={wfName ? () => triggerWorkflow(wfName) : undefined}
                deployTriggering={triggering === wfName}
                deployButton={
                  <DeployPanel
                    appId={app.id}
                    githubToken={githubToken}
                    runs={runs}
                    triggering={triggering}
                    loading={loading}
                    onDeploy={triggerWorkflow}
                    onRefresh={fullRefresh}
                  />
                }
                buildActions={
                  <BuildPanel
                    appId={app.id}
                    buildBusy={buildBusy}
                    buildLogTail={buildLogTail}
                    onBuild={runBuild}
                  />
                }
                observeLogs={
                  <ObservePanel
                    appId={app.id}
                    backendHealth={backendHealth.status}
                    backendProcess={backendProcess}
                    backendPid={backendPid}
                    backendBusy={backendBusy}
                    backendLogTail={backendLogTail}
                    backendNativeError={backendNativeError}
                    chatApiBaseUrl={chatApiBaseUrl}
                    onStart={startBackend}
                    onStop={stopBackend}
                    onFetchLogs={fetchBackendLogs}
                  />
                }
              />
            );
          })}
        </div>
      )}

      {/* Workflows Tab */}
      {activeTab === 'workflows' && standaloneWorkflows.length > 0 && (
        <div className="space-y-2">
          {standaloneWorkflows.map(wf => (
            <WorkflowCard
              key={wf.name}
              name={wf.name}
              status={wf.run?.status}
              conclusion={wf.run?.conclusion}
              updatedAt={wf.run?.updated_at}
              htmlUrl={wf.run?.html_url || (wf.workflowInfo ? `https://github.com/${githubRepoOwner}/${githubRepoName}/actions/workflows/${WORKFLOW_PATHS.get(wf.name)}` : undefined)}
              onTrigger={() => triggerWorkflow(wf.name)}
              triggering={triggering === wf.name}
              disabled={!githubToken}
            />
          ))}
        </div>
      )}

      {/* Errors */}
      <ErrorDisplay message={buildNativeError} />
      <ErrorDisplay message={error} />
    </div>
  );
};

export default DeploymentsPanel;
