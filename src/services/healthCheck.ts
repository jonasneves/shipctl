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

    try {
      // Use background script to bypass CORS
      console.log('[healthCheck] Requesting:', url);
      const response = await chrome.runtime.sendMessage({
        type: 'HEALTH_CHECK',
        url,
        timeout,
      });
      console.log('[healthCheck] Response:', url, response);
      const status: HealthStatus = {
        status: response?.status === 'ok' ? 'ok' : 'down',
        latency: response?.latency,
      };
      this.cache.set(url, status);
      return status;
    } catch (err) {
      console.log('[healthCheck] Error:', url, err);
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
