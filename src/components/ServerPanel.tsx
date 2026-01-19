import { useState, useEffect } from 'react';
import { ArrowLeft, Globe, AlertCircle, CheckCircle, LogOut, Github } from 'lucide-react';
import { EnvConfig, normalizeEnvConfig, DEFAULT_CONFIG } from '../hooks/useExtensionConfig';
import ControlPanel from './ControlPanel';
import ErrorBoundary from './ErrorBoundary';
import ErrorDisplay from './ErrorDisplay';
import { nativeHost } from '../services/nativeHost';

const ServerPanel: React.FC = () => {
  const [config, setConfig] = useState<EnvConfig>(DEFAULT_CONFIG);
  const [showConfig, setShowConfig] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ message: string; variant: 'error' | 'success' } | null>(null);

  useEffect(() => {
    chrome.storage.local.get(['envConfig'], (result: { envConfig?: EnvConfig }) => {
      const loadedConfig = normalizeEnvConfig(result.envConfig);
      setConfig(loadedConfig);
    });
  }, []);

  const handleGitHubConnect = async () => {
    setOauthLoading(true);
    setSaveStatus(null);
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GITHUB_OAUTH' });
      if (response.error) {
        setSaveStatus({ message: response.error, variant: 'error' });
      } else {
        const newConfig = {
          ...config,
          githubToken: response.access_token,
          githubUsername: response.username
        };
        setConfig(newConfig);
        chrome.storage.local.set({ envConfig: newConfig });
        setSaveStatus({ message: `Connected as ${response.username}`, variant: 'success' });
      }
    } catch (err) {
      setSaveStatus({ message: 'OAuth failed. Try again.', variant: 'error' });
    } finally {
      setOauthLoading(false);
    }
  };

  const handleGitHubDisconnect = () => {
    const newConfig = { ...config, githubToken: '', githubUsername: undefined };
    setConfig(newConfig);
    chrome.storage.local.set({ envConfig: newConfig });
    setSaveStatus({ message: 'Disconnected from GitHub', variant: 'success' });
  };

  const saveConfig = async () => {
    setSaveStatus(null);
    chrome.storage.local.set({ envConfig: config });

    try {
      const response = await nativeHost.saveConfig(
        config.pythonPath || '',
        config.repoPath || ''
      );

      if (response?.ok) {
        setSaveStatus({ message: 'Configuration saved successfully.', variant: 'success' });
      } else {
        setSaveStatus({ message: response?.error || 'Failed to save config', variant: 'error' });
      }
    } catch (err) {
      console.error('Failed to save config:', err);
      setSaveStatus({ message: 'Failed to save config file.', variant: 'error' });
    }
  };

  const inputClass = "w-full px-3 py-2.5 bg-[#0a0f14] border border-[#2a3544] rounded-xl text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all";

  if (showConfig) {
    return (
      <div className="h-full bg-[#0a0f14] overflow-y-auto">
        <div className="p-4 space-y-4">
          {/* Header */}
          <div className="flex items-center gap-3 pb-3 border-b border-[#1e2832]">
            <button
              onClick={() => setShowConfig(false)}
              className="p-1.5 -ml-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#1a232e] transition-all"
              aria-label="Go back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h2 className="text-sm font-semibold text-white">Settings</h2>
          </div>

          {/* GitHub Connection */}
          <div className="p-4 rounded-xl bg-[#0f1419] border border-[#1e2832]">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-300 mb-3">
              <Github className="w-3.5 h-3.5 text-slate-500" />
              GitHub Account
            </div>
            {config.githubToken ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm text-slate-200">
                    {config.githubUsername || 'Connected'}
                  </span>
                </div>
                <button
                  onClick={handleGitHubDisconnect}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                >
                  <LogOut className="w-3 h-3" />
                  Disconnect
                </button>
              </div>
            ) : (
              <>
                <button
                  onClick={handleGitHubConnect}
                  disabled={oauthLoading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#238636] hover:bg-[#2ea043] disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-sm font-medium text-white transition-colors"
                >
                  <Github className="w-4 h-4" />
                  {oauthLoading ? 'Connecting...' : 'Connect with GitHub'}
                </button>
                <p className="flex items-center gap-1.5 mt-3 text-[11px] text-amber-400/90">
                  <AlertCircle className="w-3 h-3" />
                  Required for deployments
                </p>
              </>
            )}
          </div>

          {/* GitHub Repository */}
          <div className="p-4 rounded-xl bg-[#0f1419] border border-[#1e2832]">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-300 mb-3">
              <Globe className="w-3.5 h-3.5 text-slate-500" />
              GitHub Repository
            </div>
            <div className="space-y-2">
              <input
                type="text"
                value={config.githubRepoOwner || ''}
                onChange={(e) => setConfig({ ...config, githubRepoOwner: e.target.value })}
                className={inputClass}
                placeholder="Owner (e.g., jonasneves)"
              />
              <input
                type="text"
                value={config.githubRepoName || ''}
                onChange={(e) => setConfig({ ...config, githubRepoName: e.target.value })}
                className={inputClass}
                placeholder="Repository (e.g., my-project)"
              />
            </div>
          </div>

          {/* Repository Path */}
          <div className="p-4 rounded-xl bg-[#0f1419] border border-[#1e2832]">
            <label htmlFor="repo-path" className="flex items-center gap-2 text-xs font-medium text-slate-300 mb-3">
              <Globe className="w-3.5 h-3.5 text-slate-500" />
              Repository Path
            </label>
            <input
              id="repo-path"
              type="text"
              value={config.repoPath || ''}
              onChange={(e) => setConfig({ ...config, repoPath: e.target.value })}
              className={`${inputClass} font-mono text-xs`}
              placeholder="~/Documents/GitHub/my-project"
            />
            <p className="mt-2 text-[11px] text-slate-500">
              Local path to your project. Leave empty to auto-detect.
            </p>
          </div>

          {/* Python Path */}
          <div className="p-4 rounded-xl bg-[#0f1419] border border-[#1e2832]">
            <label htmlFor="python-path" className="flex items-center gap-2 text-xs font-medium text-slate-300 mb-3">
              <Globe className="w-3.5 h-3.5 text-slate-500" />
              Python Path
            </label>
            <input
              id="python-path"
              type="text"
              value={config.pythonPath || ''}
              onChange={(e) => setConfig({ ...config, pythonPath: e.target.value })}
              className={`${inputClass} font-mono text-xs`}
              placeholder="/usr/bin/python3"
            />
            <p className="mt-2 text-[11px] text-slate-500">
              Python interpreter for native host. Leave empty to auto-detect.
            </p>
          </div>

          {/* Chat API URL */}
          <div className="p-4 rounded-xl bg-[#0f1419] border border-[#1e2832]">
            <label htmlFor="chat-api-url" className="flex items-center gap-2 text-xs font-medium text-slate-300 mb-3">
              <Globe className="w-3.5 h-3.5 text-slate-500" />
              Chat API URL
            </label>
            <input
              id="chat-api-url"
              type="text"
              value={config.chatApiBaseUrl}
              onChange={(e) => setConfig({ ...config, profile: 'custom', chatApiBaseUrl: e.target.value })}
              className={inputClass}
              placeholder="http://localhost:8080"
            />
          </div>

          {/* Models Domain */}
          <div className="p-4 rounded-xl bg-[#0f1419] border border-[#1e2832]">
            <label htmlFor="models-domain" className="flex items-center gap-2 text-xs font-medium text-slate-300 mb-3">
              <Globe className="w-3.5 h-3.5 text-slate-500" />
              Models Domain
            </label>
            <div className="flex gap-2">
              <input
                id="models-domain"
                type="text"
                value={config.modelsBaseDomain}
                onChange={(e) => setConfig({ ...config, profile: 'custom', modelsBaseDomain: e.target.value.trim() })}
                className={inputClass}
                placeholder="neevs.io"
              />
              {config.modelsBaseDomain && (
                <label className="flex items-center gap-2 px-3 py-2 bg-[#0a0f14] border border-[#2a3544] rounded-xl text-xs text-slate-400 cursor-pointer hover:border-slate-500 transition-colors">
                  <input
                    type="checkbox"
                    checked={config.modelsUseHttps}
                    onChange={(e) => setConfig({ ...config, profile: 'custom', modelsUseHttps: e.target.checked })}
                    className="w-3.5 h-3.5"
                  />
                  HTTPS
                </label>
              )}
            </div>
          </div>

          {/* Save Button */}
          <button
            onClick={saveConfig}
            className="w-full px-4 py-3 bg-blue-500 hover:bg-blue-600 rounded-xl text-sm font-medium text-white transition-colors"
          >
            Save Configuration
          </button>

          {saveStatus && (
            <ErrorDisplay message={saveStatus.message} variant={saveStatus.variant} />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-[#0a0f14]">
      <ErrorBoundary>
        <ControlPanel
          githubToken={config.githubToken}
          githubRepoOwner={config.githubRepoOwner}
          githubRepoName={config.githubRepoName}
          chatApiBaseUrl={config.chatApiBaseUrl}
          modelsBaseDomain={config.modelsBaseDomain}
          modelsUseHttps={config.modelsUseHttps}
          showOnlyBackend={false}
          onOpenSettings={() => setShowConfig(true)}
        />
      </ErrorBoundary>
    </div>
  );
};

export default ServerPanel;
