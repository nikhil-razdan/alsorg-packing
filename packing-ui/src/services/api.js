import axios from "axios";
import { API_BASE_URL } from "../config";

/*
 * Capture the real browser fetch before the legacy compatibility bridge is
 * installed. secureFetch always uses this reference, so routing old raw-fetch
 * callers through the central security layer cannot recurse through the patch.
 */
const nativeFetch =
  typeof globalThis !== "undefined" &&
  typeof globalThis.fetch === "function"
    ? globalThis.fetch.bind(globalThis)
    : null;

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

/*
 * Browser authentication is intentionally HttpOnly-cookie based. Do not
 * automatically recover or attach bearer tokens from localStorage/sessionStorage.
 * ShipTrack/mobile uses its own Bearer-token client outside this browser module.
 */

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

/*
 * Incremented whenever the browser authentication boundary changes. Browser
 * authentication is cookie-only; feature code never needs to read a JWT, role,
 * username or other authentication material from Web Storage. In-memory caches
 * can include this epoch so a logout/login boundary cannot reuse a previous
 * session's cached business data in a long-lived SPA tab.
 */
let securitySessionEpoch = 0;

const bumpSecuritySessionEpoch = () => {
  securitySessionEpoch += 1;
};

export const getSecurityCacheNamespace = () =>
  `browser-session:${securitySessionEpoch}`;

const normalizeMethod = (
  value
) =>
  String(value || "GET")
    .trim()
    .toUpperCase();

const deleteHeader = (headers, name) => {
  if (!headers || !name) {
    return;
  }

  if (typeof headers.delete === "function") {
    headers.delete(name);
    return;
  }

  const target = String(name).toLowerCase();

  Object.keys(headers).forEach((key) => {
    if (
      String(key)
        .toLowerCase() === target
    ) {
      delete headers[key];
    }
  });
};

const isBadAuthorization = (value) => {
  const clean =
    String(value || "").trim();

  if (!clean) {
    return false;
  }

  return [
    "Bearer",
    "Bearer null",
    "Bearer undefined",
    "null",
    "undefined",
  ].includes(clean);
};

const sanitizeLegacyIdentityHeaders = (
  headers
) => {
  if (!headers) {
    return;
  }

  /*
   * Browser identity is established by the HttpOnly cookie. X-Username is
   * never an identity boundary, and malformed legacy bearer values must not
   * override an otherwise valid cookie-authenticated request. A deliberately
   * supplied valid Authorization header is preserved for specialized clients.
   */
  deleteHeader(
    headers,
    "X-Username"
  );

  const authorization =
    typeof headers.get === "function"
      ? headers.get("Authorization")
      : headers.Authorization ||
        headers.authorization;

  if (
    isBadAuthorization(
      authorization
    )
  ) {
    deleteHeader(
      headers,
      "Authorization"
    );

    deleteHeader(
      headers,
      "authorization"
    );
  }
};

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

const normalizeAxiosApiPath = (
  value
) => {
  const raw =
    String(value || "")
      .trim();

  if (
    !raw ||
    /^https?:\/\//i.test(raw)
  ) {
    return raw;
  }

  /*
   * The shared Axios base URL already ends in /api.
   * Accept legacy callers that still pass /api/... without producing /api/api/....
   */
  if (raw === "/api") {
    return "/";
  }

  if (
    raw.startsWith(
      "/api/"
    )
  ) {
    return raw.slice(4);
  }

  return raw;
};

const backendRootUrl =
  apiBaseUrl.replace(
    /\/api\/?$/i,
    ""
  );

const resolveSecureFetchUrl = (
  input
) => {
  const raw =
    typeof input === "string"
      ? input.trim()
      : String(
          input?.url || ""
        ).trim();

  if (!raw) {
    throw new Error(
      "API request URL is missing"
    );
  }

  if (
    /^https?:\/\//i.test(raw)
  ) {
    return raw;
  }

  if (raw === "/api") {
    return `${backendRootUrl}/api`;
  }

  if (
    raw.startsWith(
      "/api/"
    )
  ) {
    return `${backendRootUrl}${raw}`;
  }

  if (
    raw.startsWith("/")
  ) {
    return `${apiBaseUrl}${raw}`;
  }

  return `${apiBaseUrl}/${raw}`;
};

const getBackendOrigin = () => {
  try {
    return new URL(
      apiBaseUrl,
      typeof window !== "undefined"
        ? window.location.origin
        : "http://localhost"
    ).origin;
  } catch {
    return "";
  }
};

export const isFlowSuiteApiRequest = (
  input
) => {
  const raw =
    typeof input === "string"
      ? input.trim()
      : String(
          input?.url || ""
        ).trim();

  if (!raw) {
    return false;
  }

  if (
    raw === "/api" ||
    raw.startsWith(
      "/api/"
    )
  ) {
    return true;
  }

  try {
    const origin =
      typeof window !==
      "undefined"
        ? window.location.origin
        : "http://localhost";

    const target =
      new URL(
        raw,
        origin
      );

    const apiBase =
      new URL(
        apiBaseUrl,
        origin
      );

    const apiPath =
      apiBase.pathname
        .replace(
          /\/+$/,
          ""
        ) ||
      "/api";

    return (
      target.origin ===
        apiBase.origin &&
      (
        target.pathname ===
          apiPath ||
        target.pathname.startsWith(
          `${apiPath}/`
        )
      )
    );
  } catch {
    return false;
  }
};

const isBackendUrl = (
  value
) => {
  try {
    const target =
      new URL(
        value,
        typeof window !==
          "undefined"
          ? window.location.origin
          : "http://localhost"
      );

    return (
      target.origin ===
      getBackendOrigin()
    );
  } catch {
    return false;
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
    path ===
      "/auth/login" ||
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
    path ===
      CSRF_ENDPOINT ||
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
    SAFE_METHODS.has(
      method
    )
  ) {
    return false;
  }

  /*
   * Login is intentionally excluded on the backend too.
   * Exact-origin protection still applies to browser login.
   */
  if (
    isLoginRequest(
      config
    )
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
};

const loadCsrfToken = async (
  force = false
) => {
  /*
   * A forced refresh invalidates only the cached token. Never discard an
   * in-flight refresh promise: concurrent 403 responses must converge on the
   * same /auth/csrf request, otherwise multiple token-generation responses can
   * race their Set-Cookie headers and make an otherwise-correct retry stale.
   */
  if (force) {
    resetCsrfToken();
  }

  if (csrfLoadPromise) {
    return csrfLoadPromise;
  }

  if (csrfToken) {
    return {
      token:
        csrfToken,

      headerName:
        csrfHeaderName,
    };
  }

  csrfLoadPromise =
    csrfClient
      .get(
        CSRF_ENDPOINT,
        {
          headers: {
            "X-Request-ID":
              createRequestId(),
          },
        }
      )
      .then(
        (response) => {
          const token =
            String(
              response?.data
                ?.token ||
              ""
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
        }
      )
      .finally(() => {
        csrfLoadPromise =
          null;
      });

  return csrfLoadPromise;
};

const readCsrfErrorCode = async (
  response
) => {
  if (!response) {
    return "";
  }

  const contentType =
    String(
      response.headers?.get(
        "content-type"
      ) || ""
    ).toLowerCase();

  if (
    !contentType.includes(
      "application/json"
    )
  ) {
    return "";
  }

  try {
    const payload =
      await response
        .clone()
        .json();

    return String(
      payload?.code || ""
    )
      .trim()
      .toUpperCase();
  } catch {
    return "";
  }
};

const dispatchSecurityEvent = (
  eventName,
  response,
  url
) => {
  if (
    typeof window ===
    "undefined"
  ) {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(
      eventName,
      {
        detail: {
          status:
            response?.status,

          url:
            String(
              url || ""
            ),

          requestId:
            response
              ?.headers
              ?.get(
                "X-Request-ID"
              ) ||
            response
              ?.headers
              ?.get(
                "x-request-id"
              ) ||
            "",
        },
      }
    )
  );
};

const performSecureFetch = async (
  input,
  init = {},
  alreadyRetriedCsrf = false
) => {
  const url =
    resolveSecureFetchUrl(
      input
    );

  const backendRequest =
    isBackendUrl(
      url
    );

  const requestInput =
    typeof Request !==
      "undefined" &&
    input instanceof Request
      ? input
      : null;

  const method =
    normalizeMethod(
      init?.method ||
      requestInput?.method
    );

  const headers =
    new Headers(
      requestInput?.headers ||
      {}
    );

  if (init?.headers) {
    new Headers(
      init.headers
    ).forEach(
      (
        value,
        name
      ) => {
        headers.set(
          name,
          value
        );
      }
    );
  }

  if (backendRequest) {
    sanitizeLegacyIdentityHeaders(
      headers
    );

    if (
      !headers.has(
        "X-Request-ID"
      )
    ) {
      headers.set(
        "X-Request-ID",
        createRequestId()
      );
    }

    const requestConfig = {
      method,
      url,
    };

    if (
      shouldAttachCsrf(
        requestConfig
      )
    ) {
      const csrf =
        await loadCsrfToken();

      headers.set(
        csrf.headerName,
        csrf.token
      );
    }
  } else {
    /*
     * Never leak FlowSuite bearer/CSRF/request headers to an external
     * object-storage or third-party URL.
     */
    headers.delete(
      "Authorization"
    );

    headers.delete(
      CSRF_HEADER
    );

    headers.delete(
      "X-Request-ID"
    );
  }

  if (!nativeFetch) {
    throw new Error(
      "Browser fetch is unavailable"
    );
  }

  const credentials =
    backendRequest
      ? "include"
      : (
          init?.credentials ||
          requestInput?.credentials ||
          "omit"
        );

  const requestInit = {
    ...init,
    method,
    headers,
    credentials,
  };

  /*
   * Keep a replayable clone for the one-time CSRF retry when a legacy caller
   * supplied a Request object instead of the usual URL + init form.
   */
  const retryRequestInput =
    requestInput
      ? requestInput.clone()
      : null;

  const response =
    requestInput
      ? await nativeFetch(
          new Request(
            requestInput,
            requestInit
          )
        )
      : await nativeFetch(
          url,
          requestInit
        );

  if (!backendRequest) {
    return response;
  }

  const path =
    normalizeRequestPath(
      url
    );

  if (
    response.ok &&
    (
      path.endsWith(
        "/api/auth/login"
      ) ||
      path.endsWith(
        "/api/auth/logout"
      )
    )
  ) {
    resetCsrfToken();

    bumpSecuritySessionEpoch();
  }

  if (
    response.status === 403 &&
    !alreadyRetriedCsrf
  ) {
    const errorCode =
      await readCsrfErrorCode(
        response
      );

    if (
      errorCode ===
      "CSRF_INVALID"
    ) {
      const csrf =
        await loadCsrfToken(
          true
        );

      const retryHeaders =
        new Headers(
          headers
        );

      retryHeaders.set(
        csrf.headerName,
        csrf.token
      );

      return performSecureFetch(
        retryRequestInput ||
          url,
        {
          ...init,
          method,
          headers:
            retryHeaders,
        },
        true
      );
    }
  }

  if (
    response.status === 401 &&
    !path.endsWith(
      "/api/auth/login"
    )
  ) {
    bumpSecuritySessionEpoch();

    dispatchSecurityEvent(
      "app:unauthorized",
      response,
      url
    );
  }

  if (
    response.status === 403
  ) {
    dispatchSecurityEvent(
      "app:forbidden",
      response,
      url
    );
  }

  return response;
};

/*
 * Compatibility bridge for legacy PackFlow modules that still expect the
 * native Fetch Response API (res.ok, res.json(), res.blob(), headers.get()).
 * All authentication, CSRF, request-id and 401/403 handling still flows through
 * the same central security state as Axios.
 */
export const secureFetch = (
  input,
  init = {}
) =>
  performSecureFetch(
    input,
    init,
    false
  );

/*
 * Credential-free transport for deliberately public token/PIN gateways such
 * as HRFlow candidate/onboarding links and AssetFlow Reporter Pass.
 *
 * This deliberately uses the native fetch captured before the global legacy
 * fetch bridge was installed. It never sends the FlowSuite HttpOnly session
 * cookie, bearer identity headers or CSRF token. Backend public endpoints must
 * still enforce their own token/PIN controls and TrustedOriginFilter continues
 * to reject unsafe browser requests from unapproved origins.
 */
export const publicApiFetch = async (
  input,
  init = {}
) => {
  if (!nativeFetch) {
    throw new Error(
      "Browser fetch is unavailable"
    );
  }

  const url =
    resolveSecureFetchUrl(
      input
    );

  if (
    !isBackendUrl(
      url
    ) ||
    !isFlowSuiteApiRequest(
      url
    )
  ) {
    throw new Error(
      "Public API transport only supports FlowSuite /api endpoints"
    );
  }

  const requestInput =
    typeof Request !==
      "undefined" &&
    input instanceof Request
      ? input
      : null;

  const headers =
    new Headers(
      requestInput?.headers ||
      {}
    );

  if (init?.headers) {
    new Headers(
      init.headers
    ).forEach(
      (
        value,
        name
      ) => {
        headers.set(
          name,
          value
        );
      }
    );
  }

  deleteHeader(
    headers,
    "Authorization"
  );

  deleteHeader(
    headers,
    "authorization"
  );

  deleteHeader(
    headers,
    "X-Username"
  );

  deleteHeader(
    headers,
    CSRF_HEADER
  );

  if (csrfHeaderName) {
    deleteHeader(
      headers,
      csrfHeaderName
    );
  }

  if (
    !headers.has(
      "X-Request-ID"
    )
  ) {
    headers.set(
      "X-Request-ID",
      createRequestId()
    );
  }

  const method =
    normalizeMethod(
      init?.method ||
      requestInput?.method
    );

  const requestInit = {
    ...init,

    method,

    headers,

    credentials:
      "omit",

    cache:
      init?.cache ||
      "no-store",
  };

  return requestInput
    ? nativeFetch(
        new Request(
          requestInput,
          requestInit
        )
      )
    : nativeFetch(
        url,
        requestInit
      );
};

API.interceptors.request.use(
  async (config) => {
    config.url =
      normalizeAxiosApiPath(
        config.url
      );

    config.withCredentials =
      true;

    config.headers =
      config.headers ||
      {};

    sanitizeLegacyIdentityHeaders(
      config.headers
    );

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
    Promise.reject(
      error
    )
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

      bumpSecuritySessionEpoch();
    }

    return response;
  },

  async (error) => {
    const status =
      error?.response
        ?.status;

    const requestUrl =
      String(
        error?.config?.url ||
        ""
      );

    const errorCode =
      String(
        error?.response
          ?.data?.code ||
        ""
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
      bumpSecuritySessionEpoch();

      if (
        typeof window !==
        "undefined"
      ) {
        window.dispatchEvent(
          new CustomEvent(
            "app:unauthorized",
            {
              detail: {
                status,

                url:
                  requestUrl,

                requestId:
                  error?.response
                    ?.headers?.[
                      "x-request-id"
                    ] ||
                  "",
              },
            }
          )
        );
      }
    }

    if (
      status === 403 &&
      typeof window !==
        "undefined"
    ) {
      window.dispatchEvent(
        new CustomEvent(
          "app:forbidden",
          {
            detail: {
              status,

              url:
                requestUrl,

              requestId:
                error?.response
                  ?.headers?.[
                    "x-request-id"
                  ] ||
                "",
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

/*
 * Explicit CSRF refresh entry point.
 *
 * AuthContext uses this before logout so POST /auth/logout is submitted with
 * a newly synchronized CSRF cookie/header pair rather than depending on a
 * potentially stale token from an older browser session state.
 */
export const refreshCsrfToken =
  () =>
    loadCsrfToken(
      true
    );

/*
 * Clears only the browser-side in-memory CSRF cache.
 *
 * It does not alter the backend cookie. The next unsafe request automatically
 * obtains a fresh token through /auth/csrf.
 */
export const clearCsrfToken =
  resetCsrfToken;

export default API;