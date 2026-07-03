import React from "react";

import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
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

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={{
        paddingBottom: 34,
      }}
    >
      <View style={styles.hero}>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>
            SHIPTRACK
          </Text>

          <Text style={styles.title}>
            Dispatch Control
          </Text>

          <Text style={styles.sub}>
            {username || "User"} •{" "}
            {normalizedRole || "ROLE"}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.logoutSmall}
          onPress={logout}
        >
          <Text style={styles.logoutSmallText}>
            Logout
          </Text>
        </TouchableOpacity>
      </View>

      {isDispatch ? (
        <>
          <View style={styles.statsGrid}>
            <MiniStat
              label="Access"
              value="Dispatch"
              active
            />

            <MiniStat
              label="Status"
              value="Ready"
              active
            />
          </View>

          <Text style={styles.sectionTitle}>
            Dispatch Actions
          </Text>

          <View style={styles.actionGrid}>
            <Action
              label="Single QR Dispatch"
              subtitle="Scan one item and create challan"
              icon="📷"
              primary
              onPress={() =>
                navigation.navigate(
                  "ScanDispatch"
                )
              }
            />

            <Action
              label="Bulk QR Dispatch"
              subtitle="Scan multiple items in one challan"
              icon="📦"
              primary
              onPress={() =>
                navigation.navigate("BulkScan")
              }
            />

            <Action
              label="Dispatch Items"
              subtitle="Search, filter and manage items"
              icon="📋"
              onPress={() =>
                navigation.navigate("DispatchItems")
              }
            />

            <Action
              label="Trips with Challans"
              subtitle="View challans and trip end time"
              icon="🚚"
              onPress={() =>
                navigation.navigate("Trips")
              }
            />
          </View>

          
        </>
      ) : (
        <View style={styles.permissionBox}>
          <Text style={styles.permissionTitle}>
            Access Restricted
          </Text>

          <Text style={styles.permissionText}>
            This mobile dispatch home is only for DISPATCH users. ADMIN users now open the Admin Dashboard automatically from Home.
          </Text>

          <TouchableOpacity
            style={styles.secondaryFullBtn}
            onPress={() =>
              navigation.navigate("Trips")
            }
          >
            <Text style={styles.secondaryFullText}>
              View Trips / Challans
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity
        style={styles.logout}
        onPress={logout}
      >
        <Text style={styles.logoutText}>
          Logout
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function Action({
  label,
  subtitle,
  icon,
  primary,
  onPress,
}) {
  return (
    <TouchableOpacity
      style={[
        styles.card,
        primary
          ? styles.cardPrimary
          : null,
      ]}
      onPress={onPress}
      activeOpacity={0.86}
    >
      <Text style={styles.icon}>
        {icon}
      </Text>

      <Text style={styles.cardText}>
        {label}
      </Text>

      <Text
        style={styles.cardSub}
        numberOfLines={2}
      >
        {subtitle}
      </Text>
    </TouchableOpacity>
  );
}

function MiniStat({
  label,
  value,
  active,
}) {
  return (
    <View
      style={[
        styles.miniStat,
        active
          ? styles.miniStatActive
          : null,
      ]}
    >
      <Text
        style={styles.miniStatValue}
        numberOfLines={1}
      >
        {value}
      </Text>

      <Text
        style={styles.miniStatLabel}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = {
  page: {
    flex: 1,
    backgroundColor: "#020617",
    padding: 16,
  },

  hero: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#0f172a",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.08)",
    padding: 18,
    marginBottom: 14,
    marginTop: 4,
  },

  kicker: {
    color: "#60a5fa",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.2,
    marginBottom: 5,
  },

  title: {
    color: "#fff",
    fontSize: 26,
    fontWeight: "900",
  },

  sub: {
    color: "#94a3b8",
    marginTop: 5,
    fontWeight: "700",
  },

  logoutSmall: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "rgba(239,68,68,.12)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,.25)",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },

  logoutSmallText: {
    color: "#fca5a5",
    fontWeight: "900",
    fontSize: 11,
  },

  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },

  miniStat: {
    width: "31.6%",
    minHeight: 56,
    borderRadius: 15,
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.08)",
    paddingHorizontal: 10,
    paddingVertical: 9,
    justifyContent: "center",
  },

  miniStatActive: {
    borderColor: "rgba(16,185,129,.32)",
    backgroundColor: "rgba(16,185,129,.08)",
  },

  miniStatValue: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 15,
  },

  miniStatLabel: {
    color: "#94a3b8",
    fontWeight: "800",
    fontSize: 10,
    marginTop: 3,
  },

  sectionTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 10,
  },

  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 14,
  },

  card: {
    width: "48.4%",
    minHeight: 124,
    borderRadius: 20,
    padding: 14,
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.08)",
  },

  cardPrimary: {
    borderColor: "rgba(37,99,235,.30)",
    backgroundColor: "rgba(37,99,235,.10)",
  },

  icon: {
    fontSize: 25,
    marginBottom: 8,
  },

  cardText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "900",
  },

  cardSub: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 5,
    lineHeight: 16,
  },

  noteBox: {
    backgroundColor: "rgba(16,185,129,.08)",
    borderWidth: 1,
    borderColor: "rgba(16,185,129,.20)",
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
  },

  noteTitle: {
    color: "#6ee7b7",
    fontWeight: "900",
    fontSize: 13,
    marginBottom: 5,
  },

  noteText: {
    color: "#cbd5e1",
    fontWeight: "700",
    fontSize: 12,
    lineHeight: 18,
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
    marginBottom: 14,
  },

  secondaryFullBtn: {
    height: 44,
    borderRadius: 13,
    backgroundColor: "rgba(59,130,246,.12)",
    borderWidth: 1,
    borderColor: "rgba(59,130,246,.25)",
    alignItems: "center",
    justifyContent: "center",
  },

  secondaryFullText: {
    color: "#93c5fd",
    fontWeight: "900",
  },

  logout: {
    height: 48,
    borderRadius: 14,
    backgroundColor: "#dc2626",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },

  logoutText: {
    color: "#fff",
    fontWeight: "900",
  },
};