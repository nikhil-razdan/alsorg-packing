import React, {
  useState,
} from "react";

import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";

import {
  loginUser,
} from "../api/authApi";

import {
  getBackendMessage,
} from "../api/client";

import {
  useAuth,
} from "../auth/AuthContext";

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

export default function LoginScreen() {
  const {
    saveAuth,
  } = useAuth();

  const [
    username,
    setUsername,
  ] = useState("");

  const [
    password,
    setPassword,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(false);

  const submit = async () => {
    const cleanUsername =
      username.trim();

    if (!cleanUsername) {
      Alert.alert(
        "Required",
        "Enter username"
      );
      return;
    }

    /*
     * Do not trim the password sent to the backend. Spaces can be a legitimate
     * part of a password. Only reject an actually empty input here.
     */
    if (!password) {
      Alert.alert(
        "Required",
        "Enter password"
      );
      return;
    }

    try {
      setLoading(true);

      const data =
        await loginUser({
          username:
            cleanUsername,
          password,
        });

      const token =
        data?.token ||
        data?.jwt ||
        data?.accessToken ||
        data?.data?.token ||
        data?.data?.jwt ||
        data?.data?.accessToken;

      const responseUser =
        data?.user ||
        data?.data?.user ||
        {};

      const responseRole =
        data?.role ||
        data?.data?.role ||
        responseUser?.role ||
        "";

      const responseRoles =
        normalizeRoles([
          ...(
            Array.isArray(
              data?.roles
            )
              ? data.roles
              : []
          ),

          ...(
            Array.isArray(
              data?.data?.roles
            )
              ? data.data.roles
              : []
          ),

          ...(
            Array.isArray(
              responseUser?.roles
            )
              ? responseUser.roles
              : []
          ),

          responseRole,
        ]);

      const cleanPrimaryRole =
        normalizeRole(
          responseRole
        );

      const primaryRole =
        cleanPrimaryRole &&
          responseRoles.includes(
            cleanPrimaryRole
          )
          ? cleanPrimaryRole
          : responseRoles[0] ||
          "";

      const finalUsername =
        data?.username ||
        data?.data?.username ||
        responseUser?.username ||
        cleanUsername;

      if (!token) {
        throw new Error(
          "Backend login succeeded, but the ShipTrack bearer token was not returned. Verify that the current PackFlow backend recognizes X-Client-Type: mobile."
        );
      }

      if (
        !primaryRole ||
        responseRoles.length === 0
      ) {
        throw new Error(
          "Login succeeded, but no user role was returned."
        );
      }

      await saveAuth({
        token,
        role:
          primaryRole,
        roles:
          responseRoles,
        username:
          finalUsername,
      });
    } catch (error) {
      Alert.alert(
        "Login failed",
        getBackendMessage(
          error,
          "Invalid login"
        )
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.page}>
      <Text style={styles.logo}>
        ShipTrack
      </Text>

      <Text style={styles.sub}>
        Alsorg Logistics
      </Text>

      <TextInput
        value={username}
        onChangeText={
          setUsername
        }
        placeholder="Username"
        placeholderTextColor="#64748b"
        style={styles.input}
        autoCapitalize="none"
        autoCorrect={false}
        editable={!loading}
      />

      <TextInput
        value={password}
        onChangeText={
          setPassword
        }
        placeholder="Password"
        placeholderTextColor="#64748b"
        style={styles.input}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        editable={!loading}
        onSubmitEditing={
          submit
        }
        returnKeyType="done"
      />

      <TouchableOpacity
        style={[
          styles.btn,
          loading
            ? styles.btnDisabled
            : null,
        ]}
        onPress={submit}
        disabled={loading}
        activeOpacity={0.85}
      >
        {loading ? (
          <ActivityIndicator
            color="#fff"
          />
        ) : (
          <Text
            style={
              styles.btnText
            }
          >
            Login
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = {
  page: {
    flex: 1,
    backgroundColor:
      "#020617",
    justifyContent:
      "center",
    padding: 24,
  },

  logo: {
    color: "#fff",
    fontSize: 30,
    fontWeight: "900",
    marginBottom: 8,
  },

  sub: {
    color: "#94a3b8",
    fontSize: 14,
    marginBottom: 28,
  },

  input: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor:
      "rgba(255,255,255,.10)",
    backgroundColor:
      "rgba(255,255,255,.05)",
    color: "#fff",
    paddingHorizontal: 14,
    marginBottom: 14,
    fontWeight: "700",
  },

  btn: {
    height: 52,
    borderRadius: 14,
    backgroundColor:
      "#2563eb",
    alignItems: "center",
    justifyContent:
      "center",
    marginTop: 8,
  },

  btnDisabled: {
    opacity: 0.72,
  },

  btnText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 16,
  },
};
