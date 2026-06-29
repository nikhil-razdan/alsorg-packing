import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

import {
  clearStoredAuth,
  getStoredRole,
  getStoredToken,
  getStoredUsername,
  saveStoredAuth,
} from "../api/client";

import {
  logoutUser,
} from "../api/authApi";

const AuthContext = createContext(null);

export function AuthProvider({
  children,
}) {
  const [token, setToken] =
    useState(null);

  const [role, setRole] =
    useState("");

  const [username, setUsername] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const storedToken =
        await getStoredToken();

      const storedRole =
        await getStoredRole();

      const storedUsername =
        await getStoredUsername();

      setToken(storedToken || null);
      setRole(storedRole || "");
      setUsername(storedUsername || "");
    } finally {
      setLoading(false);
    }
  };

  const saveAuth = async ({
    token,
    role,
    username,
  }) => {
    await saveStoredAuth({
      token,
      role,
      username,
    });

    setToken(token || null);
    setRole(role || "");
    setUsername(username || "");
  };

  const logout = async () => {
    try {
      await logoutUser();
    } catch (e) {
      // Ignore backend logout failure on mobile.
    }

    await clearStoredAuth();

    setToken(null);
    setRole("");
    setUsername("");
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        role,
        username,
        loading,
        saveAuth,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}