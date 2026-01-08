import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import AppCard from './AppCard';
import CollapsibleSection from './CollapsibleSection';
import WorkflowCard from './WorkflowCard';
import BuildPanel from './BuildPanel';
import ObservePanel from './ObservePanel';
import StatusRing from './StatusRing';
import { Package, Workflow, Search, Rocket } from 'lucide-react';
import DeployPanel from './DeployPanel';
import {
    SERVICES,
    WORKFLOWS,
    WORKFLOW_PATHS,
    SERVICE_TO_WORKFLOW,
    ServiceConfig,
    buildEndpoint,
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
    showOnlyBackend?: boolean;
    onBackendStatusChange?: (status: { process: 'running' | 'stopped' | 'unknown'; mode: string | null }) => void;
    onActiveDeploymentsChange?: (count: number) => void;
    onOpenSettings?: () => void;
}

const KEY_WORKFLOWS = WORKFLOWS;

const DeploymentsPanel: React.FC<DeploymentsPanelProps> = ({ githubToken, githubRepoOwner, githubRepoName, chatApiBaseUrl, modelsBaseDomain, modelsUseHttps, showOnlyBackend = false, onBackendStatusChange, onActiveDeploymentsChange, onOpenSettings }) => {
    const [workflows, setWorkflows] = useState<Map<string, WorkflowInfo>>(new Map());
    const [runs, setRuns] = useState<Map<string, WorkflowRun | null>>(new Map());
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
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
    const [modelHealthHistory, setModelHealthHistory] = useState<Map<string, number[]>>(new Map());
    const [backendHealthHistory, setBackendHealthHistory] = useState<number[]>([]);
    const [uptimeStats, setUptimeStats] = useState<Map<string, { successful: number; total: number }>>(new Map());

    const refreshInFlight = useRef(false);

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

        // Update backend history
        setBackendHealthHistory(prev => {
            const latency = status.latency || 0;
            return [...prev, latency].slice(-10);
        });
    }, [chatApiBaseUrl]);

    const checkAllModelsHealth = useCallback(async () => {
        // Set all to checking in one batch
        setModelHealthStatuses(prev => {
            const next = new Map(prev);
            for (const service of SERVICES) {
                next.set(service.key, { status: 'checking' });
            }
            return next;
        });

        const checks = SERVICES.map(async (service) => {
            const endpoint = buildEndpoint(service.key, service.localPort, modelsBaseDomain, modelsUseHttps);
            const status = await healthChecker.check(endpoint, 3000);
            return { key: service.key, status };
        });

        const results = await Promise.all(checks);

        // Batch update all results at once
        setModelHealthStatuses(prev => {
            const next = new Map(prev);
            for (const res of results) {
                next.set(res.key, res.status);
            }
            return next;
        });

        // Update history tracking
        setModelHealthHistory(prev => {
            const next = new Map(prev);
            for (const res of results) {
                const existing = prev.get(res.key) || [];
                const latency = res.status.latency || 0;
                const newHistory = [...existing, latency].slice(-10);
                next.set(res.key, newHistory);
            }
            return next;
        });

        // Update uptime stats
        setUptimeStats(prev => {
            const next = new Map(prev);
            for (const res of results) {
                const existing = prev.get(res.key) || { successful: 0, total: 0 };
                const successful = existing.successful + (res.status.status === 'ok' ? 1 : 0);
                const total = existing.total + 1;
                next.set(res.key, { successful, total });
            }
            return next;
        });
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

            // Map all KEY_WORKFLOWS to their corresponding GitHub workflow
            // Handle case where multiple models share the same workflow file (inference.yml)
            for (const keyWf of KEY_WORKFLOWS) {
                const matchingGhWf = workflows.find(wf =>
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
                // For inference workflows, filter by model name
                const workflowConfig = KEY_WORKFLOWS.find(w => w.name === name);
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

            // For inference workflows, pass the model as input
            const workflowConfig = KEY_WORKFLOWS.find(w => w.name === workflowName);
            const inputs = workflowConfig?.serviceKey
                ? { model: workflowConfig.serviceKey }
                : undefined;

            const success = await github.triggerWorkflow(workflowIdentifier!, inputs);

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

    const triggerAllWorkflows = async () => {
        const allServiceWorkflows = KEY_WORKFLOWS.filter(wf => wf.serviceKey);
        for (const wf of allServiceWorkflows) {
            await triggerWorkflow(wf.name);
        }
        // Also trigger Chat workflow
        await triggerWorkflow('Chat');
    };

    // Initial load and config changes
    useEffect(() => {
        checkBackendHealth();
        refreshBackendStatus();
        checkAllModelsHealth();

        if (!showOnlyBackend) {
            fetchWorkflows();
        }
    }, [checkBackendHealth, refreshBackendStatus, checkAllModelsHealth, fetchWorkflows, showOnlyBackend]);

    // Fetch runs when workflows are loaded
    useEffect(() => {
        if (workflows.size > 0 && !showOnlyBackend) {
            fetchLatestRuns();
        }
    }, [workflows, fetchLatestRuns, showOnlyBackend]);

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
                category: 'core' as const,
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
            category: service!.category,
        };
    };

    const chatApp = buildApp(null, 'chat-api', 'Chat API', true);


    // Flatten all services
    const allApps = [
        chatApp,
        ...SERVICES.map(service => buildApp(service, service.key, service.name))
    ];

    const filteredAndSortedApps = useMemo(() => {
        let apps = [...allApps];

        // Filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            apps = apps.filter(app => app.name.toLowerCase().includes(query) || app.id.toLowerCase().includes(query));
        }

        // Sort
        apps.sort((a, b) => {
            // Helper to get score (Higher is better/top)
            const getScore = (app: typeof a) => {
                const isDeploying = app.deploymentStatus === 'in_progress' || app.deploymentStatus === 'queued';
                if (app.status === 'running' || app.status === 'ok' || isDeploying) return 3;
                if (app.status === 'checking') return 2;
                return 1; // down/stopped/unknown
            };

            const scoreA = getScore(a);
            const scoreB = getScore(b);

            if (scoreA !== scoreB) return scoreB - scoreA; // Descending score

            // Tie-breaker: Name
            return a.name.localeCompare(b.name);
        });

        return apps;
    }, [allApps, searchQuery]);

    // Separate standalone workflows (no serviceKey)
    const standaloneWorkflows = useMemo(() => {
        return KEY_WORKFLOWS
            .filter(wf => !wf.serviceKey)
            .map(wf => {
                const workflowInfo = workflows.get(wf.name);
                const run = runs.get(wf.name);
                return {
                    name: wf.name,
                    workflowInfo,
                    run,
                };
            });
    }, [workflows, runs]);

    // Count stats for section headers
    const serviceStats = useMemo(() => {
        const online = filteredAndSortedApps.filter(app =>
            app.status === 'running' || app.status === 'ok'
        ).length;
        const down = filteredAndSortedApps.filter(app =>
            app.status === 'stopped' || app.status === 'down'
        ).length;
        return { online, down, total: filteredAndSortedApps.length };
    }, [filteredAndSortedApps]);

    const workflowStats = useMemo(() => {
        const active = standaloneWorkflows.filter(wf =>
            wf.run?.status === 'in_progress' || wf.run?.status === 'queued'
        ).length;
        const recent = standaloneWorkflows.filter(wf => wf.run).length;
        return { active, recent, total: standaloneWorkflows.length };
    }, [standaloneWorkflows]);

    return (
        <div className="space-y-2 pt-2">
            {/* Status Ring */}
            <StatusRing
                online={stats.online}
                down={stats.down}
                checking={stats.checking}
                deploying={stats.deploying}
                total={stats.total}
                loading={loading}
                onRefresh={refresh}
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
                    className={`
                        flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                        transition-colors
                        ${triggering
                            ? 'bg-blue-500/20 text-blue-400 cursor-wait'
                            : 'bg-blue-500 hover:bg-blue-600 text-white'
                        }
                        disabled:opacity-50 disabled:cursor-not-allowed
                    `}
                    title="Deploy all services"
                >
                    <Rocket className="w-3.5 h-3.5" />
                    <span>{triggering ? 'Deploying...' : 'Deploy All'}</span>
                </button>
                <a
                    href={`https://github.com/${githubRepoOwner}/${githubRepoName}/actions`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-slate-300 hover:text-white bg-slate-800/30 hover:bg-slate-800/50 border border-slate-700/30 transition-colors ${(!githubRepoOwner || !githubRepoName) ? 'opacity-50 pointer-events-none' : ''}`}
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

            {/* Services Section */}
            <CollapsibleSection
                title="Services"
                subtitle={`${serviceStats.online} running${serviceStats.down > 0 ? `, ${serviceStats.down} down` : ''}`}
                defaultExpanded={true}
            >
                {filteredAndSortedApps.map(app => {
                    // Find workflow and run info for this app
                    const serviceConfig = SERVICES.find(s => s.key === app.id);
                    const wfName = serviceConfig
                        ? (KEY_WORKFLOWS.find(k => k.serviceKey === app.id)?.name)
                        : 'Chat';
                    const wf = workflows.get(wfName || '');
                    const run = runs.get(wfName || '');

                    const uptimeData = uptimeStats.get(app.id);
                    const uptimePercent = uptimeData ? (uptimeData.successful / uptimeData.total) * 100 : undefined;

                    const handleDeploy = () => {
                        if (wfName) {
                            triggerWorkflow(wfName);
                        }
                    };

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
                            latencyHistory={app.id === 'chat-api' ? backendHealthHistory : modelHealthHistory.get(app.id) || []}
                            errorCount={0}
                            uptimePercent={uptimePercent}
                            lastDeployAt={runs.get(wfName || '')?.updated_at}
                            onDeploy={wfName ? handleDeploy : undefined}
                            deployTriggering={triggering === wfName}
                            deployButton={
                                <DeployPanel
                                    appId={app.id}
                                    githubToken={githubToken}
                                    runs={runs}
                                    triggering={triggering}
                                    loading={loading}
                                    onDeploy={triggerWorkflow}
                                    onRefresh={refresh}
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
            </CollapsibleSection>

            {/* Workflows Section */}
            {standaloneWorkflows.length > 0 && (
                <CollapsibleSection
                    title="Workflows"
                    subtitle={
                        workflowStats.active > 0
                            ? `${workflowStats.active} active, ${workflowStats.recent} recent`
                            : `${workflowStats.recent} recent`
                    }
                    defaultExpanded={workflowStats.active > 0}
                >
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
                </CollapsibleSection>
            )}

            {/* Build Error (global) */}
            {
                buildNativeError && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                        <span className="text-[10px] text-amber-300">{buildNativeError}</span>
                    </div>
                )
            }

            {/* Deployment Error (global) */}
            {
                error && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                        <span className="text-[10px] text-amber-300">{error}</span>
                    </div>
                )
            }
        </div >
    );
};

export default DeploymentsPanel;
