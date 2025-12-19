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
      list.push({
        name: 'Production',
        url: proj.environments.production,
        status: 'checking',
      });
    }
    if (proj.environments?.staging) {
      list.push({
        name: 'Staging',
        url: proj.environments.staging,
        status: 'checking',
      });
    }
    if (proj.localPort) {
      list.push({
        name: 'Local',
        url: `http://localhost:${proj.localPort}`,
        status: 'checking',
      });
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
        <span className="badge badge-success">
          <CheckCircle className="w-3 h-3" />
          Healthy
        </span>
      );
    }
    if (status === 'down') {
      return (
        <span className="badge badge-danger">
          <XCircle className="w-3 h-3" />
          Down
        </span>
      );
    }
    return (
      <span className="badge badge-neutral">
        <RefreshCw className="w-3 h-3 animate-spin" />
        Checking
      </span>
    );
  };

  if (!project) {
    return (
      <div className="text-center py-12">
        <Activity className="w-12 h-12 mx-auto mb-3 text-muted" />
        <p className="text-secondary">Select a project to view services</p>
      </div>
    );
  }

  if (services.length === 0) {
    return (
      <div className="text-center py-12">
        <Globe className="w-12 h-12 mx-auto mb-3 text-muted" />
        <p className="text-secondary mb-1">No environments configured</p>
        <p className="text-xs text-muted">Add production/staging URLs in Settings</p>
      </div>
    );
  }

  const healthyCount = services.filter((s) => s.status === 'ok').length;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-secondary" />
            <span className="text-sm font-medium text-primary">
              {healthyCount}/{services.length} healthy
            </span>
          </div>
          <button
            onClick={() => checkHealth(services)}
            className="btn-ghost text-xs flex items-center gap-1 px-2 py-1"
          >
            <RefreshCw className="w-3 h-3" />
            Check
          </button>
        </div>
      </div>

      {/* Services */}
      <div className="space-y-2">
        {services.map((service) => {
          const accentClass = service.status === 'ok' ? 'success' : 
                              service.status === 'down' ? 'danger' : '';
          return (
            <div key={service.name} className={`card-accent ${accentClass} p-4`}>
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-primary">
                    {service.name}
                  </div>
                  <div className="text-xs text-muted truncate mt-0.5">
                    {service.url}
                  </div>
                </div>
                {getStatusBadge(service.status)}
              </div>
            </div>
          );
        })}
      </div>

      {lastCheck && (
        <div className="text-xs text-muted text-center">
          Last check: {lastCheck.toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}
