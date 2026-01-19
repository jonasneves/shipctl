import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Search } from 'lucide-react';
import HealthRing from './HealthRing';
import Section from './Section';
import ServiceRow from './ServiceRow';
import ServiceDetail from './ServiceDetail';
import WorkflowRow from './WorkflowRow';
import ErrorDisplay from './ErrorDisplay';
import { ToastContainer, type ToastMessage } from './Toast';
import { SERVICES, WORKFLOWS, WORKFLOW_PATHS, SERVICE_TO_WORKFLOW, BUILD_WORKFLOW, REGISTRY_CONFIG } from '../hooks/useExtensionConfig';
import { useHealthMonitoring } from '../hooks/useHealthMonitoring';
import { useBackendControl } from '../hooks/useBackendControl';
import { useWorkflowOrchestration } from '../hooks/useWorkflowOrchestration';
import { normalizeBaseUrl } from '../utils/url';

interface ControlPanelProps {
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
  onConnectGitHub?: () => void;
  connectingGitHub?: boolean;
}

const ControlPanel: React.FC<ControlPanelProps> = ({
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
  onConnectGitHub,
  connectingGitHub,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const refreshInFlight = useRef(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const addToast = useCallback((type: 'success' | 'error', message: string) => {
    setToasts(prev => [...prev, { id: crypto.randomUUID(), type, message }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Health monitoring hook
  const {
    backendHealth,
    modelHealthStatuses,
    backendHealthHistory,
    modelHealthHistory,
    checkBackendHealth,
    checkAllModelsHealth,
    stats: healthStats,
  } = useHealthMonitoring({ modelsBaseDomain, modelsUseHttps });

  // Backend control hook
  const {
    backendProcess,
    backendPid,
    backendBusy,
    backendLogTail,
    buildBusy,
    buildLogTail,
    buildNativeError,
    refreshBackendStatus,
    startBackend,
    stopBackend,
    restartBackend,
    fetchBackendLogs,
    runBuild,
  } = useBackendControl({
    chatApiBaseUrl,
    modelsBaseDomain,
    onBackendStatusChange,
    checkBackendHealth,
  });

  // Refresh function
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
    standaloneRuns,
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
  } = useWorkflowOrchestration({
    githubToken,
    githubRepoOwner,
    githubRepoName,
    onActiveDeploymentsChange,
    onRefresh: refresh,
    onTriggerSuccess: (name) => addToast('success', `${name} triggered`),
    onTriggerError: (name, err) => addToast('error', `${name}: ${err}`),
  });

  // Full refresh including workflows
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
      if (e.key === 'Escape' && selectedService) {
        setSelectedService(null);
      }
      // Focus search on printable character
      if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fullRefresh, selectedService]);

  // Initial load
  useEffect(() => {
    checkBackendHealth();
    refreshBackendStatus();
    checkAllModelsHealth();
    if (!showOnlyBackend) fetchWorkflows();
  }, [checkBackendHealth, refreshBackendStatus, checkAllModelsHealth, fetchWorkflows, showOnlyBackend]);

  // Fetch runs when workflows loaded
  useEffect(() => {
    if (workflows.size > 0 && !showOnlyBackend) fetchLatestRuns();
  }, [workflows, fetchLatestRuns, showOnlyBackend]);

  // Polling
  useEffect(() => {
    if (showOnlyBackend) return;
    const interval = setInterval(() => {
      if (!refreshInFlight.current) fetchLatestRuns();
      checkBackendHealth();
      checkAllModelsHealth();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchLatestRuns, showOnlyBackend, checkBackendHealth, checkAllModelsHealth]);

  // Stats
  const stats = useMemo(() => ({
    ...healthStats,
    deploying: deployingCount,
  }), [healthStats, deployingCount]);

  // Workflow status for services
  // These are LONG-RUNNING services, so:
  // - in_progress = service is running normally (good!)
  // - completed + success = service stopped (bad for a service!)
  // - completed + failure = service crashed
  // - queued = service is starting up
  // - recentlyTriggered = user just clicked Start, show "starting" immediately
  const getWorkflowStatusForService = (appId: string): 'running' | 'stopped' | 'failed' | 'starting' | 'unknown' => {
    const workflowName = SERVICE_TO_WORKFLOW.get(appId);
    if (!workflowName) return 'unknown';

    if (recentlyTriggered.has(workflowName)) return 'starting';

    const run = runs.get(workflowName);
    if (!run) return 'unknown';
    if (run.status === 'in_progress') return 'running';
    if (run.status === 'queued') return 'starting';
    if (run.conclusion === 'failure') return 'failed';
    if (run.conclusion === 'success') return 'stopped';
    return 'unknown';
  };

  // URL helpers
  const publicDomain = modelsBaseDomain || REGISTRY_CONFIG.domain.base;
  const publicScheme = modelsBaseDomain ? (modelsUseHttps ? 'https' : 'http') : (REGISTRY_CONFIG.domain.useHttps ? 'https' : 'http');
  const chatPublicUrl = (chatApiBaseUrl.includes('localhost') || chatApiBaseUrl.includes('127.0.0.1'))
    ? `${publicScheme}://chat.${publicDomain}`
    : (normalizeBaseUrl(chatApiBaseUrl) || `${publicScheme}://chat.${publicDomain}`);
  const isLocalChat = chatApiBaseUrl.includes('localhost') || chatApiBaseUrl.includes('127.0.0.1');

  // Map health status to service status
  const healthToStatus = (status: 'ok' | 'down' | 'checking') =>
    status === 'ok' ? 'running' as const :
    status === 'down' ? 'stopped' as const : 'checking' as const;

  // Build chat-api service data
  const chatApiService = useMemo(() => ({
    id: 'chat-api',
    name: 'Chat API',
    status: healthToStatus(backendHealth.status),
    workflowStatus: 'unknown' as const, // Will be derived from standaloneRuns
    latency: backendHealth.latency,
    publicEndpoint: `chat.${publicDomain}`,
    endpointUrl: chatPublicUrl,
  }), [backendHealth, publicDomain, chatPublicUrl]);

  // Build service data for model services
  const buildService = (appId: string, name: string) => {
    const health = modelHealthStatuses.get(appId) || { status: 'checking' as const };
    return {
      id: appId,
      name,
      status: healthToStatus(health.status),
      workflowStatus: getWorkflowStatusForService(appId),
      latency: health.latency,
      publicEndpoint: `${appId}.${publicDomain}`,
      endpointUrl: `${publicScheme}://${appId}.${publicDomain}`,
    };
  };

  const allServices = useMemo(() =>
    SERVICES.map(service => buildService(service.key, service.name))
  , [modelHealthStatuses, runs, recentlyTriggered]);

  // Group workflows by path to create sections
  const workflowSections = useMemo(() => {
    const sectionMap = new Map<string, {
      name: string;
      services: typeof allServices;
      standaloneWorkflows: { name: string; workflowName: string; workflowInfo: any; run: any }[];
    }>();

    // Group workflows by path
    for (const wf of WORKFLOWS) {
      const sectionName = wf.path.replace('.yml', '');
      if (!sectionMap.has(sectionName)) {
        sectionMap.set(sectionName, { name: sectionName, services: [], standaloneWorkflows: [] });
      }
      const section = sectionMap.get(sectionName)!;

      if (wf.serviceKey) {
        // Service-backed workflow
        const service = allServices.find(s => s.id === wf.serviceKey);
        if (service) section.services.push(service);
      } else if (wf.name === 'Chat') {
        // Chat workflow: show each active run as a service row (clickable for controls)
        const activeRunsList = standaloneRuns.get(wf.name) || [];
        if (activeRunsList.length > 0) {
          for (const run of activeRunsList) {
            section.services.push({
              ...chatApiService,
              name: run.display_title || 'Chat API',
            });
          }
        } else {
          // No active runs - show default chat-api service
          section.services.push(chatApiService);
        }
      } else {
        // Standalone workflow - show all active runs as separate rows
        const activeRunsList = standaloneRuns.get(wf.name) || [];
        if (activeRunsList.length > 0) {
          for (const run of activeRunsList) {
            section.standaloneWorkflows.push({
              name: run.display_title || wf.name,
              workflowName: wf.name,
              workflowInfo: workflows.get(wf.name),
              run,
            });
          }
        } else {
          // No runs - show workflow with no status
          section.standaloneWorkflows.push({
            name: wf.name,
            workflowName: wf.name,
            workflowInfo: workflows.get(wf.name),
            run: null,
          });
        }
      }
    }

    // Sort and filter within each section
    for (const section of sectionMap.values()) {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        section.services = section.services.filter(s =>
          s.name.toLowerCase().includes(query) || s.id.toLowerCase().includes(query)
        );
        section.standaloneWorkflows = section.standaloneWorkflows.filter(w =>
          w.name.toLowerCase().includes(query)
        );
      }
      section.services.sort((a, b) => {
        const getScore = (s: typeof a) => {
          const isWorkflowBad = s.workflowStatus === 'stopped' || s.workflowStatus === 'failed';
          if (s.status === 'stopped' || isWorkflowBad) return 4;
          if (s.workflowStatus === 'starting') return 3;
          if (s.status === 'running') return 2;
          return 1;
        };
        const diff = getScore(b) - getScore(a);
        return diff !== 0 ? diff : a.name.localeCompare(b.name);
      });
    }

    return sectionMap;
  }, [allServices, chatApiService, workflows, runs, standaloneRuns, searchQuery]);

  // GitHub Actions URL
  const githubActionsUrl = githubRepoOwner && githubRepoName
    ? `https://github.com/${githubRepoOwner}/${githubRepoName}/actions`
    : undefined;

  // Build workflow name (for HealthRing actions)
  const buildWorkflowName = BUILD_WORKFLOW?.name;

  // If a service is selected, show detail view
  if (selectedService) {
    const isChatApi = selectedService === 'chat-api';
    const service = isChatApi ? chatApiService : allServices.find(s => s.id === selectedService);
    if (service) {
      const workflowName = isChatApi ? 'Chat' : SERVICE_TO_WORKFLOW.get(service.id);
      const lastRun = workflowName ? runs.get(workflowName) : null;

      // Get local endpoint for this service
      const serviceConfig = SERVICES.find(s => s.key === service.id);
      const localPort = isChatApi ? 8080 : serviceConfig?.localPort;
      const localEndpoint = localPort ? `localhost:${localPort}` : undefined;
      const localEndpointUrl = localPort ? `http://localhost:${localPort}` : undefined;

      return (
        <ServiceDetail
          name={service.name}
          status={service.status}
          latency={service.latency}
          latencyHistory={isChatApi ? backendHealthHistory : modelHealthHistory.get(service.id) || []}
          publicEndpoint={service.publicEndpoint}
          endpointUrl={service.endpointUrl}
          localEndpoint={localEndpoint}
          localEndpointUrl={localEndpointUrl}
          workflowStatus={service.workflowStatus}
          lastRun={lastRun}
          onStartCloud={workflowName && githubToken ? () => triggerWorkflow(workflowName) : undefined}
          onStopCloud={workflowName && githubToken ? () => cancelWorkflow(workflowName) : undefined}
          onBuildCloud={buildWorkflowName && githubToken ? () => triggerWorkflow(buildWorkflowName) : undefined}
          cloudTriggering={triggering === workflowName}
          cloudStopping={triggering === `stopping:${workflowName}`}
          cloudBuilding={triggering === buildWorkflowName}
          onBuild={isChatApi ? () => runBuild('playground') : undefined}
          buildBusy={buildBusy}
          buildLogTail={buildLogTail}
          backendProcess={backendProcess}
          backendPid={backendPid}
          backendBusy={backendBusy}
          backendLogTail={backendLogTail}
          isLocalChat={isLocalChat && isChatApi}
          onStart={startBackend}
          onStop={stopBackend}
          onRestart={restartBackend}
          onFetchLogs={fetchBackendLogs}
          onBack={() => setSelectedService(null)}
        />
      );
    }
  }

  // Main list view
  return (
    <div className="flex flex-col h-full bg-[#0a0f14]">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Fixed header */}
      <div className="p-3 space-y-3">
        <HealthRing
          online={stats.online}
          down={stats.down}
          deploying={stats.deploying}
          total={stats.total}
          loading={loading}
          repoName={githubRepoOwner && githubRepoName ? `${githubRepoOwner}/${githubRepoName}` : undefined}
          onRefresh={fullRefresh}
          onSettings={onOpenSettings}
          onRestartAll={githubToken ? triggerAllWorkflows : undefined}
          onStopAll={githubToken ? cancelAllRunning : undefined}
          onBuildImages={githubToken && buildWorkflowName ? () => triggerWorkflow(buildWorkflowName) : undefined}
          isRestarting={!!triggering && triggering !== buildWorkflowName && triggering !== 'stopping'}
          isStopping={triggering === 'stopping'}
          isBuildingImages={triggering === buildWorkflowName}
          actionsDisabled={!githubToken}
          githubActionsUrl={githubActionsUrl}
        />
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter services..."
            autoComplete="off"
            className="w-full pl-10 pr-4 py-2.5 bg-[#0f1419] border border-[#1e2832] rounded-xl text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-colors"
          />
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-3">
        {/* GitHub auth prompt */}
        {!githubToken && onConnectGitHub && (
          <button
            onClick={onConnectGitHub}
            disabled={connectingGitHub}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-800/50 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed border border-slate-700 rounded-xl transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
            </svg>
            <span className="text-sm text-slate-300">{connectingGitHub ? 'Connecting...' : 'Connect GitHub'}</span>
          </button>
        )}

        {/* Workflow sections */}
        {Array.from(workflowSections.entries()).map(([sectionName, section]) => {
          const hasServices = section.services.length > 0;
          const hasWorkflows = section.standaloneWorkflows.length > 0;
          if (!hasServices && !hasWorkflows) return null;

          const online = section.services.filter(s => s.status === 'running').length;
          const total = section.services.length;
          const down = section.services.filter(s => s.status === 'stopped').length;

          return (
            <Section
              key={sectionName}
              title={sectionName}
              badge={total > 1 ? `${online}/${total}` : undefined}
              badgeColor={down > 0 ? 'danger' : 'success'}
              defaultOpen={true}
            >
              <div className="space-y-0.5">
                {section.services.map(service => (
                  <ServiceRow
                    key={service.id}
                    name={service.name}
                    status={service.status}
                    workflowStatus={service.workflowStatus}
                    latency={service.latency}
                    onClick={() => setSelectedService(service.id)}
                  />
                ))}
                {section.standaloneWorkflows.map(wf => (
                  <WorkflowRow
                    key={wf.run?.id || wf.workflowName}
                    name={wf.name}
                    status={wf.run?.status}
                    conclusion={wf.run?.conclusion}
                    htmlUrl={wf.run?.html_url || (wf.workflowInfo ? `https://github.com/${githubRepoOwner}/${githubRepoName}/actions/workflows/${sectionName}.yml` : undefined)}
                    onTrigger={() => triggerWorkflow(wf.workflowName)}
                    triggering={triggering === wf.workflowName}
                    disabled={!githubToken}
                  />
                ))}
              </div>
            </Section>
          );
        })}


        {/* Errors */}
        <ErrorDisplay message={buildNativeError} />
        <ErrorDisplay message={error} />
      </div>
    </div>
  );
};

export default ControlPanel;
