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

const apiBaseUrl =
  normalizeApiBaseUrl();

const API = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true,
  timeout: 60000,
});

const csrfClient = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true,
  timeout: 15000,
});

const SAFE_METHODS =
  new Set([
    "GET",
    "HEAD",
    "OPTIONS",
    "TRACE",
  ]);

const CSRF_ENDPOINT =
  "/auth/csrf";

const CSRF_HEADER =
  "X-XSRF-TOKEN";

let csrfToken = "";
let csrfHeaderName =
  CSRF_HEADER;
let csrfLoadPromise = null;

const getValidToken = () => {
  const token =
    localStorage.getItem(
      "token"
    ) ||
    localStorage.getItem(
      "authToken"
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

const normalizeMethod = (
  value
) =>
  String(value || "GET")
    .trim()
    .toUpperCase();

const normalizeRequestPath = (
  value
) => {
  const raw =
    String(value || "")
      .trim();

  if (!raw) {
    return "";
  }

  try {
    const url =
      new URL(
        raw,
        typeof window !==
          "undefined"
          ? window.location.origin
          : "http://localhost"
      );

    return url.pathname;
  } catch {
    return raw
      .split("?")[0]
      .split("#")[0];
  }
};

const isLoginRequest = (
  config
) => {
  const path =
    normalizeRequestPath(
      config?.url
    );

  return (
    path === "/auth/login" ||
    path.endsWith(
      "/api/auth/login"
    )
  );
};

const isCsrfRequest = (
  config
) => {
  const path =
    normalizeRequestPath(
      config?.url
    );

  return (
    path === CSRF_ENDPOINT ||
    path.endsWith(
      "/api/auth/csrf"
    )
  );
};

const shouldAttachCsrf = (
  config
) => {
  const method =
    normalizeMethod(
      config?.method
    );

  if (
    SAFE_METHODS.has(method)
  ) {
    return false;
  }

  /*
   * Login is intentionally excluded on the backend too.
   * Exact-origin protection still applies to browser login.
   */
  if (
    isLoginRequest(config)
  ) {
    return false;
  }

  return !isCsrfRequest(
    config
  );
};

const setHeader = (
  headers,
  name,
  value
) => {
  if (
    !headers ||
    !name
  ) {
    return;
  }

  if (
    typeof headers.set ===
    "function"
  ) {
    headers.set(
      name,
      value
    );
    return;
  }

  headers[name] =
    value;
};

const deleteHeader = (
  headers,
  name
) => {
  if (
    !headers ||
    !name
  ) {
    return;
  }

  if (
    typeof headers.delete ===
    "function"
  ) {
    headers.delete(name);
    return;
  }

  delete headers[name];
};

const createRequestId = () => {
  try {
    if (
      typeof crypto !==
        "undefined" &&
      typeof crypto.randomUUID ===
        "function"
    ) {
      return crypto.randomUUID();
    }
  } catch {
    /*
     * Fall through to a safe non-secret id.
     */
  }

  return `web-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 14)}`;
};

const resetCsrfToken = () => {
  csrfToken = "";
  csrfHeaderName =
    CSRF_HEADER;
  csrfLoadPromise = null;
};

const loadCsrfToken = async (
  force = false
) => {
  if (
    csrfToken &&
    !force
  ) {
    return {
      token: csrfToken,
      headerName:
        csrfHeaderName,
    };
  }

  if (
    csrfLoadPromise &&
    !force
  ) {
    return csrfLoadPromise;
  }

  csrfLoadPromise =
    csrfClient
      .get(CSRF_ENDPOINT, {
        headers: {
          "X-Request-ID":
            createRequestId(),
        },
      })
      .then((response) => {
        const token =
          String(
            response?.data
              ?.token || ""
          ).trim();

        const headerName =
          String(
            response?.data
              ?.headerName ||
              CSRF_HEADER
          ).trim();

        if (!token) {
          throw new Error(
            "CSRF token was not returned by the server"
          );
        }

        csrfToken =
          token;

        csrfHeaderName =
          headerName ||
          CSRF_HEADER;

        return {
          token:
            csrfToken,
          headerName:
            csrfHeaderName,
        };
      })
      .finally(() => {
        csrfLoadPromise =
          null;
      });

  return csrfLoadPromise;
};

API.interceptors.request.use(
  async (config) => {
    config.withCredentials =
      true;

    config.headers =
      config.headers || {};

    /*
     * A browser-generated correlation id lets the same request be found in
     * frontend error reports and backend Render logs.
     */
    if (
      !config.headers[
        "X-Request-ID"
      ] &&
      !config.headers[
        "x-request-id"
      ]
    ) {
      setHeader(
        config.headers,
        "X-Request-ID",
        createRequestId()
      );
    }

    const token =
      getValidToken();

    if (token) {
      setHeader(
        config.headers,
        "Authorization",
        /^Bearer\s+/i.test(
          token
        )
          ? token
          : `Bearer ${token}`
      );
    } else {
      deleteHeader(
        config.headers,
        "Authorization"
      );
    }

    if (
      shouldAttachCsrf(
        config
      )
    ) {
      const csrf =
        await loadCsrfToken();

      setHeader(
        config.headers,
        csrf.headerName,
        csrf.token
      );
    }

    return config;
  },
  (error) =>
    Promise.reject(error)
);

API.interceptors.response.use(
  (response) => {
    const requestUrl =
      String(
        response?.config
          ?.url || ""
      );

    /*
     * After login, do not reuse a token that may have been obtained before
     * the authenticated cookie existed. The next unsafe request gets a fresh
     * token automatically.
     */
    if (
      requestUrl.includes(
        "/auth/login"
      ) ||
      requestUrl.includes(
        "/auth/logout"
      )
    ) {
      resetCsrfToken();
    }

    return response;
  },
  async (error) => {
    const status =
      error?.response?.status;

    const requestUrl =
      String(
        error?.config?.url ||
        ""
      );

    const errorCode =
      String(
        error?.response?.data
          ?.code || ""
      )
        .trim()
        .toUpperCase();

    /*
     * A stale/missing CSRF token can happen after a long-lived tab, cookie
     * rotation or login/logout transition. Refresh exactly once and retry the
     * original request instead of making the user repeat the action manually.
     */
    if (
      status === 403 &&
      errorCode ===
        "CSRF_INVALID" &&
      error?.config &&
      error.config
        .__flowsuiteCsrfRetry !==
        true
    ) {
      error.config
        .__flowsuiteCsrfRetry =
        true;

      resetCsrfToken();

      const csrf =
        await loadCsrfToken(
          true
        );

      error.config.headers =
        error.config.headers ||
        {};

      setHeader(
        error.config.headers,
        csrf.headerName,
        csrf.token
      );

      return API.request(
        error.config
      );
    }

    if (
      status === 401 &&
      !requestUrl.includes(
        "/auth/login"
      )
    ) {
      window.dispatchEvent(
        new CustomEvent(
          "app:unauthorized",
          {
            detail: {
              status,
              url: requestUrl,
              requestId:
                error?.response
                  ?.headers?.[
                  "x-request-id"
                ] || "",
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
              requestId:
                error?.response
                  ?.headers?.[
                  "x-request-id"
                ] || "",
            },
          }
        )
      );
    }

    return Promise.reject(
      error
    );
  }
);

export const refreshCsrfToken =
  () =>
    loadCsrfToken(true);

export const clearCsrfToken =
  resetCsrfToken;

export default API;
