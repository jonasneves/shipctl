import { useState, useCallback } from 'react';
import { nativeHost } from '../services/nativeHost';
import { normalizeBaseUrl } from '../utils/url';

interface UseBackendControlProps {
  chatApiBaseUrl: string;
  modelsBaseDomain: string;
  onBackendStatusChange?: (status: { process: 'running' | 'stopped' | 'unknown'; mode: string | null }) => void;
  checkBackendHealth: () => Promise<void>;
}

export function useBackendControl({
  chatApiBaseUrl,
  modelsBaseDomain,
  onBackendStatusChange,
  checkBackendHealth,
}: UseBackendControlProps) {
  const [backendProcess, setBackendProcess] = useState<'running' | 'stopped' | 'unknown'>('unknown');
  const [backendPid, setBackendPid] = useState<number | null>(null);
  const [backendBusy, setBackendBusy] = useState(false);
  const [backendLogTail, setBackendLogTail] = useState<string | null>(null);
  const [backendNativeError, setBackendNativeError] = useState<string | null>(null);
  const [buildBusy, setBuildBusy] = useState(false);
  const [buildLogTail, setBuildLogTail] = useState<string | null>(null);
  const [buildNativeError, setBuildNativeError] = useState<string | null>(null);

  const refreshBackendStatus = useCallback(async () => {
    const normalized = normalizeBaseUrl(chatApiBaseUrl) || 'http://localhost:8080';
    const resp = await nativeHost.status(normalized);
    if (resp?.ok) {
      const process = resp.status === 'running' ? 'running' : 'stopped';
      const mode = resp.mode ?? null;
      setBackendProcess(process);
      setBackendPid(resp.pid ?? null);
      setBackendNativeError(null);
      onBackendStatusChange?.({ process, mode });
      return;
    }
    setBackendNativeError(resp?.error || null);
    setBackendProcess('unknown');
    setBackendPid(null);
    onBackendStatusChange?.({ process: 'unknown', mode: null });
  }, [chatApiBaseUrl, onBackendStatusChange]);

  const startBackend = useCallback(async () => {
    setBackendBusy(true);
    setBackendLogTail(null);
    setBackendNativeError(null);

    const isLocalChat = chatApiBaseUrl.includes('localhost') || chatApiBaseUrl.includes('127.0.0.1');
    if (!isLocalChat) {
      setBackendNativeError('Backend start only works with local chat API');
      setBackendBusy(false);
      return;
    }

    const mode = modelsBaseDomain ? 'dev-chat' : 'dev-interface-local';
    const resp = await nativeHost.start(mode);
    if (!resp?.ok && resp?.logTail) setBackendLogTail(resp.logTail);
    if (!resp?.ok && resp?.error) setBackendNativeError(resp.error);
    await refreshBackendStatus();
    await checkBackendHealth();
    setBackendBusy(false);
  }, [chatApiBaseUrl, modelsBaseDomain, refreshBackendStatus, checkBackendHealth]);

  const stopBackend = useCallback(async () => {
    setBackendBusy(true);
    setBackendLogTail(null);
    setBackendNativeError(null);
    await nativeHost.stop();
    await refreshBackendStatus();
    await checkBackendHealth();
    setBackendBusy(false);
  }, [refreshBackendStatus, checkBackendHealth]);

  const fetchBackendLogs = useCallback(async () => {
    const resp = await nativeHost.logs();
    if (resp?.ok) setBackendLogTail(resp.logTail || null);
    if (!resp?.ok && resp?.error) setBackendNativeError(resp.error);
  }, []);

  const runBuild = useCallback(async (target: 'playground' | 'extension' | 'both') => {
    setBuildBusy(true);
    setBuildLogTail(null);
    setBuildNativeError(null);

    const targets = target === 'both'
      ? ['build-playground', 'build-extension']
      : [`build-${target}`];

    for (const t of targets) {
      const resp = await nativeHost.make(t);
      if (resp?.logTail) setBuildLogTail(prev => prev ? `${prev}\n\n--- ${t} ---\n${resp.logTail}` : (resp.logTail || null));
      if (!resp?.ok) {
        setBuildNativeError(resp?.error || `${t} failed`);
        setBuildBusy(false);
        return;
      }
    }

    setBuildBusy(false);
  }, []);

  return {
    backendProcess,
    backendPid,
    backendBusy,
    backendLogTail,
    backendNativeError,
    buildBusy,
    buildLogTail,
    buildNativeError,
    refreshBackendStatus,
    startBackend,
    stopBackend,
    fetchBackendLogs,
    runBuild,
  };
}
