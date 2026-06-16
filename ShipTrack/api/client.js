import axios from "axios";
import * as SecureStore from "expo-secure-store";

export const API_BASE_URL =
  "https://alsorg-packing-backend.onrender.com";

export async function getStoredToken() {
  const possibleKeys = [
    "token",
    "authToken",
    "accessToken",
    "jwt",
  ];

  for (const key of possibleKeys) {
    const value =
      await SecureStore.getItemAsync(key);

    if (
      value &&
      String(value).trim() &&
      String(value).trim() !== "null" &&
      String(value).trim() !== "undefined"
    ) {
      return String(value).trim();
    }
  }

  return "";
}

export function buildBearerToken(token) {
  const clean =
    String(token || "").trim();

  if (!clean) {
    return "";
  }

  return clean.startsWith("Bearer ")
    ? clean
    : `Bearer ${clean}`;
}

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

api.interceptors.request.use(async (config) => {
  const token =
    await getStoredToken();

  const bearer =
    buildBearerToken(token);

  if (bearer) {
    config.headers.Authorization =
      bearer;
  }

  return config;
});

export function getBackendMessage(
  error,
  fallback = "Something went wrong"
) {
  return (
    error?.response?.data?.message ||
    error?.response?.data ||
    error?.message ||
    fallback
  );
}