export type HealthStatus = 'ok' | 'down' | 'checking';
export type ServiceStatus = HealthStatus | 'running' | 'stopped' | 'building' | 'deploying' | 'unknown';
