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
      <div className="text-center py-8">
        <FolderGit2 className="w-12 h-12 mx-auto mb-3 text-slate-600" />
        <h3 className="text-lg font-medium text-slate-300 mb-2">No projects yet</h3>
        <p className="text-sm text-slate-500 mb-4">
          Add a project to start shipping
        </p>
        <button
          onClick={onAddProject}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Project
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-slate-400">Projects</h2>
        <button
          onClick={onAddProject}
          className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
        >
          <Plus className="w-3 h-3" />
          Add
        </button>
      </div>

      {projects.map((project) => (
        <button
          key={project.id}
          onClick={() => onSelect(project)}
          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border transition-colors ${
            activeProject?.id === project.id
              ? 'bg-blue-600/20 border-blue-500/50 text-blue-300'
              : 'bg-slate-800/50 border-slate-700/50 hover:bg-slate-800 text-slate-200'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <FolderGit2 className="w-4 h-4 flex-shrink-0" />
            <div className="text-left min-w-0">
              <div className="text-sm font-medium truncate">{project.name}</div>
              <div className="text-xs text-slate-500 truncate">{project.repo}</div>
            </div>
          </div>
          {activeProject?.id === project.id && (
            <Check className="w-4 h-4 text-blue-400 flex-shrink-0" />
          )}
        </button>
      ))}
    </div>
  );
}
