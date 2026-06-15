import React from "react";

import {
  View,
  Text,
  TouchableOpacity,
} from "react-native";

import {
  useAuth,
} from "../auth/AuthContext";

function normalizeRole(role) {
  return String(role || "")
    .trim()
    .toUpperCase();
}

export default function DispatchHomeScreen({
  navigation,
}) {
  const {
    role,
    username,
    logout,
  } = useAuth();

  const normalizedRole =
    normalizeRole(role);

  const isDispatch =
    normalizedRole === "DISPATCH";

  const canViewTrips =
    normalizedRole === "DISPATCH" ||
    normalizedRole === "LOGISTICS" ||
    normalizedRole === "ADMIN";

  return (
    <View style={styles.page}>
      <Text style={styles.title}>
        ShipTrack
      </Text>

      <Text style={styles.sub}>
        {username || "User"} •{" "}
        {normalizedRole || "ROLE"}
      </Text>

      {isDispatch ? (
        <>
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
        </>
      ) : (
        <View style={styles.permissionBox}>
          <Text style={styles.permissionTitle}>
            Dispatch actions restricted
          </Text>

          <Text style={styles.permissionText}>
            QR dispatch and Move to FG are allowed only for DISPATCH users.
          </Text>
        </View>
      )}

      {canViewTrips ? (
        <Action
          label="Trips / Delivery"
          icon="🚚"
          onPress={() =>
            navigation.navigate("Trips")
          }
        />
      ) : null}

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

  permissionBox: {
    backgroundColor: "rgba(245,158,11,.10)",
    borderWidth: 1,
    borderColor: "rgba(245,158,11,.25)",
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
  },

  permissionTitle: {
    color: "#facc15",
    fontWeight: "900",
    fontSize: 15,
    marginBottom: 6,
  },

  permissionText: {
    color: "#cbd5e1",
    fontWeight: "700",
    lineHeight: 19,
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