import { useState } from 'react';
import { Eye, EyeOff, Plus, Trash2, ExternalLink } from 'lucide-react';
import { Project, Settings } from '../types';

interface SettingsPanelProps {
  settings: Settings;
  projects: Project[];
  onSaveSettings: (settings: Settings) => void;
  onSaveProjects: (projects: Project[]) => void;
  onClose: () => void;
}

export default function SettingsPanel({
  settings,
  projects,
  onSaveSettings,
  onSaveProjects,
  onClose,
}: SettingsPanelProps) {
  const [localSettings, setLocalSettings] = useState(settings);
  const [localProjects, setLocalProjects] = useState(projects);
  const [showToken, setShowToken] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  const handleSave = () => {
    onSaveSettings(localSettings);
    onSaveProjects(localProjects);
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
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
    <div className="settings-modal">
      <div className="settings-backdrop" onClick={handleBackdropClick} />
      <div className="settings-content">
        <div className="settings-header">
          <h3>Settings</h3>
          <button onClick={onClose} className="settings-close">
            ×
          </button>
        </div>

        <div className="settings-body">
          {/* GitHub Token */}
          <div className="settings-section">
            <div className="settings-section-title">GitHub Token</div>
            <div className="relative mb-2">
              <input
                type={showToken ? 'text' : 'password'}
                value={localSettings.githubToken}
                onChange={(e) =>
                  setLocalSettings({ ...localSettings, githubToken: e.target.value })
                }
                className="input"
                placeholder="ghp_xxxxxxxxxxxx"
                style={{ paddingRight: '36px' }}
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-2 top-1/2 -translate-y-1/2 btn-header"
                style={{ width: '24px', height: '24px' }}
              >
                {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            <p className="settings-description">
              Needs <code className="mono text-secondary">repo</code> and{' '}
              <code className="mono text-secondary">workflow</code> scopes.{' '}
              <a
                href="https://github.com/settings/tokens/new?scopes=repo,workflow&description=shipctl"
                target="_blank"
                rel="noopener noreferrer"
                className="text-info hover:underline inline-flex items-center gap-0.5"
              >
                Create token <ExternalLink className="w-3 h-3" />
              </a>
            </p>
          </div>

          {/* Projects */}
          <div className="settings-section">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="settings-section-title" style={{ marginBottom: 0 }}>
                  Projects
                </div>
                <span className="counter">{localProjects.length}</span>
              </div>
              <button onClick={addProject} className="btn btn-ghost btn-sm text-info">
                <Plus className="w-3 h-3" />
                Add
              </button>
            </div>
            {localProjects.length === 0 ? (
              <p className="text-sm text-muted text-center py-4">No projects configured</p>
            ) : (
              <div className="space-y-2">
                {localProjects.map((project) => (
                  <label key={project.id} className="toggle-item">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-primary truncate">
                        {project.name || 'Untitled'}
                      </div>
                      <div className="text-xs text-muted truncate">{project.repo || 'No repo'}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          setEditingProject(project);
                        }}
                        className="btn btn-ghost btn-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          deleteProject(project.id);
                        }}
                        className="btn btn-ghost btn-sm text-muted hover:text-danger"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="settings-footer">
          <button onClick={handleSave} className="settings-save">
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

// Project Editor
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

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onCancel();
    }
  };

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
    <div className="settings-modal">
      <div className="settings-backdrop" onClick={handleBackdropClick} />
      <div className="settings-content">
        <div className="settings-header">
          <h3>{project.name ? 'Edit Project' : 'New Project'}</h3>
          <button onClick={onCancel} className="settings-close">
            ×
          </button>
        </div>

        <div className="settings-body">
          {/* Basic Info */}
          <div className="settings-section">
            <div className="settings-section-title">Basic Info</div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-secondary mb-1">
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
              <div>
                <label className="block text-xs font-medium text-secondary mb-1">
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
            </div>
          </div>

          {/* Workflows */}
          <div className="settings-section">
            <div className="settings-section-title">Workflows</div>
            <div className="flex gap-2 mb-3">
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
                  <span key={w} className="status-badge status-badge-neutral">
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

          {/* Local Development */}
          <div className="settings-section">
            <div className="settings-section-title">Local Development</div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-secondary mb-1">
                  Dev Command
                </label>
                <input
                  type="text"
                  value={local.localCommand || ''}
                  onChange={(e) => setLocal({ ...local, localCommand: e.target.value })}
                  className="input mono"
                  placeholder="npm run dev"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-secondary mb-1">
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
            </div>
          </div>

          {/* Environments */}
          <div className="settings-section">
            <div className="settings-section-title">Environments</div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-secondary mb-1">
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
              <div>
                <label className="block text-xs font-medium text-secondary mb-1">
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
            </div>
          </div>
        </div>

        <div className="settings-footer">
          <button
            onClick={() => onSave(local)}
            disabled={!local.name || !local.repo}
            className="settings-save"
          >
            Save Project
          </button>
        </div>
      </div>
    </div>
  );
}
