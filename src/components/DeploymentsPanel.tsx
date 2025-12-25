import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import AppCard from './AppCard';
import BuildPanel from './BuildPanel';
import DeployPanel from './DeployPanel';
import ObservePanel from './ObservePanel';
import StatusRing from './StatusRing';
import CategoryHeader from './CategoryHeader';
import {
    SERVICES,
    WORKFLOWS,
    CATEGORIES,
    WORKFLOW_PATHS,
    SERVICE_TO_WORKFLOW,
    ServiceConfig,
    buildEndpoint,
    getServicesGroupedByCategory
} from '../hooks/useExtensionConfig';
import { GitHubService, type WorkflowRun, type WorkflowInfo } from '../services/github';
import { healthChecker, type HealthStatus } from '../services/healthCheck';
import { nativeHost } from '../services/nativeHost';
import { normalizeBaseUrl } from '../utils/url';

interface DeploymentsPanelProps {
    githubToken: string;
    githubRepoOwner: string;
    githubRepoName: string;
    chatApiBaseUrl: string;
    modelsBaseDomain: string;
    modelsUseHttps: boolean;
    globalTab: 'build' | 'deploy' | 'observe';
    showOnlyBackend?: boolean;
    onBackendStatusChange?: (status: { process: 'running' | 'stopped' | 'unknown'; mode: string | null }) => void;
    onActiveDeploymentsChange?: (count: number) => void;
}

const KEY_WORKFLOWS = WORKFLOWS;

const DeploymentsPanel: React.FC<DeploymentsPanelProps> = ({ githubToken, githubRepoOwner, githubRepoName, chatApiBaseUrl, modelsBaseDomain, modelsUseHttps, globalTab, showOnlyBackend = false, onBackendStatusChange, onActiveDeploymentsChange }) => {
    const [workflows, setWorkflows] = useState<Map<string, WorkflowInfo>>(new Map());
    const [runs, setRuns] = useState<Map<string, WorkflowRun | null>>(new Map());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [triggering, setTriggering] = useState<string | null>(null);
    const [backendHealth, setBackendHealth] = useState<HealthStatus>({ status: 'checking' });
    const [backendProcess, setBackendProcess] = useState<'running' | 'stopped' | 'unknown'>('unknown');
    const [backendPid, setBackendPid] = useState<number | null>(null);
    const [backendBusy, setBackendBusy] = useState(false);
    const [backendLogTail, setBackendLogTail] = useState<string | null>(null);
    const [backendNativeError, setBackendNativeError] = useState<string | null>(null);
    const [modelHealthStatuses, setModelHealthStatuses] = useState<Map<string, HealthStatus>>(new Map());
    const [buildBusy, setBuildBusy] = useState(false);
    const [buildLogTail, setBuildLogTail] = useState<string | null>(null);
    const [buildNativeError, setBuildNativeError] = useState<string | null>(null);
    const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
    const refreshInFlight = useRef(false);
    const workflowsRef = useRef<Map<string, WorkflowInfo>>(new Map());

    const github = useMemo(() => new GitHubService(githubToken, githubRepoOwner, githubRepoName), [githubToken, githubRepoOwner, githubRepoName]);

    // Aggregate status stats
    const stats = useMemo(() => {
        const healthValues = [...modelHealthStatuses.values()];
        const runValues = [...runs.values()];
        return {
            online: healthValues.filter(s => s.status === 'ok').length,
            checking: healthValues.filter(s => s.status === 'checking').length,
            down: healthValues.filter(s => s.status === 'down').length,
            deploying: runValues.filter(r => r?.status === 'in_progress' || r?.status === 'queued').length,
            total: SERVICES.length,
        };
    }, [modelHealthStatuses, runs]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if typing in input
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            switch (e.key.toLowerCase()) {
                case 'r':
                    if (!e.metaKey && !e.ctrlKey) {
                        e.preventDefault();
                        refresh();
                    }
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const checkBackendHealth = useCallback(async () => {
        setBackendHealth({ status: 'checking' });
        const baseUrl = normalizeBaseUrl(chatApiBaseUrl) || 'http://localhost:8080';
        const status = await healthChecker.check(baseUrl, 5000);
        setBackendHealth(status);
    }, [chatApiBaseUrl]);

    const checkAllModelsHealth = useCallback(async () => {
        for (const service of SERVICES) {
            const endpoint = buildEndpoint(service.key, service.localPort, modelsBaseDomain, modelsUseHttps);
            setModelHealthStatuses(prev => new Map(prev).set(service.key, { status: 'checking' }));
        }

        for (const service of SERVICES) {
            const endpoint = buildEndpoint(service.key, service.localPort, modelsBaseDomain, modelsUseHttps);
            const status = await healthChecker.check(endpoint, 3000);
            setModelHealthStatuses(prev => new Map(prev).set(service.key, status));
        }
    }, [modelsBaseDomain, modelsUseHttps]);

    const refreshBackendStatus = useCallback(async () => {
        const normalized = normalizeBaseUrl(chatApiBaseUrl) || 'http://localhost:8080';
        const resp = await nativeHost.status(normalized);
        if (resp?.ok) {
            const process = resp.status === 'running' ? 'running' : 'stopped';
            const mode = resp.mode ?? null;
            setBackendProcess(process);
            setBackendPid(resp.pid ?? null);
            setBackendNativeError(null);
            onBackendStatusChange?.({ process, mode });
            return;
        }
        setBackendNativeError(resp?.error || null);
        setBackendProcess('unknown');
        setBackendPid(null);
        onBackendStatusChange?.({ process: 'unknown', mode: null });
    }, [chatApiBaseUrl, onBackendStatusChange]);

    const startBackend = async () => {
        setBackendBusy(true);
        setBackendLogTail(null);
        setBackendNativeError(null);

        const isLocalChat = chatApiBaseUrl.includes('localhost') || chatApiBaseUrl.includes('127.0.0.1');
        if (!isLocalChat) {
            setBackendNativeError('Backend start only works with local chat API');
            setBackendBusy(false);
            return;
        }

        const mode = modelsBaseDomain ? 'dev-chat' : 'dev-interface-local';
        const resp = await nativeHost.start(mode);
        if (!resp?.ok && resp?.logTail) setBackendLogTail(resp.logTail);
        if (!resp?.ok && resp?.error) setBackendNativeError(resp.error);
        await refreshBackendStatus();
        await checkBackendHealth();
        setBackendBusy(false);
    };

    const stopBackend = async () => {
        setBackendBusy(true);
        setBackendLogTail(null);
        setBackendNativeError(null);
        await nativeHost.stop();
        await refreshBackendStatus();
        await checkBackendHealth();
        setBackendBusy(false);
    };

    const fetchBackendLogs = async () => {
        const resp = await nativeHost.logs();
        if (resp?.ok) setBackendLogTail(resp.logTail || null);
        if (!resp?.ok && resp?.error) setBackendNativeError(resp.error);
    };

    const runBuild = async (target: 'playground' | 'extension' | 'both') => {
        setBuildBusy(true);
        setBuildLogTail(null);
        setBuildNativeError(null);

        const targets = target === 'both'
            ? ['build-playground', 'build-extension']
            : [`build-${target}`];

        for (const t of targets) {
            const resp = await nativeHost.make(t);
            if (resp?.logTail) setBuildLogTail(prev => prev ? `${prev}\n\n--- ${t} ---\n${resp.logTail}` : (resp.logTail || null));
            if (!resp?.ok) {
                setBuildNativeError(resp?.error || `${t} failed`);
                setBuildBusy(false);
                return;
            }
        }

        setBuildBusy(false);
    };

    const fetchWorkflows = useCallback(async () => {
        if (!githubToken) {
            setError('GitHub token required');
            setLoading(false);
            return;
        }

        try {
            const workflows = await github.getWorkflows();
            const wfMap = new Map<string, WorkflowInfo>();
            for (const wf of workflows) {
                const key = KEY_WORKFLOWS.find(k => wf.path?.endsWith(k.path));
                if (key) wfMap.set(key.name, { id: wf.id, name: key.name, path: wf.path });
            }
            setWorkflows(wfMap);
            workflowsRef.current = wfMap;
            setError(null);
        } catch (err: any) {
            setError(err.message);
        }
    }, [githubToken, github]);

    const fetchLatestRuns = useCallback(async () => {
        if (!githubToken || workflowsRef.current.size === 0) return;

        const newRuns = new Map<string, WorkflowRun | null>();
        let activeCount = 0;

        for (const [name, wf] of workflowsRef.current) {
            try {
                const run = await github.getLatestRun(wf.id);
                newRuns.set(name, run);
                if (run?.status === 'in_progress' || run?.status === 'queued') activeCount++;
            } catch {
                newRuns.set(name, null);
            }
        }

        setRuns(newRuns);
        onActiveDeploymentsChange?.(activeCount);
        setLoading(false);
    }, [githubToken, github, onActiveDeploymentsChange]);

    const refresh = useCallback(async () => {
        if (refreshInFlight.current) return;
        refreshInFlight.current = true;
        setLoading(true);
        await Promise.all([
            fetchWorkflows().then(() => fetchLatestRuns()),
            checkBackendHealth(),
            checkAllModelsHealth(),
        ]);
        refreshInFlight.current = false;
    }, [fetchWorkflows, fetchLatestRuns, checkBackendHealth, checkAllModelsHealth]);

    const triggerWorkflow = async (workflowName: string) => {
        const wf = workflows.get(workflowName);
        const fallbackPath = WORKFLOW_PATHS.get(workflowName);
        if (!wf && !fallbackPath) {
            setError(`Workflow ${workflowName} not found`);
            return;
        }

        setTriggering(workflowName);
        try {
            const workflowIdentifier = wf?.id ?? fallbackPath;
            const success = await github.triggerWorkflow(workflowIdentifier!);

            if (success) {
                setTimeout(() => refresh(), 3000);
            } else {
                setError(`Failed to trigger ${workflowName}`);
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setTriggering(null);
        }
    };

    const triggerCategoryWorkflows = async (category: string) => {
        const categoryWorkflows = KEY_WORKFLOWS.filter(wf => wf.category === category && wf.serviceKey);
        for (const wf of categoryWorkflows) {
            await triggerWorkflow(wf.name);
        }
    };

    useEffect(() => {
        checkBackendHealth();
        refreshBackendStatus();
        checkAllModelsHealth();

        if (!showOnlyBackend) {
            fetchWorkflows().then(() => fetchLatestRuns());
        }
    }, [checkBackendHealth, refreshBackendStatus, checkAllModelsHealth, fetchWorkflows, fetchLatestRuns, showOnlyBackend]);

    useEffect(() => {
        if (showOnlyBackend) return;

        const interval = setInterval(() => {
            if (!refreshInFlight.current) {
                fetchLatestRuns();
            }
            checkAllModelsHealth();
        }, 30000);

        return () => clearInterval(interval);
    }, [fetchLatestRuns, showOnlyBackend, checkAllModelsHealth]);



    const defaultTabs: Record<string, 'build' | 'deploy' | 'observe'> = {
        'chat-api': 'observe',
    };
    SERVICES.forEach(service => {
        defaultTabs[service.key] = 'observe';
    });

    const [activeTabs, setActiveTabs] = useState<Record<string, 'build' | 'deploy' | 'observe'>>(defaultTabs);

    useEffect(() => {
        const updatedTabs: Record<string, 'build' | 'deploy' | 'observe'> = { 'chat-api': globalTab };
        SERVICES.forEach(service => {
            updatedTabs[service.key] = globalTab;
        });
        setActiveTabs(updatedTabs);
    }, [globalTab]);

    const setActiveTab = (appId: string, tab: 'build' | 'deploy' | 'observe') => {
        setActiveTabs(prev => ({ ...prev, [appId]: tab }));
    };

    const getDeploymentStatusForApp = (appId: string): 'success' | 'failure' | 'in_progress' | 'queued' | 'unknown' => {
        let workflowName: string | null = null;

        if (appId === 'chat-api') {
            workflowName = 'Chat';
        } else {
            // Use generated mapping
            workflowName = SERVICE_TO_WORKFLOW.get(appId) || null;
        }

        if (!workflowName) return 'unknown';

        const run = runs.get(workflowName);
        if (!run) return 'unknown';

        if (run.status === 'in_progress') return 'in_progress';
        if (run.status === 'queued') return 'queued';
        if (run.conclusion === 'success') return 'success';
        if (run.conclusion === 'failure') return 'failure';

        return 'unknown';
    };

    const buildWorkflowUrl = (workflowName: string | null) => {
        if (!workflowName) return undefined;
        const path = WORKFLOW_PATHS.get(workflowName);
        return path ? `https://github.com/${githubRepoOwner}/${githubRepoName}/actions/workflows/${path}` : `https://github.com/${githubRepoOwner}/${githubRepoName}/actions`;
    };

    const toggleCategory = (categoryId: string) => {
        setCollapsedCategories(prev => {
            const newSet = new Set(prev);
            if (newSet.has(categoryId)) {
                newSet.delete(categoryId);
            } else {
                newSet.add(categoryId);
            }
            return newSet;
        });
    };

    const chatEndpoint = normalizeBaseUrl(chatApiBaseUrl) || 'http://localhost:8080';
    const publicDomain = modelsBaseDomain || 'neevs.io';
    const publicScheme = modelsBaseDomain ? (modelsUseHttps ? 'https' : 'http') : 'https';
    const chatPublicUrl = (chatApiBaseUrl.includes('localhost') || chatApiBaseUrl.includes('127.0.0.1'))
        ? `${publicScheme}://chat.${publicDomain}`
        : (normalizeBaseUrl(chatApiBaseUrl) || `${publicScheme}://chat.${publicDomain}`);

    // Build apps grouped by category
    const buildApp = (service: ServiceConfig | null, appId: string, name: string, isChatApi: boolean = false) => {
        if (isChatApi) {
            return {
                id: 'chat-api',
                name: 'Chat API',
                status: backendHealth.status === 'ok' ? 'running' as const : backendHealth.status === 'down' ? 'stopped' as const : 'checking' as const,
                deploymentStatus: getDeploymentStatusForApp('chat-api'),
                localStatus: chatApiBaseUrl.includes('localhost') || chatApiBaseUrl.includes('127.0.0.1') ? backendHealth.status : undefined,
                latency: backendHealth.latency,
                publicEndpoint: `chat.${publicDomain}`,
                endpointUrl: chatPublicUrl,
                localEndpointUrl: chatApiBaseUrl.includes('localhost') || chatApiBaseUrl.includes('127.0.0.1') ? chatEndpoint : undefined,
                deploymentUrl: runs.get('Chat')?.html_url || buildWorkflowUrl('Chat'),
            };
        }

        const endpoint = buildEndpoint(appId, service!.localPort, modelsBaseDomain, modelsUseHttps);
        const health = modelHealthStatuses.get(appId) || { status: 'checking' as const };
        const workflowName = SERVICE_TO_WORKFLOW.get(appId) || name;
        const isLocal = endpoint.includes('localhost') || endpoint.includes('127.0.0.1');
        const publicEndpointUrl = `${publicScheme}://${appId}.${publicDomain}`;

        return {
            id: appId,
            name: name,
            status: health.status,
            deploymentStatus: getDeploymentStatusForApp(appId),
            localStatus: isLocal ? health.status : undefined,
            latency: health.latency,
            publicEndpoint: `${appId}.${publicDomain}`,
            endpointUrl: publicEndpointUrl,
            localEndpointUrl: isLocal ? endpoint : undefined,
            deploymentUrl: runs.get(workflowName)?.html_url || buildWorkflowUrl(workflowName),
        };
    };

    const chatApp = buildApp(null, 'chat-api', 'Chat API', true);
    const groupedServices = getServicesGroupedByCategory();

    return (
        <div className="space-y-4 pt-2">
            {/* Visual Status Ring */}
            <StatusRing
                online={stats.online}
                down={stats.down}
                checking={stats.checking}
                deploying={stats.deploying}
                total={stats.total}
                loading={loading}
                onRefresh={refresh}
            />

            {/* Core Services (Chat API) */}
            <div className="space-y-2">
                <CategoryHeader
                    id="core"
                    name="Core Services"
                    onlineCount={backendHealth.status === 'ok' ? 1 : 0}
                    totalCount={1}
                    isCollapsed={collapsedCategories.has('core')}
                    onToggle={() => toggleCategory('core')}
                />

                {!collapsedCategories.has('core') && (
                    <AppCard
                        key={chatApp.id}
                        id={chatApp.id}
                        name={chatApp.name}
                        status={chatApp.status}
                        deploymentStatus={chatApp.deploymentStatus}
                        localStatus={chatApp.localStatus}
                        latency={chatApp.latency}
                        publicEndpoint={chatApp.publicEndpoint}
                        endpointUrl={chatApp.endpointUrl}
                        localEndpointUrl={chatApp.localEndpointUrl}
                        deploymentUrl={chatApp.deploymentUrl}
                        defaultExpanded={false}
                    >
                        <div className="flex gap-1 mb-3 bg-slate-900/40 p-1 rounded-lg">
                            <button
                                onClick={() => setActiveTab(chatApp.id, 'build')}
                                className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${activeTabs[chatApp.id] === 'build'
                                    ? 'bg-slate-700/60 text-white'
                                    : 'text-slate-400 hover:text-slate-200'
                                    }`}
                            >
                                Build
                            </button>
                            <button
                                onClick={() => setActiveTab(chatApp.id, 'deploy')}
                                className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${activeTabs[chatApp.id] === 'deploy'
                                    ? 'bg-slate-700/60 text-white'
                                    : 'text-slate-400 hover:text-slate-200'
                                    }`}
                            >
                                Deploy
                            </button>
                            <button
                                onClick={() => setActiveTab(chatApp.id, 'observe')}
                                className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${activeTabs[chatApp.id] === 'observe'
                                    ? 'bg-slate-700/60 text-white'
                                    : 'text-slate-400 hover:text-slate-200'
                                    }`}
                            >
                                Observe
                            </button>
                        </div>

                        {activeTabs[chatApp.id] === 'build' && (
                            <BuildPanel
                                appId={chatApp.id}
                                buildBusy={buildBusy}
                                buildLogTail={buildLogTail}
                                onBuild={runBuild}
                            />
                        )}
                        {activeTabs[chatApp.id] === 'deploy' && (
                            <DeployPanel
                                appId={chatApp.id}
                                githubToken={githubToken}
                                runs={runs}
                                triggering={triggering}
                                loading={loading}
                                onDeploy={triggerWorkflow}
                                onRefresh={refresh}
                            />
                        )}
                        {activeTabs[chatApp.id] === 'observe' && (
                            <ObservePanel
                                appId={chatApp.id}
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
                        )}
                    </AppCard>
                )}
            </div>

            {/* Model Categories */}
            {CATEGORIES.filter(cat => cat.id !== 'core').map(category => {
                const services = groupedServices.get(category.id) || [];
                if (services.length === 0) return null;

                const categoryOnline = services.filter(s => modelHealthStatuses.get(s.key)?.status === 'ok').length;
                const isCollapsed = collapsedCategories.has(category.id);

                return (
                    <div key={category.id} className="space-y-2">
                        <CategoryHeader
                            id={category.id}
                            name={category.name}
                            onlineCount={categoryOnline}
                            totalCount={services.length}
                            isCollapsed={isCollapsed}
                            onToggle={() => toggleCategory(category.id)}
                            showDeployAll={globalTab === 'deploy'}
                            onDeployAll={() => triggerCategoryWorkflows(category.id)}
                            isDeploying={!!triggering}
                        />

                        {!isCollapsed && services.map(service => {
                            const app = buildApp(service, service.key, service.name);
                            const activeTab = activeTabs[app.id] || 'observe';

                            return (
                                <AppCard
                                    key={app.id}
                                    id={app.id}
                                    name={app.name}
                                    status={app.status}
                                    deploymentStatus={app.deploymentStatus}
                                    localStatus={app.localStatus}
                                    latency={app.latency}
                                    publicEndpoint={app.publicEndpoint}
                                    endpointUrl={app.endpointUrl}
                                    localEndpointUrl={app.localEndpointUrl}
                                    deploymentUrl={app.deploymentUrl}
                                    defaultExpanded={false}
                                >
                                    <div className="flex gap-1 mb-3 bg-slate-900/40 p-1 rounded-lg">
                                        <button
                                            onClick={() => setActiveTab(app.id, 'build')}
                                            className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${activeTab === 'build'
                                                ? 'bg-slate-700/60 text-white'
                                                : 'text-slate-400 hover:text-slate-200'
                                                }`}
                                        >
                                            Build
                                        </button>
                                        <button
                                            onClick={() => setActiveTab(app.id, 'deploy')}
                                            className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${activeTab === 'deploy'
                                                ? 'bg-slate-700/60 text-white'
                                                : 'text-slate-400 hover:text-slate-200'
                                                }`}
                                        >
                                            Deploy
                                        </button>
                                        <button
                                            onClick={() => setActiveTab(app.id, 'observe')}
                                            className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${activeTab === 'observe'
                                                ? 'bg-slate-700/60 text-white'
                                                : 'text-slate-400 hover:text-slate-200'
                                                }`}
                                        >
                                            Observe
                                        </button>
                                    </div>

                                    {activeTab === 'build' && (
                                        <BuildPanel
                                            appId={app.id}
                                            buildBusy={buildBusy}
                                            buildLogTail={buildLogTail}
                                            onBuild={runBuild}
                                        />
                                    )}
                                    {activeTab === 'deploy' && (
                                        <DeployPanel
                                            appId={app.id}
                                            githubToken={githubToken}
                                            runs={runs}
                                            triggering={triggering}
                                            loading={loading}
                                            onDeploy={triggerWorkflow}
                                            onRefresh={refresh}
                                        />
                                    )}
                                    {activeTab === 'observe' && (
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
                                    )}
                                </AppCard>
                            );
                        })}
                    </div>
                );
            })}

            {/* Build Error (global) */}
            {buildNativeError && (
                <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                    <span className="text-[10px] text-amber-300">{buildNativeError}</span>
                </div>
            )}

            {/* Deployment Error (global) */}
            {error && (
                <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                    <span className="text-[10px] text-amber-300">{error}</span>
                </div>
            )}

            {/* Keyboard shortcuts hint */}
            <div className="text-center text-[9px] text-slate-600 pt-2">
                Press <kbd className="px-1 py-0.5 bg-slate-800 rounded text-slate-500">R</kbd> to refresh
            </div>
        </div>
    );
};

export default DeploymentsPanel;
