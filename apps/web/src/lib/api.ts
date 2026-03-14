// ==============================================================================
// PocketJury — API Client
// ==============================================================================

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

type FetchOptions = RequestInit & { timeout?: number };

class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public data?: unknown,
  ) {
    super(`API Error: ${status} ${statusText}`);
    this.name = 'ApiError';
  }
}

let isRefreshing = false;

async function fetchWithAuth(url: string, options: FetchOptions = {}, _isRetry = false): Promise<Response> {
  const { timeout = 30000, ...fetchOptions } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(`${API_BASE}${url}`, {
      ...fetchOptions,
      signal: controller.signal,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...fetchOptions.headers,
      },
    });

    if (!response.ok) {
      // Attempt token refresh on 401, but only once
      if (response.status === 401 && !_isRetry && !isRefreshing) {
        isRefreshing = true;
        try {
          const refreshResponse = await fetch(`${API_BASE}/auth/refresh`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
          });
          isRefreshing = false;
          if (refreshResponse.ok) {
            return fetchWithAuth(url, options, true);
          }
        } catch {
          isRefreshing = false;
        }
      }

      const data = await response.json().catch(() => null);
      throw new ApiError(response.status, response.statusText, data);
    }

    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ----- Auth -----
export const authApi = {
  register: (data: { email: string; password: string; fullName: string; dateOfBirth: string; preferredLanguage?: string }) =>
    fetchWithAuth('/auth/register', { method: 'POST', body: JSON.stringify(data) }).then((r) => r.json()),

  login: (data: { email: string; password: string }) =>
    fetchWithAuth('/auth/login', { method: 'POST', body: JSON.stringify(data) }).then((r) => r.json()),

  googleAuth: (token: string) =>
    fetchWithAuth('/auth/google', { method: 'POST', body: JSON.stringify({ idToken: token }) }).then((r) => r.json()),

  refresh: () =>
    fetchWithAuth('/auth/refresh', { method: 'POST' }).then((r) => r.json()),

  logout: () =>
    fetchWithAuth('/auth/logout', { method: 'POST' }).then((r) => r.json()),
};

// ----- User -----
export const userApi = {
  getProfile: () =>
    fetchWithAuth('/users/me').then((r) => r.json()),

  updateProfile: (data: Record<string, unknown>) =>
    fetchWithAuth('/users/me', { method: 'PATCH', body: JSON.stringify(data) }).then((r) => r.json()),

  updateLanguage: (language: string) =>
    fetchWithAuth('/users/me/language', { method: 'PATCH', body: JSON.stringify({ languageCode: language }) }).then((r) => r.json()),

  updatePersona: (persona: string) =>
    fetchWithAuth('/users/me/persona', { method: 'PATCH', body: JSON.stringify({ personaMode: persona }) }).then((r) => r.json()),

  deleteAccount: () =>
    fetchWithAuth('/users/me', { method: 'DELETE' }).then((r) => r.json()),

  exportData: () =>
    fetchWithAuth('/users/me/data-export').then((r) => r.json()),
};

// ----- Chat -----
export const chatApi = {
  list: (cursor?: string) =>
    fetchWithAuth(`/chats${cursor ? `?cursor=${cursor}` : ''}`).then((r) => r.json()),

  create: (data?: { title?: string }) =>
    fetchWithAuth('/chats', { method: 'POST', body: JSON.stringify(data || {}) }).then((r) => r.json()),

  get: (chatId: string) =>
    fetchWithAuth(`/chats/${chatId}`).then((r) => r.json()),

  update: (chatId: string, data: Record<string, unknown>) =>
    fetchWithAuth(`/chats/${chatId}`, { method: 'PATCH', body: JSON.stringify(data) }).then((r) => r.json()),

  delete: (chatId: string) =>
    fetchWithAuth(`/chats/${chatId}`, { method: 'DELETE' }).then(() => undefined),

  sendMessage: (chatId: string, query: string) =>
    fetchWithAuth(`/chats/${chatId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content: query }),
      timeout: 180000, // 180s for AI processing
    }).then((r) => r.json()),

  simplify: (chatId: string, messageId: string) =>
    fetchWithAuth(`/chats/${chatId}/messages/${messageId}/simplify`, { method: 'POST' }).then((r) => r.json()),

  getReferences: (chatId: string, messageId: string) =>
    fetchWithAuth(`/chats/${chatId}/messages/${messageId}/references`, { method: 'POST' }).then((r) => r.json()),

  createSystemMessage: (chatId: string, content: string) =>
    fetchWithAuth(`/chats/${chatId}/messages/system`, { method: 'POST', body: JSON.stringify({ content }) }).then((r) => r.json()),
};

// ----- DLSA -----
export const dlsaApi = {
  search: (state: string, district?: string) =>
    fetchWithAuth(`/dlsa/search?state=${encodeURIComponent(state)}${district ? `&district=${encodeURIComponent(district)}` : ''}`).then((r) => r.json()),

  nearest: (latitude: number, longitude: number) =>
    fetchWithAuth(`/dlsa/nearest?lat=${latitude}&lng=${longitude}`).then((r) => r.json()),

  helplines: () =>
    fetchWithAuth('/dlsa/helplines').then((r) => r.json()),
};

// ----- Feedback -----
export const feedbackApi = {
  submit: (data: { messageId: string; rating: string; comment?: string }) =>
    fetchWithAuth('/feedback', { method: 'POST', body: JSON.stringify(data) }).then((r) => r.json()),
};

export { ApiError };
