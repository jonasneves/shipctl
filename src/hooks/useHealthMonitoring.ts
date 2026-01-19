import { useState, useCallback, useMemo } from 'react';
import { SERVICES, buildEndpoint } from './useExtensionConfig';
import { healthChecker, type HealthStatus } from '../services/healthCheck';

interface UseHealthMonitoringProps {
  modelsBaseDomain: string;
  modelsUseHttps: boolean;
}

export function useHealthMonitoring({
  modelsBaseDomain,
  modelsUseHttps,
}: UseHealthMonitoringProps) {
  const [backendHealth, setBackendHealth] = useState<HealthStatus>({ status: 'checking' });
  const [modelHealthStatuses, setModelHealthStatuses] = useState<Map<string, HealthStatus>>(new Map());
  const [backendHealthHistory, setBackendHealthHistory] = useState<number[]>([]);
  const [modelHealthHistory, setModelHealthHistory] = useState<Map<string, number[]>>(new Map());

  const checkBackendHealth = useCallback(async () => {
    setBackendHealth({ status: 'checking' });
    // Use same pattern as models: https://chat.{domain}
    const baseUrl = buildEndpoint('chat', 8080, modelsBaseDomain, modelsUseHttps);
    const status = await healthChecker.check(baseUrl, 5000);
    setBackendHealth(status);

    setBackendHealthHistory(prev => {
      const latency = status.latency || 0;
      return [...prev, latency].slice(-10);
    });
  }, [modelsBaseDomain, modelsUseHttps]);

  const checkAllModelsHealth = useCallback(async () => {
    // Set all to checking in one batch
    setModelHealthStatuses(prev => {
      const next = new Map(prev);
      for (const service of SERVICES) {
        next.set(service.key, { status: 'checking' });
      }
      return next;
    });

    const checks = SERVICES.map(async (service) => {
      const endpoint = buildEndpoint(service.key, service.localPort, modelsBaseDomain, modelsUseHttps);
      const status = await healthChecker.check(endpoint, 3000);
      return { key: service.key, status };
    });

    const results = await Promise.all(checks);

    // Batch update all results at once
    setModelHealthStatuses(prev => {
      const next = new Map(prev);
      for (const res of results) {
        next.set(res.key, res.status);
      }
      return next;
    });

    // Update history tracking
    setModelHealthHistory(prev => {
      const next = new Map(prev);
      for (const res of results) {
        const existing = prev.get(res.key) || [];
        const latency = res.status.latency || 0;
        const newHistory = [...existing, latency].slice(-10);
        next.set(res.key, newHistory);
      }
      return next;
    });
  }, [modelsBaseDomain, modelsUseHttps]);

  // Aggregate stats (includes Chat API + all models)
  const stats = useMemo(() => {
    const healthValues = [...modelHealthStatuses.values()];
    const backendOnline = backendHealth.status === 'ok' ? 1 : 0;
    const backendDown = backendHealth.status === 'down' ? 1 : 0;
    const backendChecking = backendHealth.status === 'checking' ? 1 : 0;
    return {
      online: healthValues.filter(s => s.status === 'ok').length + backendOnline,
      checking: healthValues.filter(s => s.status === 'checking').length + backendChecking,
      down: healthValues.filter(s => s.status === 'down').length + backendDown,
      total: SERVICES.length + 1,
    };
  }, [modelHealthStatuses, backendHealth]);

  return {
    backendHealth,
    modelHealthStatuses,
    backendHealthHistory,
    modelHealthHistory,
    checkBackendHealth,
    checkAllModelsHealth,
    stats,
  };
}
