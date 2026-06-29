import axios from "axios";
import * as SecureStore from "expo-secure-store";

export const API_BASE_URL =
  "https://alsorg-packing-backend.onrender.com";

export const TOKEN_KEY =
  "shiptrack_access_token";

export const ROLE_KEY =
  "shiptrack_role";

export const USERNAME_KEY =
  "shiptrack_username";

export async function getStoredToken() {
  const possibleKeys = [
    TOKEN_KEY,

    /*
     * Legacy keys.
     * Keep these temporarily so old installed apps do not break.
     */
    "token",
    "authToken",
    "accessToken",
    "jwt",
  ];

  for (const key of possibleKeys) {
    const value =
      await SecureStore.getItemAsync(key);

    const clean =
      String(value || "").trim();

    if (
      clean &&
      clean !== "null" &&
      clean !== "undefined"
    ) {
      return clean;
    }
  }

  return "";
}

export async function saveStoredAuth({
  token,
  role,
  username,
}) {
  const cleanToken =
    String(token || "").trim();

  if (!cleanToken) {
    throw new Error(
      "Login token missing from backend mobile login response"
    );
  }

  await SecureStore.setItemAsync(
    TOKEN_KEY,
    cleanToken
  );

  /*
   * Also write legacy token key once.
   * This keeps your existing FileSystem/background code safe
   * while we clean everything gradually.
   */
  await SecureStore.setItemAsync(
    "token",
    cleanToken
  );

  await SecureStore.setItemAsync(
    ROLE_KEY,
    role || ""
  );

  await SecureStore.setItemAsync(
    USERNAME_KEY,
    username || ""
  );
}

export async function clearStoredAuth() {
  const keys = [
    TOKEN_KEY,
    ROLE_KEY,
    USERNAME_KEY,
    "token",
    "authToken",
    "accessToken",
    "jwt",
    "role",
    "username",
  ];

  await Promise.all(
    keys.map((key) =>
      SecureStore.deleteItemAsync(key).catch(() => {})
    )
  );
}

export async function getStoredRole() {
  return (
    (await SecureStore.getItemAsync(ROLE_KEY)) ||
    (await SecureStore.getItemAsync("role")) ||
    ""
  );
}

export async function getStoredUsername() {
  return (
    (await SecureStore.getItemAsync(USERNAME_KEY)) ||
    (await SecureStore.getItemAsync("username")) ||
    ""
  );
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

  config.headers =
    config.headers || {};

  config.headers["X-Client-Type"] =
    "mobile";

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
    error?.response?.data?.error ||
    error?.response?.data ||
    error?.message ||
    fallback
  );
}