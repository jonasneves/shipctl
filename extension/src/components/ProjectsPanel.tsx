import { FolderGit2, Plus, Check } from 'lucide-react';
import { Project } from '../types';

interface ProjectsPanelProps {
  projects: Project[];
  activeProject: Project | null;
  onSelect: (project: Project) => void;
  onAddProject: () => void;
}

export default function ProjectsPanel({
  projects,
  activeProject,
  onSelect,
  onAddProject,
}: ProjectsPanelProps) {
  if (projects.length === 0) {
    return (
      <div className="text-center py-12">
        <FolderGit2 className="w-12 h-12 mx-auto mb-3 text-muted" />
        <h3 className="text-base font-medium text-primary mb-2">No projects yet</h3>
        <p className="text-sm text-secondary mb-4">
          Add a project to start shipping
        </p>
        <button onClick={onAddProject} className="btn btn-primary">
          <Plus className="w-4 h-4" />
          Add Project
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-primary">Projects</h2>
        <button
          onClick={onAddProject}
          className="btn-ghost text-xs flex items-center gap-1 px-2 py-1 text-info"
        >
          <Plus className="w-3 h-3" />
          Add
        </button>
      </div>

      <div className="space-y-2">
        {projects.map((project) => (
          <button
            key={project.id}
            onClick={() => onSelect(project)}
            className={`w-full flex items-center justify-between p-3 card card-hover transition-colors ${
              activeProject?.id === project.id
                ? 'border-green-500/50 bg-green-500/5'
                : ''
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <FolderGit2 className="w-5 h-5 text-secondary flex-shrink-0" />
              <div className="text-left min-w-0">
                <div className="text-sm font-medium text-primary truncate">
                  {project.name}
                </div>
                <div className="text-xs text-muted truncate">{project.repo}</div>
              </div>
            </div>
            {activeProject?.id === project.id && (
              <Check className="w-4 h-4 text-success flex-shrink-0" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
