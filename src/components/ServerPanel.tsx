import React, { useState, useEffect } from 'react';
import { ArrowLeft, Globe, Eye, EyeOff, AlertCircle, CheckCircle, ExternalLink } from 'lucide-react';
import { EnvConfig, normalizeEnvConfig, DEFAULT_CONFIG } from '../hooks/useExtensionConfig';
import ControlPanel from './ControlPanel';
import ErrorBoundary from './ErrorBoundary';
import ErrorDisplay from './ErrorDisplay';
import { nativeHost } from '../services/nativeHost';

const ServerPanel: React.FC = () => {
  const [config, setConfig] = useState<EnvConfig>(DEFAULT_CONFIG);
  const [showConfig, setShowConfig] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ message: string; variant: 'error' | 'success' } | null>(null);

  useEffect(() => {
    chrome.storage.local.get(['envConfig'], (result: { envConfig?: EnvConfig }) => {
      const loadedConfig = normalizeEnvConfig(result.envConfig);
      setConfig(loadedConfig);
    });
  }, []);

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

          {/* GitHub Token */}
          <div className="p-4 rounded-xl bg-[#0f1419] border border-[#1e2832]">
            <label htmlFor="github-token" className="flex items-center gap-2 text-xs font-medium text-slate-300 mb-3">
              <Globe className="w-3.5 h-3.5 text-slate-500" />
              GitHub Token
            </label>
            <div className="relative">
              <input
                id="github-token"
                type={showToken ? 'text' : 'password'}
                value={config.githubToken}
                onChange={(e) => setConfig({ ...config, githubToken: e.target.value })}
                className={`${inputClass} pr-10`}
                placeholder="github_pat_..."
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                aria-label={showToken ? 'Hide token' : 'Show token'}
              >
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {!config.githubToken ? (
              <p className="flex items-center gap-1.5 mt-3 text-[11px] text-amber-400/90">
                <AlertCircle className="w-3 h-3" />
                Required for deployments.{' '}
                <a
                  href="https://github.com/settings/tokens/new?description=ShipCTL&scopes=repo,workflow"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-amber-300 inline-flex items-center gap-1"
                >
                  Create token <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </p>
            ) : (
              <p className="flex items-center gap-1.5 mt-3 text-[11px] text-emerald-400/90">
                <CheckCircle className="w-3 h-3" />
                Token configured
              </p>
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
