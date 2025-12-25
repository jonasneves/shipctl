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
  private isAvailable(): boolean {
    return typeof chrome !== 'undefined' && !!chrome.runtime?.sendMessage;
  }

  private async request<T = any>(payload: any): Promise<NativeResponse<T>> {
    if (!this.isAvailable()) {
      return { ok: false, error: 'Native messaging unavailable' };
    }

    return new Promise<NativeResponse<T>>((resolve) => {
      try {
        chrome.runtime.sendMessage({ type: 'native_backend', payload }, (response) => {
          const err = chrome.runtime.lastError?.message;
          if (err) resolve({ ok: false, error: err });
          else resolve(response);
        });
      } catch (e: any) {
        resolve({ ok: false, error: e?.message || String(e) });
      }
    });
  }

  async status(chatApiBaseUrl: string): Promise<StatusResponse> {
    return this.request({ action: 'status', chatApiBaseUrl });
  }

  async start(mode: string): Promise<NativeResponse> {
    return this.request({ action: 'start', mode });
  }

  async stop(): Promise<NativeResponse> {
    return this.request({ action: 'stop' });
  }

  async logs(): Promise<NativeResponse> {
    return this.request({ action: 'logs' });
  }

  async make(target: string): Promise<NativeResponse> {
    return this.request({ action: 'make', target });
  }

  async saveConfig(pythonPath: string, repoPath: string): Promise<NativeResponse> {
    return this.request({ action: 'save_config', pythonPath, repoPath });
  }
}

export const nativeHost = new NativeHost();
