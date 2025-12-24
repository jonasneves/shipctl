import { useState, useEffect, useCallback } from 'react';
import { Activity, RefreshCw, CheckCircle, XCircle, Globe } from 'lucide-react';
import { Project } from '../types';

interface ServiceHealth {
  name: string;
  url: string;
  status: 'ok' | 'down' | 'checking';
}

interface ServicesPanelProps {
  project: Project | null;
}

export default function ServicesPanel({ project }: ServicesPanelProps) {
  const [services, setServices] = useState<ServiceHealth[]>([]);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  const buildServicesList = useCallback((proj: Project): ServiceHealth[] => {
    const list: ServiceHealth[] = [];

    if (proj.environments?.production) {
      list.push({ name: 'Production', url: proj.environments.production, status: 'checking' });
    }
    if (proj.environments?.staging) {
      list.push({ name: 'Staging', url: proj.environments.staging, status: 'checking' });
    }
    if (proj.localPort) {
      list.push({ name: 'Local', url: `http://localhost:${proj.localPort}`, status: 'checking' });
    }

    return list;
  }, []);

  const checkHealth = useCallback(async (servicesList: ServiceHealth[]) => {
    setLastCheck(new Date());
    const results = await Promise.all(
      servicesList.map(async (service) => {
        try {
          const endpoint = service.url + (project?.healthEndpoint || '/health');
          const response = await fetch(endpoint, {
            method: 'GET',
            mode: 'cors',
            signal: AbortSignal.timeout(5000),
          });
          return { ...service, status: response.ok ? 'ok' : 'down' } as ServiceHealth;
        } catch {
          return { ...service, status: 'down' } as ServiceHealth;
        }
      })
    );
    setServices(results);
  }, [project?.healthEndpoint]);

  useEffect(() => {
    if (!project) {
      setServices([]);
      return;
    }

    const list = buildServicesList(project);
    setServices(list);

    if (list.length > 0) {
      checkHealth(list);
      const interval = setInterval(() => checkHealth(list), 30000);
      return () => clearInterval(interval);
    }
  }, [project, buildServicesList, checkHealth]);

  const getStatusBadge = (status: string) => {
    if (status === 'ok') {
      return (
        <span className="status-badge status-badge-success">
          <CheckCircle className="w-3 h-3" />
          Healthy
        </span>
      );
    }
    if (status === 'down') {
      return (
        <span className="status-badge status-badge-danger">
          <XCircle className="w-3 h-3" />
          Down
        </span>
      );
    }
    return (
      <span className="status-badge status-badge-neutral">
        <RefreshCw className="w-3 h-3 animate-spin" />
        Checking
      </span>
    );
  };

  if (!project) {
    return (
      <div className="empty-state">
        <Activity className="w-10 h-10 empty-state-icon mx-auto" />
        <p className="empty-state-title">No project selected</p>
        <p className="empty-state-text">Select a project to view services</p>
      </div>
    );
  }

  if (services.length === 0) {
    return (
      <div className="empty-state">
        <Globe className="w-10 h-10 empty-state-icon mx-auto" />
        <p className="empty-state-title">No environments configured</p>
        <p className="empty-state-text">Add production/staging URLs in Settings</p>
      </div>
    );
  }

  const healthyCount = services.filter((s) => s.status === 'ok').length;

  return (
    <div>
      {/* Section header with summary */}
      <div className="section-header flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="section-title">Services</span>
          <span className="counter">{healthyCount}/{services.length}</span>
        </div>
        <button onClick={() => checkHealth(services)} className="btn btn-ghost btn-sm">
          <RefreshCw className="w-3 h-3" />
        </button>
      </div>

      {/* Service list */}
      <div className="bg-primary">
        {services.map((service) => (
          <div key={service.name} className="list-item">
            <div className="list-item-content">
              <div className="list-item-icon">
                <Globe className="w-4 h-4 text-secondary" />
              </div>
              <div className="list-item-text">
                <div className="list-item-title">{service.name}</div>
                <div className="list-item-subtitle mono">{service.url}</div>
              </div>
            </div>
            <div className="list-item-actions">
              {getStatusBadge(service.status)}
            </div>
          </div>
        ))}
      </div>

      {lastCheck && (
        <div className="px-4 py-2 text-center">
          <span className="text-xs text-muted">
            Last check: {lastCheck.toLocaleTimeString()}
          </span>
        </div>
      )}
    </div>
  );
}
