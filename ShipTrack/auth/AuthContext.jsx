import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  clearStoredAuth,
  getStoredRole,
  getStoredRoles,
  getStoredToken,
  getStoredUsername,
  saveStoredAuth,
  setAuthInvalidatedHandler,
} from "../api/client";

import {
  fetchMe,
  logoutUser,
} from "../api/authApi";

const AuthContext =
  createContext(null);

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

export function AuthProvider({
  children,
}) {
  const [
    token,
    setToken,
  ] = useState(null);

  /*
   * Primary compatibility role.
   */
  const [
    role,
    setRole,
  ] = useState("");

  /*
   * Complete effective role list.
   */
  const [
    roles,
    setRoles,
  ] = useState([]);

  const [
    username,
    setUsername,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(true);

  const loadStoredAuth =
    useCallback(async () => {
      try {
        const [
          storedToken,
          storedRole,
          storedRoles,
          storedUsername,
        ] = await Promise.all([
          getStoredToken(),
          getStoredRole(),
          getStoredRoles(),
          getStoredUsername(),
        ]);

        const cleanStoredRoles =
          normalizeRoles([
            ...(Array.isArray(storedRoles)
              ? storedRoles
              : []),
            storedRole,
          ]);

        const preferredStoredRole =
          normalizeRole(storedRole);

        const storedPrimaryRole =
          preferredStoredRole &&
            cleanStoredRoles.includes(
              preferredStoredRole
            )
            ? preferredStoredRole
            : cleanStoredRoles[0] || "";

        if (!storedToken) {
          setToken(null);
          setRole("");
          setRoles([]);
          setUsername("");
          return;
        }

        /*
         * SecureStore is only a local cache. Reconcile it with /api/auth/me so
         * a disabled user, revoked/expired token, or backend role change cannot
         * keep stale mobile authority until the user manually logs out.
         *
         * A transient network outage keeps the locally stored session so the UI
         * can show the last known identity; the backend still authorizes every
         * API request. 401/403 or authenticated:false clears the session.
         */
        try {
          const me = await fetchMe();

          if (
            !me ||
            me?.authenticated === false ||
            me?.enabled === false
          ) {
            await clearStoredAuth();
            setToken(null);
            setRole("");
            setRoles([]);
            setUsername("");
            return;
          }

          const serverRoles =
            normalizeRoles([
              ...(Array.isArray(me?.roles)
                ? me.roles
                : []),
              me?.role,
            ]);

          const preferredServerRole =
            normalizeRole(me?.role);

          const serverPrimaryRole =
            preferredServerRole &&
              serverRoles.includes(
                preferredServerRole
              )
              ? preferredServerRole
              : serverRoles[0] || "";

          if (serverRoles.length === 0) {
            await clearStoredAuth();
            setToken(null);
            setRole("");
            setRoles([]);
            setUsername("");
            return;
          }

          const serverUsername =
            String(
              me?.username ||
              storedUsername ||
              ""
            ).trim();

          await saveStoredAuth({
            token: storedToken,
            role: serverPrimaryRole,
            roles: serverRoles,
            username: serverUsername,
          });

          setToken(storedToken);
          setRole(serverPrimaryRole);
          setRoles(serverRoles);
          setUsername(serverUsername);
          return;
        } catch (verificationError) {
          const status =
            verificationError?.response?.status;

          if (status === 401 || status === 403) {
            await clearStoredAuth();
            setToken(null);
            setRole("");
            setRoles([]);
            setUsername("");
            return;
          }

          /* Transient connection failure: preserve the last known local identity. */
          setToken(storedToken);
          setRole(storedPrimaryRole);
          setRoles(cleanStoredRoles);
          setUsername(storedUsername || "");
        }
      } catch (error) {
        console.error(
          "Unable to restore mobile authentication:",
          error
        );

        await clearStoredAuth();

        setToken(null);
        setRole("");
        setRoles([]);
        setUsername("");
      } finally {
        setLoading(false);
      }
    }, []);

  useEffect(() => {
    loadStoredAuth();
  }, [loadStoredAuth]);

  useEffect(() => {
    return setAuthInvalidatedHandler(() => {
      setToken(null);
      setRole("");
      setRoles([]);
      setUsername("");
    });
  }, []);

  const saveAuth =
    useCallback(
      async ({
        token: nextToken,
        role: nextRole,
        roles: nextRoles,
        username:
        nextUsername,
      }) => {
        const cleanRoles =
          normalizeRoles([
            ...(
              Array.isArray(
                nextRoles
              )
                ? nextRoles
                : []
            ),
            nextRole,
          ]);

        const preferredRole =
          normalizeRole(
            nextRole
          );

        const primaryRole =
          preferredRole &&
            cleanRoles.includes(
              preferredRole
            )
            ? preferredRole
            : cleanRoles[0] ||
            "";

        await saveStoredAuth({
          token:
            nextToken ||
            null,

          role:
            primaryRole,

          roles:
            cleanRoles,

          username:
            String(
              nextUsername ||
              ""
            ).trim(),
        });

        setToken(
          nextToken ||
          null
        );

        setRole(
          primaryRole
        );

        setRoles(
          cleanRoles
        );

        setUsername(
          String(
            nextUsername ||
            ""
          ).trim()
        );
      },
      []
    );

  const logout =
    useCallback(async () => {
      try {
        await logoutUser();
      } catch {
        /*
         * Local authentication must still be cleared
         * when backend logout is unavailable.
         */
      }

      await clearStoredAuth();

      setToken(null);
      setRole("");
      setRoles([]);
      setUsername("");
    }, []);

  const hasRole =
    useCallback(
      (requestedRole) => {
        const cleanRole =
          normalizeRole(
            requestedRole
          );

        if (!cleanRole) {
          return false;
        }

        return roles.includes(
          cleanRole
        );
      },
      [roles]
    );

  const hasAnyRole =
    useCallback(
      (...requestedRoles) => {
        return requestedRoles
          .flat()
          .some(
            (requestedRole) =>
              hasRole(
                requestedRole
              )
          );
      },
      [hasRole]
    );

  const value =
    useMemo(
      () => ({
        token,

        /*
         * Primary legacy role.
         */
        role,

        /*
         * Full effective role list.
         */
        roles,

        username,
        loading,

        isLoggedIn:
          Boolean(token),

        hasRole,
        hasAnyRole,

        saveAuth,
        loadStoredAuth,
        logout,
      }),
      [
        token,
        role,
        roles,
        username,
        loading,
        hasRole,
        hasAnyRole,
        saveAuth,
        loadStoredAuth,
        logout,
      ]
    );

  return (
    <AuthContext.Provider
      value={value}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context =
    useContext(
      AuthContext
    );

  if (!context) {
    throw new Error(
      "useAuth must be used inside AuthProvider"
    );
  }

  return context;
}