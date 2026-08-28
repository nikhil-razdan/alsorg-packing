import {
  api,
} from "./client";

const unwrapResponse = (
  response
) => {
  return (
    response?.data?.data ??
    response?.data ??
    {}
  );
};

export async function loginUser(
  payload
) {
  const res =
    await api.post(
      "/api/auth/login",
      payload,
      {
        /*
         * A login request must not carry an old/stale Bearer token.
         * The backend identifies this transport with X-Client-Type and returns
         * the new bearer token after validating username/password.
         */
        skipAuth: true,
        withCredentials: false,
        headers: {
          "X-Client-Type":
            "mobile",
        },
      }
    );

  return unwrapResponse(res);
}

export async function logoutUser() {
  try {
    await api.post(
      "/api/auth/logout"
    );
  } catch {
    /*
     * The local SecureStore session must still be
     * cleared when backend logout fails.
     */
  }
}

export async function fetchMe() {
  const res =
    await api.get(
      "/api/auth/me"
    );

  return unwrapResponse(res);
}
