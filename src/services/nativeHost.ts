interface NativeResponse<T = any> {
  ok: boolean;
  error?: string;
  logTail?: string;
  [key: string]: any;
}

interface StatusResponse extends NativeResponse {
  status?: 'running' | 'stopped';
  mode?: string;
  pid?: number;
}

class NativeHost {
  private apiBase = 'http://127.0.0.1:9876';

  private async httpRequest<T = any>(endpoint: string, body: any): Promise<NativeResponse<T>> {
    try {
      const response = await fetch(`${this.apiBase}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.text();
        return { ok: false, error };
      }

      const data = await response.json();
      return data;
    } catch (e: any) {
      return { ok: false, error: e?.message || String(e) };
    }
  }

  async status(chatApiBaseUrl: string): Promise<StatusResponse> {
    return this.httpRequest('/api/status', { chatApiBaseUrl });
  }

  async start(mode: string): Promise<NativeResponse> {
    return this.httpRequest('/api/start', { mode });
  }

  async stop(): Promise<NativeResponse> {
    return this.httpRequest('/api/stop', {});
  }

  async logs(): Promise<NativeResponse> {
    return this.httpRequest('/api/logs', {});
  }

  async make(target: string): Promise<NativeResponse> {
    return this.httpRequest('/api/make', { target });
  }

  async saveConfig(pythonPath: string, repoPath: string): Promise<NativeResponse> {
    return this.httpRequest('/api/config', { pythonPath, repoPath });
  }
}

export const nativeHost = new NativeHost();
