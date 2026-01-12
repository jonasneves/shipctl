import { useState, useCallback, useMemo } from 'react';
import { SERVICES, buildEndpoint } from './useExtensionConfig';
import { healthChecker, type HealthStatus } from '../services/healthCheck';
import { normalizeBaseUrl } from '../utils/url';

interface UseHealthMonitoringProps {
  chatApiBaseUrl: string;
  modelsBaseDomain: string;
  modelsUseHttps: boolean;
}

export function useHealthMonitoring({
  chatApiBaseUrl,
  modelsBaseDomain,
  modelsUseHttps,
}: UseHealthMonitoringProps) {
  const [backendHealth, setBackendHealth] = useState<HealthStatus>({ status: 'checking' });
  const [modelHealthStatuses, setModelHealthStatuses] = useState<Map<string, HealthStatus>>(new Map());
  const [backendHealthHistory, setBackendHealthHistory] = useState<number[]>([]);
  const [modelHealthHistory, setModelHealthHistory] = useState<Map<string, number[]>>(new Map());

  const checkBackendHealth = useCallback(async () => {
    setBackendHealth({ status: 'checking' });
    const baseUrl = normalizeBaseUrl(chatApiBaseUrl) || 'http://localhost:8080';
    const status = await healthChecker.check(baseUrl, 5000);
    setBackendHealth(status);

    setBackendHealthHistory(prev => {
      const latency = status.latency || 0;
      return [...prev, latency].slice(-10);
    });
  }, [chatApiBaseUrl]);

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

  // Aggregate stats
  const stats = useMemo(() => {
    const healthValues = [...modelHealthStatuses.values()];
    return {
      online: healthValues.filter(s => s.status === 'ok').length,
      checking: healthValues.filter(s => s.status === 'checking').length,
      down: healthValues.filter(s => s.status === 'down').length,
      total: SERVICES.length,
    };
  }, [modelHealthStatuses]);

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
