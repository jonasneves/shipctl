// Shared status colors and labels for consistent UI across components

export type HealthStatus = 'ok' | 'down' | 'checking';
export type ServiceStatus = HealthStatus | 'running' | 'stopped' | 'building' | 'deploying' | 'unknown';

// Dot/indicator colors by status
export const STATUS_DOT_COLORS: Record<ServiceStatus, string> = {
  ok: 'bg-emerald-400',
  running: 'bg-emerald-400',
  down: 'bg-red-400',
  stopped: 'bg-red-400',
  checking: 'bg-amber-400',
  building: 'bg-amber-400',
  deploying: 'bg-blue-400',
  unknown: 'bg-slate-600',
};

// Text colors by status
export const STATUS_TEXT_COLORS: Record<ServiceStatus, string> = {
  ok: 'text-emerald-400',
  running: 'text-emerald-400',
  down: 'text-red-400',
  stopped: 'text-red-400',
  checking: 'text-amber-400',
  building: 'text-amber-400',
  deploying: 'text-blue-400',
  unknown: 'text-slate-500',
};

// Left border accent colors
export const ACCENT_COLORS = {
  deploying: 'border-l-blue-500',
  healthy: 'border-l-emerald-500',
  down: 'border-l-red-400',
  checking: 'border-l-amber-400',
  default: 'border-l-slate-700',
} as const;

// Health status labels
export const HEALTH_LABELS: Record<HealthStatus, string> = {
  ok: 'Healthy',
  down: 'Down',
  checking: 'Checking',
};

// Latency thresholds and colors
export function getLatencyColor(latency?: number): string {
  if (!latency) return 'text-slate-500';
  if (latency < 500) return 'text-emerald-400';
  if (latency < 1500) return 'text-amber-400';
  return 'text-red-400';
}

export function formatLatency(latency?: number): string | null {
  if (!latency) return null;
  if (latency < 1000) return `${latency}ms`;
  return `${(latency / 1000).toFixed(1)}s`;
}
