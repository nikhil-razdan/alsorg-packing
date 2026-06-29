import { api } from "./client";

export async function loginUser(payload) {
  const res = await api.post(
    "/api/auth/login",
    payload,
    {
      headers: {
        "X-Client-Type": "mobile",
      },
    }
  );

  return res.data;
}

export async function logoutUser() {
  try {
    await api.post("/api/auth/logout");
  } catch (e) {
    // Mobile logout should still clear SecureStore locally
  }
}

export async function fetchMe() {
  const res = await api.get("/api/auth/me");
  return res.data;
}