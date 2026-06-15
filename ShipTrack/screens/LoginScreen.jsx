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

export default function LoginScreen() {
  const {
    saveAuth,
  } = useAuth();

  const [username, setUsername] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const submit = async () => {
    if (!username.trim()) {
      Alert.alert(
        "Required",
        "Enter username"
      );
      return;
    }

    if (!password.trim()) {
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
          username,
          password,
        });

      const token =
        data.token ||
        data.jwt ||
        data.accessToken;

      const role =
        data.role ||
        data.user?.role ||
        "";

      const finalUsername =
        data.username ||
        data.user?.username ||
        username;

      if (!token) {
        throw new Error(
          "Login token missing"
        );
      }

      await saveAuth({
        token,
        role,
        username: finalUsername,
      });
    } catch (e) {
      Alert.alert(
        "Login failed",
        getBackendMessage(
          e,
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
        onChangeText={setUsername}
        placeholder="Username"
        placeholderTextColor="#64748b"
        style={styles.input}
        autoCapitalize="none"
      />

      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        placeholderTextColor="#64748b"
        style={styles.input}
        secureTextEntry
      />

      <TouchableOpacity
        style={styles.btn}
        onPress={submit}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.btnText}>
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
    backgroundColor: "#020617",
    justifyContent: "center",
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
    borderColor: "rgba(255,255,255,.10)",
    backgroundColor: "rgba(255,255,255,.05)",
    color: "#fff",
    paddingHorizontal: 14,
    marginBottom: 14,
    fontWeight: "700",
  },

  btn: {
    height: 52,
    borderRadius: 14,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },

  btnText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 16,
  },
};