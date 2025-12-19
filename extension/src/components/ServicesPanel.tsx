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

  const getStatusIcon = (status: string) => {
    if (status === 'ok') return <CheckCircle className="w-4 h-4 text-green-500" />;
    if (status === 'down') return <XCircle className="w-4 h-4 text-red-500" />;
    return <RefreshCw className="w-4 h-4 text-slate-400 animate-spin" />;
  };

  if (!project) {
    return (
      <div className="text-center py-8">
        <Activity className="w-12 h-12 mx-auto mb-3 text-slate-600" />
        <p className="text-slate-400">Select a project to view services</p>
      </div>
    );
  }

  if (services.length === 0) {
    return (
      <div className="text-center py-8">
        <Globe className="w-12 h-12 mx-auto mb-3 text-slate-600" />
        <p className="text-slate-400 mb-2">No environments configured</p>
        <p className="text-xs text-slate-500">
          Add production/staging URLs in Settings
        </p>
      </div>
    );
  }

  const healthyCount = services.filter((s) => s.status === 'ok').length;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-slate-400" />
          <span className="text-sm text-slate-300">
            {healthyCount}/{services.length} healthy
          </span>
        </div>
        <button
          onClick={() => checkHealth(services)}
          className="text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-1"
        >
          <RefreshCw className="w-3 h-3" />
          Check
        </button>
      </div>

      {/* Services */}
      <div className="space-y-2">
        {services.map((service) => (
          <div
            key={service.name}
            className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-slate-800/50 border border-slate-700/50"
          >
            <div className="flex items-center gap-2">
              {getStatusIcon(service.status)}
              <div>
                <div className="text-sm font-medium text-slate-200">
                  {service.name}
                </div>
                <div className="text-xs text-slate-500 truncate max-w-[180px]">
                  {service.url}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {lastCheck && (
        <div className="text-xs text-slate-500 text-center">
          Last check: {lastCheck.toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}
