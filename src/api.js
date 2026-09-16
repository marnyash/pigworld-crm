import axios from "axios";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api/v1";
export const TOKEN_KEY = "pigyworld_access_token";
export const REFRESH_TOKEN_KEY = "pigyworld_refresh_token";
export const ROLE_KEY = "pigyworld_crm_role";
export const SESSION_KEY = "pigyworld_crm_session";

export const api = axios.create({ baseURL: API_BASE_URL });
let refreshing;

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(undefined, async (error) => {
  const request = error.config;
  if (error.response?.status !== 401 || request?.skipAuthRefresh || request?._authRetried) {
    return Promise.reject(error);
  }
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refreshToken) return Promise.reject(error);
  request._authRetried = true;
  try {
    refreshing ||= axios.post(`${API_BASE_URL}/auth/refresh`, { refresh_token: refreshToken });
    const response = await refreshing;
    refreshing = undefined;
    localStorage.setItem(TOKEN_KEY, response.data.access_token);
    localStorage.setItem(REFRESH_TOKEN_KEY, response.data.refresh_token);
    request.headers.Authorization = `Bearer ${response.data.access_token}`;
    return api(request);
  } catch (refreshError) {
    refreshing = undefined;
    clearSession();
    window.dispatchEvent(new Event("pigyworld-auth-expired"));
    return Promise.reject(refreshError);
  }
});

export function saveSession(response) {
  const user = response.data?.user || {};
  const farms = response.data?.farms?.data || response.data?.farms || [];
  const session = { user, farms };
  localStorage.setItem(TOKEN_KEY, response.data.access_token);
  localStorage.setItem(REFRESH_TOKEN_KEY, response.data.refresh_token || "");
  localStorage.setItem(ROLE_KEY, user.crm_role || (user.role === "farmOwner" ? "admin" : "customer_support"));
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export function saveProfile(response) {
  const session = {
    user: response.data?.user || {},
    farms: response.data?.farms?.data || response.data?.farms || [],
  };
  localStorage.setItem(ROLE_KEY, session.user.crm_role || (session.user.role === "farmOwner" ? "admin" : "customer_support"));
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(ROLE_KEY);
  localStorage.removeItem(SESSION_KEY);
}
