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

  return (
    <div className="min-h-screen bg-secondary">
      {/* Header */}
      <header className="header">
        <div className="header-brand">
          <img src="/logo.png" alt="shipctl" className="header-logo" style={{ width: '24px', height: '24px', borderRadius: '4px' }} />
          <span className="header-title">shipctl</span>
        </div>
        <div className="header-actions">
          <button onClick={() => setShowSettings(true)} className="btn-header" title="Settings">
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Sub-header with project selector */}
      <div className="subheader">
        <div className="subheader-left">
          <span className={`status-dot ${activeProject ? 'status-dot-success' : 'status-dot-neutral'}`} />
          <button
            onClick={() => setActiveTab('projects')}
            className="subheader-title hover:underline cursor-pointer bg-transparent border-none p-0"
          >
            {activeProject?.name || 'Select project...'}
          </button>
        </div>
        {activeProject && (
          <span className="text-xs text-muted">{activeProject.repo}</span>
        )}
      </div>

      {/* Segmented Control */}
      {activeTab !== 'projects' && (
        <div className="px-4 py-3 bg-primary border-b border-default flex justify-center">
          <div className="segmented-control">
            <button
              onClick={() => setActiveTab('deploy')}
              className={`segment ${activeTab === 'deploy' ? 'active' : ''}`}
            >
              <Rocket className="w-3.5 h-3.5" />
              Deploy
            </button>
            <button
              onClick={() => setActiveTab('services')}
              className={`segment ${activeTab === 'services' ? 'active' : ''}`}
            >
              <Activity className="w-3.5 h-3.5" />
              Services
            </button>
            <button
              onClick={() => setActiveTab('local')}
              className={`segment ${activeTab === 'local' ? 'active' : ''}`}
            >
              <Terminal className="w-3.5 h-3.5" />
              Local
            </button>
          </div>
        </div>
      )}

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
