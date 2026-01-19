import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Search } from 'lucide-react';
import HealthRing from './HealthRing';
import Section from './Section';
import ServiceRow from './ServiceRow';
import ServiceDetail from './ServiceDetail';
import WorkflowRow from './WorkflowRow';
import ErrorDisplay from './ErrorDisplay';
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
    loading,
    error,
    triggering,
    recentlyTriggered,
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
      checkAllModelsHealth();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchLatestRuns, showOnlyBackend, checkAllModelsHealth]);

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
    // chat-api maps to 'Chat' workflow (not in generated SERVICE_TO_WORKFLOW)
    const workflowName = appId === 'chat-api' ? 'Chat' : SERVICE_TO_WORKFLOW.get(appId) || null;
    if (!workflowName) return 'unknown';

    // If we just triggered this workflow, show "starting" immediately
    // (before the API poll catches the queued run)
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

  // Build service data
  const buildService = (appId: string, name: string, isChatApi = false) => {
    if (isChatApi) {
      const status = backendHealth.status === 'ok' ? 'running' as const :
                     backendHealth.status === 'down' ? 'stopped' as const : 'checking' as const;
      return {
        id: 'chat-api',
        name: 'Chat API',
        status,
        workflowStatus: getWorkflowStatusForService('chat-api'),
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
      workflowStatus: getWorkflowStatusForService(appId),
      latency: health.latency,
      publicEndpoint: `${appId}.${publicDomain}`,
      endpointUrl: `${publicScheme}://${appId}.${publicDomain}`,
    };
  };

  const allServices = useMemo(() => [
    buildService('chat-api', 'Chat API', true),
    ...SERVICES.map(service => buildService(service.key, service.name))
  ], [backendHealth, modelHealthStatuses, runs, recentlyTriggered]);

  // Group workflows by path to create sections
  const workflowSections = useMemo(() => {
    const sectionMap = new Map<string, {
      name: string;
      services: typeof allServices;
      standaloneWorkflows: { name: string; workflowInfo: any; run: any }[];
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
        // Chat workflow maps to chat-api service (not in generated config)
        const chatService = allServices.find(s => s.id === 'chat-api');
        if (chatService) section.services.push(chatService);
      } else {
        // Standalone workflow
        section.standaloneWorkflows.push({
          name: wf.name,
          workflowInfo: workflows.get(wf.name),
          run: runs.get(wf.name),
        });
      }
    }

    // Sort and filter services within each section
    for (const section of sectionMap.values()) {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        section.services = section.services.filter(s =>
          s.name.toLowerCase().includes(query) || s.id.toLowerCase().includes(query)
        );
      }
      section.services.sort((a, b) => {
        const getScore = (s: typeof a) => {
          const isDown = s.status === 'stopped' || s.status === 'down';
          const isWorkflowStopped = s.workflowStatus === 'stopped' || s.workflowStatus === 'failed';
          const isStarting = s.workflowStatus === 'starting';
          if (isDown || isWorkflowStopped) return 4;
          if (isStarting) return 3;
          if (s.status === 'running' || s.status === 'ok') return 2;
          return 1;
        };
        const diff = getScore(b) - getScore(a);
        return diff !== 0 ? diff : a.name.localeCompare(b.name);
      });
    }

    return sectionMap;
  }, [allServices, workflows, runs, searchQuery]);

  // GitHub Actions URL
  const githubActionsUrl = githubRepoOwner && githubRepoName
    ? `https://github.com/${githubRepoOwner}/${githubRepoName}/actions`
    : undefined;

  // Build workflow name (for HealthRing actions)
  const buildWorkflowName = BUILD_WORKFLOW?.name;

  // Is local chat mode
  const isLocalChat = chatApiBaseUrl.includes('localhost') || chatApiBaseUrl.includes('127.0.0.1');

  // If a service is selected, show detail view
  if (selectedService) {
    const service = allServices.find(s => s.id === selectedService);
    if (service) {
      const workflowName = service.id === 'chat-api' ? 'Chat' : SERVICE_TO_WORKFLOW.get(service.id);
      const lastRun = workflowName ? runs.get(workflowName) : null;

      // Get local endpoint for this service
      const serviceConfig = SERVICES.find(s => s.key === service.id);
      const localPort = service.id === 'chat-api' ? 8080 : serviceConfig?.localPort;
      const localEndpoint = localPort ? `localhost:${localPort}` : undefined;
      const localEndpointUrl = localPort ? `http://localhost:${localPort}` : undefined;

      return (
        <ServiceDetail
          name={service.name}
          status={service.status}
          latency={service.latency}
          latencyHistory={service.id === 'chat-api' ? backendHealthHistory : modelHealthHistory.get(service.id) || []}
          publicEndpoint={service.publicEndpoint}
          endpointUrl={service.endpointUrl}
          localEndpoint={localEndpoint}
          localEndpointUrl={localEndpointUrl}
          workflowStatus={service.workflowStatus}
          lastRun={lastRun}
          onStartCloud={workflowName && githubToken ? () => triggerWorkflow(workflowName) : undefined}
          cloudTriggering={triggering === workflowName}
          onBuild={service.id === 'chat-api' ? () => runBuild('playground') : undefined}
          buildBusy={buildBusy}
          buildLogTail={buildLogTail}
          backendProcess={backendProcess}
          backendPid={backendPid}
          backendBusy={backendBusy}
          backendLogTail={backendLogTail}
          isLocalChat={isLocalChat}
          onStart={startBackend}
          onStop={stopBackend}
          onFetchLogs={fetchBackendLogs}
          onBack={() => setSelectedService(null)}
        />
      );
    }
  }

  // Main list view
  return (
    <div className="flex flex-col h-full bg-[#0a0f14]">
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {/* Health Ring */}
        <HealthRing
          online={stats.online}
          down={stats.down}
          deploying={stats.deploying}
          total={stats.total}
          loading={loading}
          onRefresh={fullRefresh}
          onSettings={onOpenSettings}
          onRestartAll={githubToken ? triggerAllWorkflows : undefined}
          onBuildImages={githubToken && buildWorkflowName ? () => triggerWorkflow(buildWorkflowName) : undefined}
          isRestarting={!!triggering && triggering !== buildWorkflowName}
          isBuildingImages={triggering === buildWorkflowName}
          actionsDisabled={!githubToken}
          githubActionsUrl={githubActionsUrl}
        />

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter services..."
            className="w-full pl-10 pr-4 py-2.5 bg-[#0f1419] border border-[#1e2832] rounded-xl text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-all"
          />
        </div>

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

          const online = section.services.filter(s => s.status === 'running' || s.status === 'ok').length;
          const total = section.services.length;
          const down = section.services.filter(s => s.status === 'stopped' || s.status === 'down').length;

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
                    key={wf.name}
                    name={wf.name}
                    status={wf.run?.status}
                    conclusion={wf.run?.conclusion}
                    htmlUrl={wf.run?.html_url || (wf.workflowInfo ? `https://github.com/${githubRepoOwner}/${githubRepoName}/actions/workflows/${sectionName}.yml` : undefined)}
                    onTrigger={() => triggerWorkflow(wf.name)}
                    triggering={triggering === wf.name}
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
