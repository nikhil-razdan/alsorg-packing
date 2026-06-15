import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

import * as SecureStore from "expo-secure-store";

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
        await SecureStore.getItemAsync("token");

      const storedRole =
        await SecureStore.getItemAsync("role");

      const storedUsername =
        await SecureStore.getItemAsync("username");

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
    await SecureStore.setItemAsync(
      "token",
      token || ""
    );

    await SecureStore.setItemAsync(
      "role",
      role || ""
    );

    await SecureStore.setItemAsync(
      "username",
      username || ""
    );

    setToken(token || null);
    setRole(role || "");
    setUsername(username || "");
  };

  const logout = async () => {
    await SecureStore.deleteItemAsync("token");
    await SecureStore.deleteItemAsync("role");
    await SecureStore.deleteItemAsync("username");

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