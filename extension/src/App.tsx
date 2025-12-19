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
    <div className="min-h-screen bg-secondary">
      {/* Header */}
      <header className="sticky top-0 z-10">
        <div className="flex items-center justify-between px-4 py-3 header-gradient">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center backdrop-blur">
              <span className="text-sm font-bold text-white">S</span>
            </div>
            <div className="flex flex-col">
              <span className="font-semibold text-white text-sm">shipctl</span>
              <span className="text-[10px] text-white/70">Deploy from your browser</span>
            </div>
          </div>
          <button
            onClick={() => setShowSettings(true)}
            className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-white/20 transition-colors text-white"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>

        {/* Project Selector */}
        <div className="px-4 py-3 bg-primary border-b border-default">
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
          <div className="flex px-4 bg-primary border-b border-default">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  activeTab === tab.id
                    ? 'border-[#1e3a5f] text-[#1e3a5f]'
                    : 'border-transparent text-secondary hover:text-primary'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* Content */}
      <main className="p-4 bg-secondary min-h-screen">
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
