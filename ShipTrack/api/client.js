import axios from "axios";
import * as SecureStore from "expo-secure-store";

export const API_BASE_URL =
  "https://alsorg-packing-backend.onrender.com";

export const TOKEN_KEY =
  "shiptrack_access_token";

export const ROLE_KEY =
  "shiptrack_role";

export const ROLES_KEY =
  "shiptrack_roles";

export const USERNAME_KEY =
  "shiptrack_username";

const normalizeRole = (
  value
) => {
  return String(value || "")
    .replace(/^ROLE_/i, "")
    .trim()
    .toUpperCase();
};

const normalizeRoles = (
  values
) => {
  const source =
    Array.isArray(values)
      ? values
      : values
        ? [values]
        : [];

  return Array.from(
    new Set(
      source
        .map(normalizeRole)
        .filter(Boolean)
    )
  );
};

export async function getStoredToken() {
  const possibleKeys = [
    TOKEN_KEY,

    /*
     * Legacy keys retained temporarily so existing
     * installed mobile applications keep working.
     */
    "token",
    "authToken",
    "accessToken",
    "jwt",
  ];

  for (const key of possibleKeys) {
    try {
      const value =
        await SecureStore.getItemAsync(
          key
        );

      const clean =
        String(value || "").trim();

      if (
        clean &&
        clean !== "null" &&
        clean !== "undefined"
      ) {
        return clean;
      }
    } catch {
      /* Continue checking compatibility keys. */
    }
  }

  return "";
}

export async function getStoredRole() {
  try {
    const stored =
      (
        await SecureStore.getItemAsync(
          ROLE_KEY
        )
      ) ||
      (
        await SecureStore.getItemAsync(
          "role"
        )
      ) ||
      "";

    return normalizeRole(stored);
  } catch {
    return "";
  }
}

export async function getStoredRoles() {
  const possibleKeys = [
    ROLES_KEY,
    "roles",
    "userRoles",
  ];

  for (const key of possibleKeys) {
    try {
      const raw =
        await SecureStore.getItemAsync(
          key
        );

      if (!raw) {
        continue;
      }

      try {
        const parsed =
          JSON.parse(raw);

        if (Array.isArray(parsed)) {
          return normalizeRoles(
            parsed
          );
        }
      } catch {
        const commaSeparated =
          String(raw)
            .split(",")
            .map((value) =>
              value.trim()
            )
            .filter(Boolean);

        if (
          commaSeparated.length > 0
        ) {
          return normalizeRoles(
            commaSeparated
          );
        }
      }
    } catch {
      /* Continue checking compatibility keys. */
    }
  }

  const legacyRole =
    await getStoredRole();

  return legacyRole
    ? [legacyRole]
    : [];
}

export async function getStoredUsername() {
  try {
    return (
      (
        await SecureStore.getItemAsync(
          USERNAME_KEY
        )
      ) ||
      (
        await SecureStore.getItemAsync(
          "username"
        )
      ) ||
      ""
    );
  } catch {
    return "";
  }
}

export async function saveStoredAuth({
  token,
  role,
  roles = [],
  username,
}) {
  const cleanToken =
    String(token || "").trim();

  if (!cleanToken) {
    throw new Error(
      "Login token missing from backend mobile login response"
    );
  }

  const cleanRoles =
    normalizeRoles([
      ...(
        Array.isArray(roles)
          ? roles
          : []
      ),
      role,
    ]);

  const requestedPrimaryRole =
    normalizeRole(role);

  const primaryRole =
    requestedPrimaryRole &&
      cleanRoles.includes(
        requestedPrimaryRole
      )
      ? requestedPrimaryRole
      : cleanRoles[0] || "";

  if (!primaryRole) {
    throw new Error(
      "Login role missing from backend mobile login response"
    );
  }

  const cleanUsername =
    String(username || "").trim();

  await Promise.all([
    SecureStore.setItemAsync(
      TOKEN_KEY,
      cleanToken
    ),

    SecureStore.setItemAsync(
      ROLE_KEY,
      primaryRole
    ),

    SecureStore.setItemAsync(
      ROLES_KEY,
      JSON.stringify(
        cleanRoles
      )
    ),

    SecureStore.setItemAsync(
      USERNAME_KEY,
      cleanUsername
    ),

    /*
     * Retain the old token key temporarily because some
     * FileSystem/background code may still read it.
     */
    SecureStore.setItemAsync(
      "token",
      cleanToken
    ),
  ]);
}

export async function clearStoredAuth() {
  const keys = [
    TOKEN_KEY,
    ROLE_KEY,
    ROLES_KEY,
    USERNAME_KEY,
    "token",
    "authToken",
    "accessToken",
    "jwt",
    "role",
    "roles",
    "userRoles",
    "username",
  ];

  await Promise.all(
    keys.map((key) =>
      SecureStore
        .deleteItemAsync(key)
        .catch(() => {
          /* Continue clearing remaining keys. */
        })
    )
  );
}

export function buildBearerToken(
  token
) {
  const clean =
    String(token || "").trim();

  if (!clean) {
    return "";
  }

  return /^Bearer\s+/i.test(clean)
    ? clean
    : `Bearer ${clean}`;
}

/*
 * ShipTrack is a native bearer client, not the FlowSuite browser client.
 * Never opt this Axios instance into browser cookie authentication.
 */
export const api =
  axios.create({
    baseURL:
      API_BASE_URL,

    timeout:
      30000,

    withCredentials:
      false,

    headers: {
      Accept:
        "application/json",

      "X-Client-Type":
        "mobile",
    },
  });

let authInvalidatedHandler = null;

export function setAuthInvalidatedHandler(handler) {
  authInvalidatedHandler =
    typeof handler === "function"
      ? handler
      : null;

  return () => {
    if (authInvalidatedHandler === handler) {
      authInvalidatedHandler = null;
    }
  };
}

api.interceptors.request.use(
  async (config) => {
    const skipAuth =
      config?.skipAuth === true;

    const token =
      skipAuth
        ? ""
        : await getStoredToken();

    const bearer =
      buildBearerToken(token);

    config.withCredentials =
      false;

    config.headers =
      config.headers || {};

    if (
      typeof config.headers.set ===
      "function"
    ) {
      config.headers.set(
        "X-Client-Type",
        "mobile"
      );

      if (
        !skipAuth &&
        bearer
      ) {
        config.headers.set(
          "Authorization",
          bearer
        );
      } else {
        config.headers.delete?.(
          "Authorization"
        );
      }
    } else {
      config.headers[
        "X-Client-Type"
      ] = "mobile";

      if (
        !skipAuth &&
        bearer
      ) {
        config.headers.Authorization =
          bearer;
      } else {
        delete config.headers
          .Authorization;
      }
    }

    return config;
  },
  (error) =>
    Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status =
      error?.response?.status;

    const skippedAuth =
      error?.config?.skipAuth === true;

    if (status === 401 && !skippedAuth) {
      await clearStoredAuth();

      try {
        authInvalidatedHandler?.();
      } catch {
        /* UI invalidation is best-effort; local credentials are already cleared. */
      }
    }

    return Promise.reject(error);
  }
);

export function getBackendMessage(
  error,
  fallback = "Something went wrong"
) {
  const data =
    error?.response?.data;

  if (
    typeof data === "string" &&
    data.trim()
  ) {
    return data;
  }

  if (
    data?.message &&
    typeof data.message ===
    "string"
  ) {
    return data.message;
  }

  if (
    data?.error &&
    typeof data.error ===
    "string"
  ) {
    return data.error;
  }

  if (
    error?.message &&
    typeof error.message ===
    "string"
  ) {
    return error.message;
  }

  return fallback;
}
