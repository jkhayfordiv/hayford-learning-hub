import { getToken } from '../utils/auth';

// Use environment variable for API URL, fallback based on environment
const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3001' : 'https://hayford-learning-hub.onrender.com');

const getHeaders = () => {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
  };
};

export const fetchUserProgress = async () => {
  const response = await fetch(`${API_BASE_URL}/api/grammar/progress`, {
    headers: getHeaders(),
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch user progress');
  }
  
  return response.json();
};

export const fetchRegions = async () => {
  const response = await fetch(`${API_BASE_URL}/api/grammar/regions`, {
    headers: getHeaders(),
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch regions');
  }
  
  return response.json();
};

export const fetchRecommendation = async () => {
  const response = await fetch(`${API_BASE_URL}/api/grammar/recommendations`, {
    headers: getHeaders(),
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch recommendation');
  }
  
  return response.json();
};

export const fetchRegionNodes = async (regionName) => {
  const response = await fetch(`${API_BASE_URL}/api/grammar/regions/${regionName}`, {
    headers: getHeaders(),
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch region nodes');
  }
  
  return response.json();
};

export const fetchNode = async (nodeId) => {
  const response = await fetch(`${API_BASE_URL}/api/grammar/nodes/${nodeId}`, {
    headers: getHeaders(),
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch node');
  }
  
  return response.json();
};

export const submitMasteryCheck = async (nodeId, activityType, userResponse, masteryCheck) => {
  const response = await fetch(`${API_BASE_URL}/api/grammar/submit`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      node_id: nodeId,
      activity_type: activityType,
      user_response: userResponse,
      mastery_check: masteryCheck,
    }),
  });
  
  if (!response.ok) {
    throw new Error('Failed to submit mastery check');
  }
  
  return response.json();
};
export const fetchReviewQuestions = async () => {
  const response = await fetch(`${API_BASE_URL}/api/grammar/review-questions`, {
    headers: getHeaders(),
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch review questions');
  }
  
  return response.json();
};
