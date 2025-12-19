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
    <div className="min-h-screen bg-primary">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-secondary border-b border-default">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={onBack} className="btn-ghost p-1.5 rounded-md">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="font-semibold text-primary">Settings</h1>
        </div>
      </header>

      <main className="p-4 space-y-6">
        {/* GitHub Token */}
        <section>
          <label className="block text-sm font-medium text-primary mb-2">
            GitHub Token
          </label>
          <div className="relative">
            <input
              type={showToken ? 'text' : 'password'}
              value={localSettings.githubToken}
              onChange={(e) =>
                setLocalSettings({ ...localSettings, githubToken: e.target.value })
              }
              className="input pr-10"
              placeholder="ghp_xxxxxxxxxxxx"
            />
            <button
              type="button"
              onClick={() => setShowToken(!showToken)}
              className="absolute right-2 top-1/2 -translate-y-1/2 btn-ghost p-1"
            >
              {showToken ? (
                <EyeOff className="w-4 h-4 text-secondary" />
              ) : (
                <Eye className="w-4 h-4 text-secondary" />
              )}
            </button>
          </div>
          <p className="mt-2 text-xs text-muted">
            Needs <code className="text-secondary">repo</code> and{' '}
            <code className="text-secondary">workflow</code> scopes.{' '}
            <a
              href="https://github.com/settings/tokens/new?scopes=repo,workflow&description=shipctl"
              target="_blank"
              rel="noopener noreferrer"
              className="text-info hover:underline inline-flex items-center gap-0.5"
            >
              Create token <ExternalLink className="w-3 h-3" />
            </a>
          </p>
        </section>

        {/* Projects */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-primary">Projects</label>
            <button onClick={addProject} className="btn-ghost text-xs text-info flex items-center gap-1 px-2 py-1">
              <Plus className="w-3 h-3" />
              Add Project
            </button>
          </div>

          {localProjects.length === 0 ? (
            <div className="card p-6 text-center">
              <p className="text-sm text-secondary">No projects configured</p>
            </div>
          ) : (
            <div className="space-y-2">
              {localProjects.map((project) => (
                <div key={project.id} className="card p-3 flex items-center justify-between">
                  <button
                    onClick={() => setEditingProject(project)}
                    className="text-left min-w-0 flex-1"
                  >
                    <div className="text-sm font-medium text-primary truncate">
                      {project.name || 'Untitled'}
                    </div>
                    <div className="text-xs text-muted truncate">
                      {project.repo || 'No repo'}
                    </div>
                  </button>
                  <button
                    onClick={() => deleteProject(project.id)}
                    className="btn-ghost p-1.5 text-secondary hover:text-danger"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Save Button */}
        <button onClick={handleSave} className="btn btn-primary w-full">
          <Save className="w-4 h-4" />
          Save Changes
        </button>
      </main>
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
    <div className="min-h-screen bg-primary">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-secondary border-b border-default">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={onCancel} className="btn-ghost p-1.5 rounded-md">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="font-semibold text-primary">
            {project.name ? 'Edit Project' : 'New Project'}
          </h1>
        </div>
      </header>

      <main className="p-4 space-y-4">
        {/* Name */}
        <div>
          <label className="block text-xs font-medium text-secondary mb-1.5">
            Project Name
          </label>
          <input
            type="text"
            value={local.name}
            onChange={(e) => setLocal({ ...local, name: e.target.value })}
            className="input"
            placeholder="My API"
          />
        </div>

        {/* Repo */}
        <div>
          <label className="block text-xs font-medium text-secondary mb-1.5">
            GitHub Repository
          </label>
          <input
            type="text"
            value={local.repo}
            onChange={(e) => setLocal({ ...local, repo: e.target.value })}
            className="input"
            placeholder="username/repo"
          />
        </div>

        {/* Workflows */}
        <div>
          <label className="block text-xs font-medium text-secondary mb-1.5">
            Workflows
          </label>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={workflowInput}
              onChange={(e) => setWorkflowInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addWorkflow()}
              className="input flex-1"
              placeholder="deploy.yml"
            />
            <button onClick={addWorkflow} className="btn btn-secondary">
              Add
            </button>
          </div>
          {local.workflows.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {local.workflows.map((w) => (
                <span key={w} className="badge badge-neutral">
                  {w}
                  <button
                    onClick={() => removeWorkflow(w)}
                    className="ml-1 text-muted hover:text-danger"
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
          <label className="block text-xs font-medium text-secondary mb-1.5">
            Local Dev Command
          </label>
          <input
            type="text"
            value={local.localCommand || ''}
            onChange={(e) => setLocal({ ...local, localCommand: e.target.value })}
            className="input font-mono"
            placeholder="npm run dev"
          />
        </div>

        {/* Local Port */}
        <div>
          <label className="block text-xs font-medium text-secondary mb-1.5">
            Local Port
          </label>
          <input
            type="number"
            value={local.localPort || ''}
            onChange={(e) =>
              setLocal({ ...local, localPort: parseInt(e.target.value) || undefined })
            }
            className="input"
            placeholder="3000"
          />
        </div>

        {/* Health Endpoint */}
        <div>
          <label className="block text-xs font-medium text-secondary mb-1.5">
            Health Check Path
          </label>
          <input
            type="text"
            value={local.healthEndpoint || ''}
            onChange={(e) => setLocal({ ...local, healthEndpoint: e.target.value })}
            className="input"
            placeholder="/health"
          />
        </div>

        {/* Production URL */}
        <div>
          <label className="block text-xs font-medium text-secondary mb-1.5">
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
            className="input"
            placeholder="https://api.example.com"
          />
        </div>

        {/* Save Button */}
        <button
          onClick={() => onSave(local)}
          disabled={!local.name || !local.repo}
          className="btn btn-primary w-full"
        >
          <Save className="w-4 h-4" />
          Save Project
        </button>
      </main>
    </div>
  );
}
