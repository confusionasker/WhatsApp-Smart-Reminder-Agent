import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 globally
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// Auth
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  profile: () => api.get('/auth/profile'),
  updateProfile: (data) => api.put('/auth/profile', data),
};

// Contacts
export const contactsAPI = {
  list: (params) => api.get('/contacts', { params }),
  get: (id) => api.get(`/contacts/${id}`),
  create: (data) => api.post('/contacts', data),
  update: (id, data) => api.put(`/contacts/${id}`, data),
  delete: (id) => api.delete(`/contacts/${id}`),
};

// Reminders
export const remindersAPI = {
  list: (params) => api.get('/reminders', { params }),
  get: (id) => api.get(`/reminders/${id}`),
  create: (data) => api.post('/reminders', data),
  update: (id, data) => api.put(`/reminders/${id}`, data),
  delete: (id) => api.delete(`/reminders/${id}`),
  cancel: (id) => api.post(`/reminders/${id}/cancel`),
  retry: (id, data) => api.post(`/reminders/${id}/retry`, data || {}),
  timezones: () => api.get('/reminders/timezones'),
};

// Dashboard
export const dashboardAPI = {
  stats: () => api.get('/dashboard/stats'),
  recentActivity: () => api.get('/dashboard/recent-activity'),
  upcoming: () => api.get('/dashboard/upcoming'),
};

// WhatsApp
export const whatsappAPI = {
  test: (data) => api.post('/whatsapp/test', data),
  status: () => api.get('/whatsapp/status'),
  qr: () => api.get('/whatsapp/qr'),
  refreshQr: () => api.post('/whatsapp/refresh-qr'),
  reset: () => api.post('/whatsapp/reset'),
  pairingCode: (data) => api.post('/whatsapp/pairing-code', data),
  logout: () => api.post('/whatsapp/logout'),
};

// AI
export const aiAPI = {
  parseReminder: (text) => api.post('/ai/parse-reminder', { text }),
  status: () => api.get('/ai/status'),
};

export default api;

