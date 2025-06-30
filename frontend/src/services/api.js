import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for adding auth tokens if needed
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// Resume and ATS Scoring
export const resumeAPI = {
  upload: (formData) => api.post('/resume/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
};

// Interview Management
export const interviewAPI = {
  // No trigger or getTranscript needed for widget-only
};

// Candidate Management
export const candidateAPI = {
  getAll: () => api.get('/candidates'),
  getById: (id) => api.get(`/candidate/${id}`),
  calculateScore: (data) => api.post('/candidate/score', data),
};

// Email Scheduling
export const emailAPI = {
  scheduleInterview: (data) => api.post('/email/schedule', data),
};

// Dashboard Statistics
export const dashboardAPI = {
  getStats: () => api.get('/dashboard/stats'),
};

// Health Check
export const healthAPI = {
  check: () => api.get('/health'),
};

export const jobAPI = {
  create: (data) => api.post('/jobs', data),
  list: () => api.get('/jobs'),
  get: (id) => api.get(`/jobs/${id}`),
};

export default api; 