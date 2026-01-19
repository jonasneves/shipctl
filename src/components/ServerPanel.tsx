import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, AlertCircle, CheckCircle, LogOut, Github, ChevronDown } from 'lucide-react';
import { EnvConfig, normalizeEnvConfig, DEFAULT_CONFIG } from '../hooks/useExtensionConfig';
import ControlPanel from './ControlPanel';
import ErrorBoundary from './ErrorBoundary';
import ErrorDisplay from './ErrorDisplay';
import { nativeHost } from '../services/nativeHost';

interface GitHubRepo {
  full_name: string;
  owner: { login: string };
  name: string;
}

const ServerPanel: React.FC = () => {
  const [config, setConfig] = useState<EnvConfig>(DEFAULT_CONFIG);
  const [showConfig, setShowConfig] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [oauthStatus, setOauthStatus] = useState<{ message: string; variant: 'error' | 'success' } | null>(null);
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [reposLoading, setReposLoading] = useState(false);
  const [repoSearch, setRepoSearch] = useState('');
  const [repoDropdownOpen, setRepoDropdownOpen] = useState(false);
  const initialLoadDone = useRef(false);

  // Load config on mount
  useEffect(() => {
    chrome.storage.local.get(['envConfig'], async (result: { envConfig?: EnvConfig }) => {
      const loadedConfig = normalizeEnvConfig(result.envConfig);

      // Auto-detect repo owner/name from native host if not already set
      try {
        const detected = await nativeHost.getConfig();
        if (detected.ok) {
          const merged = { ...loadedConfig };
          if (!merged.githubRepoOwner && detected.githubRepoOwner) merged.githubRepoOwner = detected.githubRepoOwner;
          if (!merged.githubRepoName && detected.githubRepoName) merged.githubRepoName = detected.githubRepoName;
          setConfig(merged);
          initialLoadDone.current = true;
          return;
        }
      } catch {
        // Native host not available
      }

      setConfig(loadedConfig);
      initialLoadDone.current = true;
    });
  }, []);

  // Auto-save config when it changes (after initial load)
  useEffect(() => {
    if (initialLoadDone.current) {
      chrome.storage.local.set({ envConfig: config });
    }
  }, [config]);

  const fetchRepos = async (token: string) => {
    if (!token) return;
    setReposLoading(true);
    try {
      const response = await fetch('https://api.github.com/user/repos?affiliation=owner,organization_member&per_page=100&sort=pushed', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      if (response.ok) {
        setRepos(await response.json());
      }
    } catch {
      // Ignore fetch errors
    } finally {
      setReposLoading(false);
    }
  };

  useEffect(() => {
    if (config.githubToken) {
      fetchRepos(config.githubToken);
    }
  }, [config.githubToken]);

  const filteredRepos = repos
    .filter(r => r.full_name.toLowerCase().includes(repoSearch.toLowerCase()))
    .sort((a, b) => a.full_name.localeCompare(b.full_name));

  const handleGitHubConnect = async () => {
    setOauthLoading(true);
    setOauthStatus(null);
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GITHUB_OAUTH' });
      if (response.error) {
        setOauthStatus({ message: response.error, variant: 'error' });
      } else {
        setConfig(prev => ({ ...prev, githubToken: response.access_token, githubUsername: response.username }));
        setOauthStatus({ message: `Connected as ${response.username}`, variant: 'success' });
      }
    } catch {
      setOauthStatus({ message: 'OAuth failed. Try again.', variant: 'error' });
    } finally {
      setOauthLoading(false);
    }
  };

  const handleGitHubDisconnect = () => {
    setConfig(prev => ({ ...prev, githubToken: '', githubUsername: undefined }));
    setRepos([]);
    setOauthStatus({ message: 'Disconnected from GitHub', variant: 'success' });
  };

  const handleRepoSelect = (repo: GitHubRepo) => {
    setConfig(prev => ({ ...prev, githubRepoOwner: repo.owner.login, githubRepoName: repo.name }));
    setRepoDropdownOpen(false);
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
          {config.githubToken && (
            <div className="p-4 rounded-xl bg-[#0f1419] border border-[#1e2832]">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-300 mb-3">
                <Github className="w-3.5 h-3.5 text-slate-500" />
                Repository
              </div>
              {repos.length > 0 ? (
                <div className="relative">
                  <input
                    type="text"
                    value={repoDropdownOpen ? repoSearch : (config.githubRepoOwner && config.githubRepoName ? `${config.githubRepoOwner}/${config.githubRepoName}` : '')}
                    onChange={(e) => setRepoSearch(e.target.value)}
                    onFocus={() => { setRepoDropdownOpen(true); setRepoSearch(''); }}
                    onBlur={() => setTimeout(() => setRepoDropdownOpen(false), 150)}
                    placeholder="Search repositories..."
                    className={`${inputClass} cursor-pointer`}
                  />
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                  {repoDropdownOpen && (
                    <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto bg-[#0f1419] border border-[#2a3544] rounded-xl shadow-lg">
                      {filteredRepos.length > 0 ? filteredRepos.map(repo => (
                        <button
                          key={repo.full_name}
                          type="button"
                          onMouseDown={() => handleRepoSelect(repo)}
                          className="w-full px-3 py-2 text-left text-sm text-slate-200 hover:bg-[#1a232e] transition-colors"
                        >
                          {repo.full_name}
                        </button>
                      )) : (
                        <div className="px-3 py-2 text-sm text-slate-500">No matches</div>
                      )}
                    </div>
                  )}
                </div>
              ) : reposLoading ? (
                <p className="text-xs text-slate-500">Loading repositories...</p>
              ) : (
                <p className="text-xs text-slate-500">No repositories found</p>
              )}
            </div>
          )}

          {oauthStatus && (
            <ErrorDisplay message={oauthStatus.message} variant={oauthStatus.variant} />
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
          onConnectGitHub={handleGitHubConnect}
          connectingGitHub={oauthLoading}
        />
      </ErrorBoundary>
    </div>
  );
};

export default ServerPanel;
