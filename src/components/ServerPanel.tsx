import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, Settings, Globe, Eye, EyeOff, Sparkles, ExternalLink } from 'lucide-react';
import { SERVICES, buildEndpoint, EnvConfig, normalizeEnvConfig } from '../hooks/useExtensionConfig';
import DeploymentsPanel from './DeploymentsPanel';
import ErrorBoundary from './ErrorBoundary';
import { nativeHost } from '../services/nativeHost';

const DEFAULT_CONFIG: EnvConfig = {
  githubToken: '',
  githubRepoOwner: '',
  githubRepoName: '',
  profile: 'local_chat_remote_models',
  chatApiBaseUrl: 'http://localhost:8080',
  modelsBaseDomain: 'neevs.io',
  modelsUseHttps: true,
};

const ServerPanel: React.FC = () => {
  const [config, setConfig] = useState<EnvConfig>(DEFAULT_CONFIG);
  const [showConfig, setShowConfig] = useState(false);
  const [showToken, setShowToken] = useState(false);

  const [, setBackendStatus] = useState<{ process: 'running' | 'stopped' | 'unknown'; mode: string | null }>({ process: 'unknown', mode: null });
  const [, setActiveDeployments] = useState(0);

  useEffect(() => {
    // Load saved config from chrome storage
    chrome.storage.local.get(['envConfig'], (result: { envConfig?: EnvConfig }) => {
      const loadedConfig = normalizeEnvConfig(result.envConfig || DEFAULT_CONFIG);
      setConfig(loadedConfig);
    });
  }, []);

  const saveConfig = async () => {
    chrome.storage.local.set({ envConfig: config });

    try {
      const response = await nativeHost.saveConfig(
        config.pythonPath || '',
        config.repoPath || ''
      );

      if (response?.ok) {
        alert('Configuration saved to .shipctl.env\n\nIf you changed Python path, run:\n./native-host/install-macos.sh');
      } else {
        alert(`Failed to save config: ${response?.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Failed to save config:', err);
      alert('Failed to save config file. Make sure native host is installed.');
    }
  };

  return (
    <div className="min-h-screen font-sans bg-slate-950 text-slate-100 relative overflow-hidden">
      {/* Clean gradient background */}
      <div className="fixed inset-0 pointer-events-none bg-gradient-to-b from-slate-900/50 to-transparent" />



      {showConfig ? (
        <div className="relative z-10 p-4 space-y-4">
          {/* Settings Header */}
          <div className="flex items-center justify-between pb-2 border-b border-slate-700/30">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-400" />
              <h2 className="text-sm font-semibold text-white">Configuration</h2>
            </div>
            <button
              onClick={() => setShowConfig(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50"
              title="Close Settings"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 18 18" /></svg>
            </button>
          </div>

          {/* GitHub Token */}
          <div className="p-3 rounded-xl bg-slate-800/40 backdrop-blur-sm border border-slate-700/30">
            <label className="flex items-center gap-2 text-xs font-medium text-slate-200 mb-2">
              <Globe className="w-3.5 h-3.5 text-purple-400" />
              GitHub Token
            </label>
            <div className="relative">
              <input
                type={showToken ? 'text' : 'password'}
                value={config.githubToken}
                onChange={(e) => setConfig({ ...config, githubToken: e.target.value })}
                className="w-full px-3 py-2 pr-10 bg-slate-900/60 border border-slate-600/40 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/20 transition-all"
                placeholder="github_pat_..."
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
              >
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {!config.githubToken && (
              <p className="flex items-center gap-1.5 mt-2 text-[11px] text-amber-400/90">
                <AlertCircle className="w-3 h-3" />
                Required for deployments.{' '}
                <a
                  href="https://github.com/settings/tokens/new?description=ShipCTL+Extension&scopes=repo,workflow&default_expires_at=none"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-amber-300 inline-flex items-center gap-1"
                >
                  Create token <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </p>
            )}
            {config.githubToken && (
              <p className="flex items-center gap-1.5 mt-2 text-[11px] text-emerald-400/90">
                <CheckCircle className="w-3 h-3" />
                Token configured
              </p>
            )}
          </div>

          {/* GitHub Repository */}
          <div className="p-3 rounded-xl bg-slate-800/40 backdrop-blur-sm border border-slate-700/30">
            <label className="flex items-center gap-2 text-xs font-medium text-slate-200 mb-2">
              <Globe className="w-3.5 h-3.5 text-purple-400" />
              GitHub Repository
            </label>
            <div className="space-y-2">
              <input
                type="text"
                value={config.githubRepoOwner || ''}
                onChange={(e) => setConfig({ ...config, githubRepoOwner: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900/60 border border-slate-600/40 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/20 transition-all"
                placeholder="Repository owner (e.g., jonasneves)"
              />
              <input
                type="text"
                value={config.githubRepoName || ''}
                onChange={(e) => setConfig({ ...config, githubRepoName: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900/60 border border-slate-600/40 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/20 transition-all"
                placeholder="Repository name (e.g., my-project)"
              />
            </div>
            <p className="mt-2 text-[11px] text-slate-400">
              GitHub repository for workflow deployments
            </p>
          </div>

          {/* Repository Path */}
          <div className="p-3 rounded-xl bg-slate-800/40 backdrop-blur-sm border border-slate-700/30">
            <label className="flex items-center gap-2 text-xs font-medium text-slate-200 mb-2">
              <Globe className="w-3.5 h-3.5 text-blue-400" />
              Repository Path
            </label>
            <input
              type="text"
              value={config.repoPath || ''}
              onChange={(e) => setConfig({ ...config, repoPath: e.target.value })}
              className="w-full px-3 py-2 bg-slate-900/60 border border-slate-600/40 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/20 transition-all font-mono"
              placeholder="~/Documents/GitHub/my-project"
            />
            <p className="mt-2 text-[11px] text-slate-400">
              Path to your project repository. Leave empty to auto-detect.
            </p>
          </div>

          {/* Python Path */}
          <div className="p-3 rounded-xl bg-slate-800/40 backdrop-blur-sm border border-slate-700/30">
            <label className="flex items-center gap-2 text-xs font-medium text-slate-200 mb-2">
              <Globe className="w-3.5 h-3.5 text-emerald-400" />
              Python Path
            </label>
            <input
              type="text"
              value={config.pythonPath || ''}
              onChange={(e) => setConfig({ ...config, pythonPath: e.target.value })}
              className="w-full px-3 py-2 bg-slate-900/60 border border-slate-600/40 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/20 transition-all font-mono"
              placeholder="/path/to/python"
            />
            <p className="mt-2 text-[11px] text-slate-400">
              Python interpreter for native host. Leave empty to auto-detect.
            </p>
          </div>

          {/* Advanced Settings */}
          <details className="group">
            <summary className="flex items-center gap-2 text-xs font-medium text-slate-400 cursor-pointer hover:text-slate-200 transition-colors">
              <span className="group-open:rotate-90 transition-transform duration-200">▶</span>
              Advanced Settings
            </summary>
            <div className="mt-3 p-3 space-y-3 rounded-xl bg-slate-800/30 border border-slate-700/20">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1.5">Chat API URL</label>
                <input
                  type="text"
                  value={config.chatApiBaseUrl}
                  onChange={(e) => setConfig({ ...config, profile: 'custom', chatApiBaseUrl: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900/60 border border-slate-600/40 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  placeholder="http://localhost:8080"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1.5">Models Domain</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={config.modelsBaseDomain}
                    onChange={(e) => setConfig({ ...config, profile: 'custom', modelsBaseDomain: e.target.value.trim() })}
                    className="flex-1 px-3 py-2 bg-slate-900/60 border border-slate-600/40 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/20 transition-all"
                    placeholder="neevs.io (or empty for localhost)"
                  />
                  {config.modelsBaseDomain && (
                    <label className="flex items-center gap-1.5 px-3 py-2 bg-slate-900/60 border border-slate-600/40 rounded-lg text-[11px] text-slate-300 cursor-pointer hover:border-slate-500/60 transition-colors">
                      <input
                        type="checkbox"
                        checked={config.modelsUseHttps}
                        onChange={(e) => setConfig({ ...config, profile: 'custom', modelsUseHttps: e.target.checked })}
                        className="w-3.5 h-3.5 rounded bg-slate-800 border-slate-600 accent-blue-500"
                      />
                      HTTPS
                    </label>
                  )}
                </div>
              </div>
            </div>
          </details>

          {/* Save Button */}
          <button
            onClick={saveConfig}
            className="w-full px-4 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 rounded-xl text-sm font-medium text-white shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-all active:scale-[0.98]"
          >
            Save Configuration
          </button>
        </div>
      ) : (
        <div className="relative z-10 overflow-y-auto px-4 pb-4 h-screen">
          <ErrorBoundary>
            <DeploymentsPanel
              githubToken={config.githubToken}
              githubRepoOwner={config.githubRepoOwner}
              githubRepoName={config.githubRepoName}
              chatApiBaseUrl={config.chatApiBaseUrl}
              modelsBaseDomain={config.modelsBaseDomain}
              modelsUseHttps={config.modelsUseHttps}

              showOnlyBackend={false}
              onBackendStatusChange={setBackendStatus}
              onActiveDeploymentsChange={setActiveDeployments}
              onOpenSettings={() => setShowConfig(true)}
            />
          </ErrorBoundary>
        </div>
      )}
    </div>
  );
};

export default ServerPanel;
