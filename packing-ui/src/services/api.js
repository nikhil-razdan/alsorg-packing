import axios from "axios";
import { API_BASE_URL } from "../config";

const normalizeApiBaseUrl = () => {
  const configuredUrl = String(
    API_BASE_URL || ""
  )
    .trim()
    .replace(/\/+$/, "");

  if (!configuredUrl) {
    return "/api";
  }

  if (
    configuredUrl
      .toLowerCase()
      .endsWith("/api")
  ) {
    return configuredUrl;
  }

  return `${configuredUrl}/api`;
};

const API = axios.create({
  baseURL: normalizeApiBaseUrl(),
  withCredentials: true,
  timeout: 60000,
});

const getValidToken = () => {
  const token =
    localStorage.getItem(
      "token"
    ) ||
    localStorage.getItem(
      "jwt"
    ) ||
    localStorage.getItem(
      "accessToken"
    );

  if (
    !token ||
    token === "null" ||
    token === "undefined" ||
    token.trim() === ""
  ) {
    return "";
  }

  return token.trim();
};

API.interceptors.request.use(
  (config) => {
    config.withCredentials = true;
    config.headers =
      config.headers || {};

    const token = getValidToken();

    if (token) {
      config.headers.Authorization =
        /^Bearer\s+/i.test(token)
          ? token
          : `Bearer ${token}`;
    } else if (
      typeof config.headers.delete ===
      "function"
    ) {
      config.headers.delete(
        "Authorization"
      );
    } else {
      delete config.headers.Authorization;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

API.interceptors.response.use(
  (response) => response,
  (error) => {
    const status =
      error?.response?.status;

    const requestUrl =
      String(
        error?.config?.url || ""
      );

    if (
      status === 401 &&
      !requestUrl.includes("/auth/login")
    ) {
      window.dispatchEvent(
        new CustomEvent(
          "app:unauthorized",
          {
            detail: {
              status,
              url: requestUrl,
            },
          }
        )
      );
    }

    if (status === 403) {
      window.dispatchEvent(
        new CustomEvent(
          "app:forbidden",
          {
            detail: {
              status,
              url: requestUrl,
            },
          }
        )
      );
    }

    return Promise.reject(error);
  }
);

export default API;