import React from "react";

import {
  View,
  Text,
  TouchableOpacity,
} from "react-native";

import {
  useAuth,
} from "../auth/AuthContext";

export default function DispatchHomeScreen({
  navigation,
}) {
  const {
    role,
    username,
    logout,
  } = useAuth();

  return (
    <View style={styles.page}>
      <Text style={styles.title}>
        Dispatch Mobile
      </Text>

      <Text style={styles.sub}>
        {username || "User"} •{" "}
        {role || "ROLE"}
      </Text>

      <Action
        label="Single QR Dispatch"
        icon="📷"
        onPress={() =>
          navigation.navigate(
            "ScanDispatch"
          )
        }
      />

      <Action
        label="Bulk QR Dispatch"
        icon="📦"
        onPress={() =>
          navigation.navigate("BulkScan")
        }
      />

      <Action
        label="Trips / Delivery"
        icon="🚚"
        onPress={() =>
          navigation.navigate("Trips")
        }
      />

      <TouchableOpacity
        style={styles.logout}
        onPress={logout}
      >
        <Text style={styles.logoutText}>
          Logout
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function Action({
  label,
  icon,
  onPress,
}) {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
    >
      <Text style={styles.icon}>
        {icon}
      </Text>

      <Text style={styles.cardText}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = {
  page: {
    flex: 1,
    backgroundColor: "#020617",
    padding: 20,
  },

  title: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "900",
    marginTop: 16,
  },

  sub: {
    color: "#94a3b8",
    marginTop: 6,
    marginBottom: 20,
    fontWeight: "700",
  },

  card: {
    minHeight: 90,
    borderRadius: 20,
    padding: 18,
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.08)",
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
  },

  icon: {
    fontSize: 28,
    marginRight: 14,
  },

  cardText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "900",
  },

  logout: {
    height: 48,
    borderRadius: 14,
    backgroundColor: "#dc2626",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },

  logoutText: {
    color: "#fff",
    fontWeight: "900",
  },
};