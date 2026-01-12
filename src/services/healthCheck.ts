interface HealthStatus {
  status: 'ok' | 'down' | 'checking';
  latency?: number;
}

class HealthChecker {
  private cache = new Map<string, HealthStatus>();
  private checking = new Set<string>();

  async check(url: string, timeout = 3000): Promise<HealthStatus> {
    if (this.checking.has(url)) {
      return this.cache.get(url) || { status: 'checking' };
    }

    this.checking.add(url);
    const start = Date.now();

    try {
      const response = await fetch(`${url}/health`, {
        method: 'GET',
        mode: 'cors',
        credentials: 'omit',
        signal: AbortSignal.timeout(timeout),
      });

      const latency = Date.now() - start;
      const status: HealthStatus = {
        status: response.ok ? 'ok' : 'down',
        latency,
      };
      this.cache.set(url, status);
      return status;
    } catch {
      const status: HealthStatus = { status: 'down' };
      this.cache.set(url, status);
      return status;
    } finally {
      this.checking.delete(url);
    }
  }
}

export const healthChecker = new HealthChecker();
export type { HealthStatus };
