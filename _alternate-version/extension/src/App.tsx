import { useState, useEffect } from 'react';
import { Rocket, Activity, Terminal, Settings } from 'lucide-react';
import ProjectsPanel from './components/ProjectsPanel';
import DeployPanel from './components/DeployPanel';
import ServicesPanel from './components/ServicesPanel';
import LocalPanel from './components/LocalPanel';
import SettingsPanel from './components/SettingsPanel';
import { Project, Settings as SettingsType } from './types';

type Tab = 'projects' | 'deploy' | 'services' | 'local';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('deploy');
  const [showSettings, setShowSettings] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [settings, setSettings] = useState<SettingsType>({
    githubToken: '',
    defaultProfile: 'development',
  });

  useEffect(() => {
    chrome.storage.local.get(['projects', 'settings', 'activeProjectId'], (result) => {
      if (result.projects) {
        setProjects(result.projects);
        const activeId = result.activeProjectId;
        if (activeId) {
          const project = result.projects.find((p: Project) => p.id === activeId);
          if (project) setActiveProject(project);
        }
      }
      if (result.settings) {
        setSettings(result.settings);
      }
    });
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      if (e.key === 'Escape') {
        if (showSettings) {
          setShowSettings(false);
          return;
        }
        if (activeTab === 'projects') {
          setActiveTab('deploy');
          return;
        }
      }

      if ((e.key === 'm' || e.key === 'M') && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setShowSettings(prev => !prev);
        return;
      }

      if ((e.key === 'p' || e.key === 'P') && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setActiveTab('projects');
        return;
      }

      if (activeTab === 'projects') return;

      const tabs: Tab[] = ['deploy', 'services', 'local'];
      const currentIndex = tabs.indexOf(activeTab);

      if (e.key === 'ArrowLeft' && currentIndex > 0) {
        setActiveTab(tabs[currentIndex - 1]);
      } else if (e.key === 'ArrowRight' && currentIndex < tabs.length - 1) {
        setActiveTab(tabs[currentIndex + 1]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, showSettings]);

  const saveSettings = (newSettings: SettingsType) => {
    setSettings(newSettings);
    chrome.storage.local.set({ settings: newSettings });
  };

  const saveProjects = (newProjects: Project[]) => {
    setProjects(newProjects);
    chrome.storage.local.set({ projects: newProjects });
  };

  const selectProject = (project: Project) => {
    setActiveProject(project);
    chrome.storage.local.set({ activeProjectId: project.id });
  };

  const getIndicatorStyle = () => {
    const tabs = ['deploy', 'services', 'local'];
    const index = tabs.indexOf(activeTab);
    if (index === -1) return {};

    const width = `calc(${100 / tabs.length}% - 2px)`;
    const left = `calc(3px + ${100 * index / tabs.length}%)`;

    return { width, left };
  };

  return (
    <div className="min-h-screen bg-secondary">
      {/* Unified Header */}
      <header className="header">
        {/* Project Selector */}
        <div className="project-selector" onClick={() => setActiveTab('projects')}>
          <span className={`status-dot ${activeProject ? 'status-dot-success' : 'status-dot-neutral'}`} />
          <span className="project-name">{activeProject?.name || 'Select project...'}</span>
          <svg className="chevron" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>

        {/* Mode Toggle Track */}
        {activeTab !== 'projects' && (
          <div className="mode-track">
            <div className="mode-indicator" style={getIndicatorStyle()} />
            <button
              onClick={() => setActiveTab('deploy')}
              className={`mode-btn ${activeTab === 'deploy' ? 'active' : ''}`}
            >
              <Rocket className="w-3.5 h-3.5" />
              Deploy
            </button>
            <button
              onClick={() => setActiveTab('services')}
              className={`mode-btn ${activeTab === 'services' ? 'active' : ''}`}
            >
              <Activity className="w-3.5 h-3.5" />
              Services
            </button>
            <button
              onClick={() => setActiveTab('local')}
              className={`mode-btn ${activeTab === 'local' ? 'active' : ''}`}
            >
              <Terminal className="w-3.5 h-3.5" />
              Local
            </button>
          </div>
        )}

        {/* Settings Button */}
        <button onClick={() => setShowSettings(true)} className="settings-btn" title="Settings">
          <Settings className="settings-icon" />
        </button>
      </header>

      {/* Content */}
      <main>
        {activeTab === 'projects' && (
          <ProjectsPanel
            projects={projects}
            activeProject={activeProject}
            onSelect={(project) => {
              selectProject(project);
              setActiveTab('deploy');
            }}
            onAddProject={() => setShowSettings(true)}
          />
        )}
        {activeTab === 'deploy' && (
          <DeployPanel project={activeProject} githubToken={settings.githubToken} />
        )}
        {activeTab === 'services' && (
          <ServicesPanel project={activeProject} />
        )}
        {activeTab === 'local' && (
          <LocalPanel project={activeProject} />
        )}
      </main>

      {/* Settings Modal */}
      {showSettings && (
        <SettingsPanel
          settings={settings}
          projects={projects}
          onSaveSettings={saveSettings}
          onSaveProjects={saveProjects}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

export default App;
