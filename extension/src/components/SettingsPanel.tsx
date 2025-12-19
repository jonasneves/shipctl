import { useState } from 'react';
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Save,
  ExternalLink,
} from 'lucide-react';
import { Project, Settings } from '../types';

interface SettingsPanelProps {
  settings: Settings;
  projects: Project[];
  onSaveSettings: (settings: Settings) => void;
  onSaveProjects: (projects: Project[]) => void;
  onBack: () => void;
}

export default function SettingsPanel({
  settings,
  projects,
  onSaveSettings,
  onSaveProjects,
  onBack,
}: SettingsPanelProps) {
  const [localSettings, setLocalSettings] = useState(settings);
  const [localProjects, setLocalProjects] = useState(projects);
  const [showToken, setShowToken] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  const handleSave = () => {
    onSaveSettings(localSettings);
    onSaveProjects(localProjects);
    onBack();
  };

  const addProject = () => {
    const newProject: Project = {
      id: crypto.randomUUID(),
      name: '',
      repo: '',
      workflows: [],
    };
    setEditingProject(newProject);
  };

  const saveProject = (project: Project) => {
    const exists = localProjects.find((p) => p.id === project.id);
    if (exists) {
      setLocalProjects(localProjects.map((p) => (p.id === project.id ? project : p)));
    } else {
      setLocalProjects([...localProjects, project]);
    }
    setEditingProject(null);
  };

  const deleteProject = (id: string) => {
    setLocalProjects(localProjects.filter((p) => p.id !== id));
  };

  if (editingProject) {
    return (
      <ProjectEditor
        project={editingProject}
        onSave={saveProject}
        onCancel={() => setEditingProject(null)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-3">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={onBack}
          className="p-1.5 hover:bg-slate-800 rounded transition-colors text-slate-400 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="font-semibold text-white">Settings</h1>
      </div>

      <div className="space-y-6">
        {/* GitHub Token */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            GitHub Token
          </label>
          <div className="relative">
            <input
              type={showToken ? 'text' : 'password'}
              value={localSettings.githubToken}
              onChange={(e) =>
                setLocalSettings({ ...localSettings, githubToken: e.target.value })
              }
              className="w-full px-3 py-2 pr-10 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              placeholder="ghp_xxxxxxxxxxxx"
            />
            <button
              type="button"
              onClick={() => setShowToken(!showToken)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-200"
            >
              {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="mt-1.5 text-xs text-slate-500">
            Needs <code className="text-slate-400">repo</code> and{' '}
            <code className="text-slate-400">workflow</code> scopes.{' '}
            <a
              href="https://github.com/settings/tokens/new?scopes=repo,workflow&description=shipctl"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 inline-flex items-center gap-0.5"
            >
              Create token <ExternalLink className="w-3 h-3" />
            </a>
          </p>
        </div>

        {/* Projects */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-slate-300">Projects</label>
            <button
              onClick={addProject}
              className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
              Add Project
            </button>
          </div>

          {localProjects.length === 0 ? (
            <div className="p-4 text-center text-sm text-slate-500 bg-slate-800/50 rounded-lg border border-slate-700/50">
              No projects configured
            </div>
          ) : (
            <div className="space-y-2">
              {localProjects.map((project) => (
                <div
                  key={project.id}
                  className="flex items-center justify-between px-3 py-2.5 bg-slate-800/50 rounded-lg border border-slate-700/50"
                >
                  <button
                    onClick={() => setEditingProject(project)}
                    className="text-left min-w-0 flex-1"
                  >
                    <div className="text-sm font-medium text-slate-200 truncate">
                      {project.name || 'Untitled'}
                    </div>
                    <div className="text-xs text-slate-500 truncate">
                      {project.repo || 'No repo'}
                    </div>
                  </button>
                  <button
                    onClick={() => deleteProject(project.id)}
                    className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
        >
          <Save className="w-4 h-4" />
          Save Changes
        </button>
      </div>
    </div>
  );
}

// Project Editor Component
function ProjectEditor({
  project,
  onSave,
  onCancel,
}: {
  project: Project;
  onSave: (project: Project) => void;
  onCancel: () => void;
}) {
  const [local, setLocal] = useState(project);
  const [workflowInput, setWorkflowInput] = useState('');

  const addWorkflow = () => {
    if (workflowInput.trim()) {
      const workflow = workflowInput.trim().endsWith('.yml')
        ? workflowInput.trim()
        : `${workflowInput.trim()}.yml`;
      if (!local.workflows.includes(workflow)) {
        setLocal({ ...local, workflows: [...local.workflows, workflow] });
      }
      setWorkflowInput('');
    }
  };

  const removeWorkflow = (workflow: string) => {
    setLocal({ ...local, workflows: local.workflows.filter((w) => w !== workflow) });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-3">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={onCancel}
          className="p-1.5 hover:bg-slate-800 rounded transition-colors text-slate-400 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="font-semibold text-white">
          {project.name ? 'Edit Project' : 'New Project'}
        </h1>
      </div>

      <div className="space-y-4">
        {/* Name */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">
            Project Name
          </label>
          <input
            type="text"
            value={local.name}
            onChange={(e) => setLocal({ ...local, name: e.target.value })}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            placeholder="My API"
          />
        </div>

        {/* Repo */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">
            GitHub Repository
          </label>
          <input
            type="text"
            value={local.repo}
            onChange={(e) => setLocal({ ...local, repo: e.target.value })}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            placeholder="username/repo"
          />
        </div>

        {/* Workflows */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">
            Workflows
          </label>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={workflowInput}
              onChange={(e) => setWorkflowInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addWorkflow()}
              className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              placeholder="deploy.yml"
            />
            <button
              onClick={addWorkflow}
              className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition-colors"
            >
              Add
            </button>
          </div>
          {local.workflows.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {local.workflows.map((w) => (
                <span
                  key={w}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-slate-800 rounded text-xs text-slate-300"
                >
                  {w}
                  <button
                    onClick={() => removeWorkflow(w)}
                    className="text-slate-500 hover:text-red-400"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Local Command */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">
            Local Dev Command
          </label>
          <input
            type="text"
            value={local.localCommand || ''}
            onChange={(e) => setLocal({ ...local, localCommand: e.target.value })}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
            placeholder="npm run dev"
          />
        </div>

        {/* Local Port */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">
            Local Port
          </label>
          <input
            type="number"
            value={local.localPort || ''}
            onChange={(e) =>
              setLocal({ ...local, localPort: parseInt(e.target.value) || undefined })
            }
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            placeholder="3000"
          />
        </div>

        {/* Health Endpoint */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">
            Health Check Path
          </label>
          <input
            type="text"
            value={local.healthEndpoint || ''}
            onChange={(e) => setLocal({ ...local, healthEndpoint: e.target.value })}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            placeholder="/health"
          />
        </div>

        {/* Production URL */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">
            Production URL
          </label>
          <input
            type="text"
            value={local.environments?.production || ''}
            onChange={(e) =>
              setLocal({
                ...local,
                environments: { ...local.environments, production: e.target.value },
              })
            }
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            placeholder="https://api.example.com"
          />
        </div>

        {/* Save Button */}
        <button
          onClick={() => onSave(local)}
          disabled={!local.name || !local.repo}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:text-slate-500 rounded-lg font-medium transition-colors"
        >
          <Save className="w-4 h-4" />
          Save Project
        </button>
      </div>
    </div>
  );
}
