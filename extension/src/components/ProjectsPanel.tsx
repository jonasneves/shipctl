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
      <div className="empty-state">
        <FolderGit2 className="w-10 h-10 empty-state-icon mx-auto" />
        <p className="empty-state-title">No projects yet</p>
        <p className="empty-state-text mb-4">Add a project to start shipping</p>
        <button onClick={onAddProject} className="btn btn-primary">
          <Plus className="w-4 h-4" />
          Add Project
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Section header */}
      <div className="section-header flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="section-title">Projects</span>
          <span className="counter">{projects.length}</span>
        </div>
        <button onClick={onAddProject} className="btn btn-ghost btn-sm text-info">
          <Plus className="w-3 h-3" />
          Add
        </button>
      </div>

      {/* Project list */}
      <div className="bg-primary">
        {projects.map((project) => {
          const isActive = activeProject?.id === project.id;
          return (
            <button
              key={project.id}
              onClick={() => onSelect(project)}
              className={`list-item w-full text-left ${isActive ? 'bg-success/5' : ''}`}
            >
              <div className="list-item-content">
                <div className={`list-item-icon ${isActive ? 'bg-success/10' : ''}`}>
                  <FolderGit2 className={`w-4 h-4 ${isActive ? 'text-success' : 'text-secondary'}`} />
                </div>
                <div className="list-item-text">
                  <div className="list-item-title">{project.name}</div>
                  <div className="list-item-subtitle">{project.repo}</div>
                </div>
              </div>
              {isActive && (
                <Check className="w-4 h-4 text-success flex-shrink-0" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
