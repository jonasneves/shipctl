import { useState, useEffect } from 'react';
import { Settings, Rocket, Activity, Terminal, ChevronDown } from 'lucide-react';
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
    <div className="min-h-screen bg-slate-950 text-slate-100 p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded flex items-center justify-center text-xs font-bold">
            S
          </div>
          <span className="font-semibold text-white">shipctl</span>
        </div>
        <button
          onClick={() => setShowSettings(true)}
          className="p-1.5 hover:bg-slate-800 rounded transition-colors text-slate-400 hover:text-white"
          title="Settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* Project Selector */}
      <div className="mb-4">
        <button
          onClick={() => setActiveTab('projects')}
          className="w-full flex items-center justify-between px-3 py-2 bg-slate-800/50 hover:bg-slate-800 rounded-lg border border-slate-700/50 transition-colors"
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className={`w-2 h-2 rounded-full ${activeProject ? 'bg-green-500' : 'bg-slate-500'}`} />
            <span className="truncate text-sm">
              {activeProject?.name || 'Select a project'}
            </span>
          </div>
          <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
        </button>
      </div>

      {/* Tab Navigation */}
      {activeTab !== 'projects' && (
        <div className="flex border-b border-slate-700 mb-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Tab Content */}
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
    </div>
  );
}

export default App;
