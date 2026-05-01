import { ServiceRecord } from '../types'

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {})
    }
  })
  if (!res.ok) {
    let message = `HTTP ${res.status}`
    try {
      const data = await res.json()
      if (data?.error) message = data.error
    } catch {
      /* noop */
    }
    throw new Error(message)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

export const api = {
  listServices: () => request<ServiceRecord[]>('/api/services'),

  createService: (data: Omit<ServiceRecord, 'id'>) =>
    request<ServiceRecord>('/api/services', { method: 'POST', body: JSON.stringify(data) }),

  updateService: (id: string, data: Omit<ServiceRecord, 'id'>) =>
    request<ServiceRecord>(`/api/services/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  patchService: (id: string, data: Partial<Pick<ServiceRecord, 'lastPaymentYear' | 'lastNotifiedYear'>>) =>
    request<ServiceRecord>(`/api/services/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  deleteService: (id: string) => request<void>(`/api/services/${id}`, { method: 'DELETE' }),

  getSettings: () => request<{ adminEmail: string }>('/api/settings'),

  updateSettings: (adminEmail: string) =>
    request<{ adminEmail: string }>('/api/settings', { method: 'PUT', body: JSON.stringify({ adminEmail }) })
}
