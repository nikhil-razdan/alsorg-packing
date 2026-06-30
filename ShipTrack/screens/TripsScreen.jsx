import React, {
  useCallback,
  useState,
} from "react";

import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native";

import {
  useFocusEffect,
} from "@react-navigation/native";

import {
  safeOpenChallanPdf,
} from "../api/challanDownloadApi";

import {
  fetchDispatchedChallans,
} from "../api/logisticsApi";

function formatDateTime(value) {
  if (!value) {
    return "—";
  }

  try {
    return new Date(value).toLocaleString();
  } catch {
    return "—";
  }
}

export default function TripsScreen() {
  const [loading, setLoading] =
    useState(false);

  const [refreshing, setRefreshing] =
    useState(false);

  const [challans, setChallans] =
    useState([]);

  const [expanded, setExpanded] =
    useState("");

  const loadChallans = async () => {
    try {
      setLoading(true);

      const data =
        await fetchDispatchedChallans();

      setChallans(
        Array.isArray(data)
          ? data
          : []
      );
    } catch (e) {
      console.error(e);

      Alert.alert(
        "Challans failed",
        e?.response?.data?.message ||
          e?.response?.data ||
          e?.message ||
          "Failed to load dispatched challans"
      );
    } finally {
      setLoading(false);
    }
  };

  const refresh = async () => {
    try {
      setRefreshing(true);

      const data =
        await fetchDispatchedChallans();

      setChallans(
        Array.isArray(data)
          ? data
          : []
      );
    } catch (e) {
      Alert.alert(
        "Refresh failed",
        e?.response?.data?.message ||
          e?.response?.data ||
          e?.message ||
          "Failed to refresh challans"
      );
    } finally {
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadChallans();
    }, [])
  );

  if (
    loading &&
    challans.length === 0
  ) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />

        <Text style={styles.loadingText}>
          Loading dispatched challans...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.title}>
          Dispatched Challans
        </Text>

        <Text style={styles.sub}>
          Challan-wise dispatched items with driver and vehicle details
        </Text>
      </View>

      <FlatList
        data={challans}
        keyExtractor={(item, index) =>
          item.challanNumber ||
          `challan-${index}`
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor="#fff"
          />
        }
        contentContainerStyle={{
          paddingBottom: 28,
        }}
        renderItem={({ item }) => (
          <ChallanCard
            challan={item}
            expanded={
              expanded === item.challanNumber
            }
            onToggle={() =>
              setExpanded((prev) =>
                prev === item.challanNumber
                  ? ""
                  : item.challanNumber
              )
            }
          />
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>
            No dispatched challans found
          </Text>
        }
      />
    </View>
  );
}

function ChallanCard({
  challan,
  expanded,
  onToggle,
}) {
  const driverName =
    challan.driverName || "—";

  const vehicleNo =
    challan.vehicleNumber || "—";

  const items =
    Array.isArray(challan.items)
      ? challan.items
      : [];

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.challan}>
            {challan.challanNumber || "—"}
          </Text>

          <Text style={styles.meta}>
            {driverName} • {vehicleNo}
          </Text>

          <Text style={styles.smallMeta}>
            By {challan.dispatchedBy || "—"} •{" "}
            {formatDateTime(
              challan.dispatchedAt
            )}
          </Text>
        </View>

        <View style={styles.dispatchedBadge}>
          <Text style={styles.dispatchedText}>
            DISPATCHED
          </Text>
        </View>
      </View>

      <View style={styles.infoGrid}>
        <Info
          label="Items"
          value={String(
            challan.totalItems || items.length || 0
          )}
        />

        <Info
          label="Driver"
          value={driverName}
        />

        <Info
          label="Vehicle"
          value={vehicleNo}
        />

        <Info
          label="Dispatch Time"
          value={formatDateTime(
            challan.dispatchedAt
          )}
        />
      </View>

      <TouchableOpacity
        style={styles.challanBtn}
        onPress={() =>
          safeOpenChallanPdf(
            challan.challanNumber
          )
        }
      >
        <Text style={styles.challanText}>
          Open Challan PDF
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.secondaryBtn}
        onPress={onToggle}
      >
        <Text style={styles.secondaryText}>
          {expanded
            ? "Hide Items"
            : "View Items"}
        </Text>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.itemsBox}>
          {items.length === 0 ? (
            <Text style={styles.noItems}>
              No items found in this challan.
            </Text>
          ) : (
            items.map((item, index) => (
              <View
                key={
                  item.zohoItemId ||
                  `${challan.challanNumber}-${index}`
                }
                style={styles.itemCard}
              >
                <Text
                  style={styles.itemName}
                  numberOfLines={2}
                >
                  {index + 1}. {item.name || "—"}
                </Text>

                <Text
                  style={styles.itemMeta}
                  numberOfLines={2}
                >
                  SKU: {item.sku || "—"}
                </Text>

                <Text style={styles.itemMeta}>
                  PD: {item.pdNo || "—"} • Client:{" "}
                  {item.clientName || "—"}
                </Text>

                <Text style={styles.itemMeta}>
                  Plant: {item.plantCode || "—"} • Status:{" "}
                  {item.status || "DISPATCHED"}
                </Text>
              </View>
            ))
          )}
        </View>
      )}
    </View>
  );
}

function Info({
  label,
  value,
}) {
  return (
    <View style={styles.info}>
      <Text style={styles.infoLabel}>
        {label}
      </Text>

      <Text
        style={styles.infoValue}
        numberOfLines={2}
      >
        {value}
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

  center: {
    flex: 1,
    backgroundColor: "#020617",
    alignItems: "center",
    justifyContent: "center",
  },

  loadingText: {
    color: "#94a3b8",
    marginTop: 12,
    fontWeight: "700",
  },

  header: {
    marginBottom: 12,
  },

  title: {
    color: "#fff",
    fontSize: 26,
    fontWeight: "900",
  },

  sub: {
    color: "#94a3b8",
    marginTop: 4,
    fontWeight: "700",
    lineHeight: 20,
  },

  empty: {
    color: "#94a3b8",
    textAlign: "center",
    marginTop: 40,
    fontWeight: "700",
  },

  card: {
    backgroundColor: "#0f172a",
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.08)",
  },

  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 14,
  },

  challan: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "900",
  },

  meta: {
    color: "#94a3b8",
    marginTop: 5,
    fontWeight: "700",
  },

  smallMeta: {
    color: "#64748b",
    marginTop: 4,
    fontWeight: "700",
    fontSize: 11,
  },

  dispatchedBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(16,185,129,.14)",
  },

  dispatchedText: {
    color: "#6ee7b7",
    fontSize: 10,
    fontWeight: "900",
  },

  infoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -4,
  },

  info: {
    width: "50%",
    padding: 4,
  },

  infoLabel: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "900",
  },

  infoValue: {
    color: "#e5e7eb",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 3,
  },

  challanBtn: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(251,191,36,.28)",
    backgroundColor: "rgba(251,191,36,.12)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
  },

  challanText: {
    color: "#facc15",
    fontWeight: "900",
  },

  secondaryBtn: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(96,165,250,.25)",
    backgroundColor: "rgba(59,130,246,.10)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },

  secondaryText: {
    color: "#93c5fd",
    fontWeight: "900",
    fontSize: 12,
  },

  itemsBox: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,.08)",
    paddingTop: 12,
  },

  noItems: {
    color: "#94a3b8",
    fontWeight: "700",
    textAlign: "center",
    paddingVertical: 10,
  },

  itemCard: {
    backgroundColor: "rgba(255,255,255,.035)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.07)",
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },

  itemName: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 13,
  },

  itemMeta: {
    color: "#94a3b8",
    fontWeight: "700",
    fontSize: 11,
    marginTop: 4,
  },
};