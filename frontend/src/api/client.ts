import { ApiResponse } from './types';

export const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

class ApiClient {
  private accessToken: string | null = null;
  private isRefreshing = false;
  private refreshSubscribers: ((token: string) => void)[] = [];

  constructor() {
    this.accessToken = localStorage.getItem('siap_access_token');
  }

  setAccessToken(token: string | null) {
    this.accessToken = token;
    if (token) {
      localStorage.setItem('siap_access_token', token);
    } else {
      localStorage.removeItem('siap_access_token');
    }
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  private onTokenRefreshed(token: string) {
    this.refreshSubscribers.forEach((cb) => cb(token));
    this.refreshSubscribers = [];
  }

  private addRefreshSubscriber(cb: (token: string) => void) {
    this.refreshSubscribers.push(cb);
  }

  async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        credentials: 'include',
      });

      // Handle 401 Token Expired & Silent Refresh
      if (response.status === 401 && !endpoint.includes('/auth/refresh') && !endpoint.includes('/auth/google')) {
        if (!this.isRefreshing) {
          this.isRefreshing = true;
          try {
            const refreshRes = await this.request<{ accessToken: string }>('/auth/refresh', {
              method: 'POST',
            });
            if (refreshRes.success && refreshRes.data?.accessToken) {
              this.setAccessToken(refreshRes.data.accessToken);
              this.onTokenRefreshed(refreshRes.data.accessToken);
              this.isRefreshing = false;

              // Retry original request
              headers['Authorization'] = `Bearer ${refreshRes.data.accessToken}`;
              const retryRes = await fetch(url, { ...options, headers, credentials: 'include' });
              return await retryRes.json();
            }
          } catch {
            this.setAccessToken(null);
            this.isRefreshing = false;
          }
        } else {
          // Wait for refresh to complete then retry
          return new Promise((resolve) => {
            this.addRefreshSubscriber(async (newToken) => {
              headers['Authorization'] = `Bearer ${newToken}`;
              const retryRes = await fetch(url, { ...options, headers, credentials: 'include' });
              resolve(await retryRes.json());
            });
          });
        }
      }

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          data: null as unknown as T,
          error: {
            code: data?.error?.code || `HTTP_${response.status}`,
            message: data?.error?.message || data?.message || 'Terjadi kesalahan sistem',
            details: data?.error?.details || data,
          },
        };
      }

      // If backend returns enveloped format { success: true, data: ... }
      if (data && typeof data === 'object' && 'success' in data && 'data' in data) {
        return data as ApiResponse<T>;
      }

      // If backend returns raw data
      return {
        success: true,
        data: data as T,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal menghubungi server';
      return {
        success: false,
        data: null as unknown as T,
        error: {
          code: 'NETWORK_ERROR',
          message,
        },
      };
    }
  }

  get<T>(endpoint: string, options?: RequestInit) {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  post<T>(endpoint: string, body?: unknown, options?: RequestInit) {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  patch<T>(endpoint: string, body?: unknown, options?: RequestInit) {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  delete<T>(endpoint: string, options?: RequestInit) {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
}

export const apiClient = new ApiClient();
