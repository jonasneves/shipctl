interface HealthStatus {
  status: 'ok' | 'down' | 'checking';
  latency?: number;
}

class HealthChecker {
  private cache = new Map<string, HealthStatus>();
  private checking = new Set<string>();

  private async doCheck(url: string, timeout: number): Promise<HealthStatus> {
    const response = await chrome.runtime.sendMessage({
      type: 'HEALTH_CHECK',
      url,
      timeout,
    });
    return {
      status: response?.status === 'ok' ? 'ok' : 'down',
      latency: response?.latency,
    };
  }

  async check(url: string, timeout = 3000, retries = 1): Promise<HealthStatus> {
    if (this.checking.has(url)) {
      return this.cache.get(url) || { status: 'checking' };
    }

    this.checking.add(url);

    try {
      let status = await this.doCheck(url, timeout);

      // Retry once on failure
      if (status.status === 'down' && retries > 0) {
        await new Promise(r => setTimeout(r, 500));
        status = await this.doCheck(url, timeout);
      }

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
