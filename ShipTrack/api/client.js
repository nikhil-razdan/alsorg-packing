import axios from "axios";
import * as SecureStore from "expo-secure-store";

export const API_BASE_URL =
  "https://alsorg-packing-backend.onrender.com/";

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

api.interceptors.request.use(async (config) => {
  const token =
    await SecureStore.getItemAsync("token");

  if (token) {
    config.headers.Authorization =
      `Bearer ${token}`;
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