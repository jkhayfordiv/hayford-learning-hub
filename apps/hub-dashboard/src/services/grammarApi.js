const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const getHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : '',
  };
};

export const fetchCohortProgress = async () => {
  const response = await fetch(`${API_BASE_URL}/api/grammar/admin/cohort-progress`, {
    headers: getHeaders(),
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch cohort progress');
  }
  
  return response.json();
};

export const fetchHeatMap = async () => {
  const response = await fetch(`${API_BASE_URL}/api/grammar/admin/heat-map`, {
    headers: getHeaders(),
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch heat map data');
  }
  
  return response.json();
};

export const fetchRecentSubmissions = async () => {
  const response = await fetch(`${API_BASE_URL}/api/grammar/admin/recent-submissions`, {
    headers: getHeaders(),
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch recent submissions');
  }
  
  return response.json();
};
