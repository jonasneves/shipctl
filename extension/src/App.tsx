import { useState, useEffect } from 'react';
import { Settings, Rocket, Activity, Terminal } from 'lucide-react';
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

  // Load from storage on mount
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

  // Save settings
  const saveSettings = (newSettings: SettingsType) => {
    setSettings(newSettings);
    chrome.storage.local.set({ settings: newSettings });
  };

  // Save projects
  const saveProjects = (newProjects: Project[]) => {
    setProjects(newProjects);
    chrome.storage.local.set({ projects: newProjects });
  };

  // Set active project
  const selectProject = (project: Project) => {
    setActiveProject(project);
    chrome.storage.local.set({ activeProjectId: project.id });
  };

  const tabs: { id: Tab; label: string; icon: typeof Rocket }[] = [
    { id: 'deploy', label: 'Deploy', icon: Rocket },
    { id: 'services', label: 'Services', icon: Activity },
    { id: 'local', label: 'Local', icon: Terminal },
  ];

  if (showSettings) {
    return (
      <SettingsPanel
        settings={settings}
        projects={projects}
        onSaveSettings={saveSettings}
        onSaveProjects={saveProjects}
        onBack={() => setShowSettings(false)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-primary">
      {/* Header - Solid Navy */}
      <header className="header">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="header-icon">
              <span className="text-sm font-bold text-white">S</span>
            </div>
            <div className="flex flex-col">
              <span className="header-title text-base">shipctl</span>
              <span className="header-subtitle">Deploy from your browser</span>
            </div>
          </div>
          <button
            onClick={() => setShowSettings(true)}
            className="btn-icon"
            title="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Project Selector */}
      <div className="px-4 py-3 bg-secondary border-b border-default">
        <button
          onClick={() => setActiveTab('projects')}
          className="w-full flex items-center justify-between px-3 py-2.5 card card-hover transition-all"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className={`status-dot ${activeProject ? 'status-dot-success' : 'status-dot-neutral'}`} />
            <span className="text-sm text-primary truncate font-medium">
              {activeProject?.name || 'Select a project'}
            </span>
          </div>
          <svg className="w-4 h-4 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Tab Navigation */}
      {activeTab !== 'projects' && (
        <div className="tab-nav">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <main className="p-5 bg-primary">
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
          <DeployPanel
            project={activeProject}
            githubToken={settings.githubToken}
          />
        )}
        {activeTab === 'services' && (
          <ServicesPanel project={activeProject} />
        )}
        {activeTab === 'local' && (
          <LocalPanel project={activeProject} />
        )}
      </main>
    </div>
  );
}

export default App;
