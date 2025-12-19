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
      {/* Header */}
      <header className="sticky top-0 z-10 bg-secondary border-b border-default">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
              <span className="text-xs font-bold text-white">S</span>
            </div>
            <span className="font-semibold text-primary">shipctl</span>
          </div>
          <button
            onClick={() => setShowSettings(true)}
            className="btn-ghost p-1.5 rounded-md"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>

        {/* Project Selector */}
        <div className="px-4 pb-3">
          <button
            onClick={() => setActiveTab('projects')}
            className="w-full flex items-center justify-between px-3 py-2 card card-hover transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className={`status-dot ${activeProject ? 'status-dot-success' : 'status-dot-neutral'}`} />
              <span className="text-sm text-primary truncate">
                {activeProject?.name || 'Select a project'}
              </span>
            </div>
            <svg className="w-4 h-4 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {/* Tab Navigation */}
        {activeTab !== 'projects' && (
          <div className="flex px-4 gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-t-md transition-colors ${
                  activeTab === tab.id
                    ? 'bg-primary text-primary border-t border-l border-r border-default -mb-px'
                    : 'text-secondary hover:text-primary'
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
      <main className="p-4">
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
