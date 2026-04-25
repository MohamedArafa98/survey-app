import axios from "axios";

export const api = axios.create({
  baseURL: "/api",
});

let token: string | null = null;

export const auth = {
  setToken(t: string | null) {
    token = t;
  },
  getToken() {
    return token;
  },
};

api.interceptors.request.use((config) => {
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401) {
      token = null;
      if (window.location.pathname.startsWith("/admin")) {
        window.location.replace("/admin/login");
      }
    }
    return Promise.reject(err);
  },
);
