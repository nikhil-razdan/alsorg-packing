import { api } from "./client";

export async function loginUser(payload) {
  const res = await api.post(
    "/api/auth/login",
    payload
  );

  return res.data;
}