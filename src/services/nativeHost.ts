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
  private async sendMessage(payload: any): Promise<NativeResponse> {
    console.log('[nativeHost] Sending message to background:', payload);
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { type: 'native_backend', payload },
        (response) => {
          console.log('[nativeHost] Response from background:', response, 'lastError:', chrome.runtime.lastError);
          if (chrome.runtime.lastError) {
            resolve({ ok: false, error: chrome.runtime.lastError.message });
          } else {
            resolve(response || { ok: false, error: 'No response from native host' });
          }
        }
      );
    });
  }

  async status(chatApiBaseUrl: string): Promise<StatusResponse> {
    return this.sendMessage({ action: 'status', chatApiBaseUrl });
  }

  async start(mode: string): Promise<NativeResponse> {
    return this.sendMessage({ action: 'start', mode });
  }

  async stop(): Promise<NativeResponse> {
    return this.sendMessage({ action: 'stop' });
  }

  async logs(): Promise<NativeResponse> {
    return this.sendMessage({ action: 'logs' });
  }

  async make(target: string): Promise<NativeResponse> {
    return this.sendMessage({ action: 'make', target });
  }

  async saveConfig(pythonPath: string, repoPath: string): Promise<NativeResponse> {
    return this.sendMessage({ action: 'save_config', pythonPath, repoPath });
  }

  async getConfig(): Promise<NativeResponse & {
    repoPath?: string;
    pythonPath?: string;
    githubRepoOwner?: string;
    githubRepoName?: string;
  }> {
    return this.sendMessage({ action: 'get_config' });
  }
}

export const nativeHost = new NativeHost();
