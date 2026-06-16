import React, {
  useCallback,
  useMemo,
  useState,
} from "react";

import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native";

import {
  useFocusEffect,
} from "@react-navigation/native";

import {
  fetchDispatchedItems,
  updateDispatchStatus,
} from "../api/dispatchedApi";

const normalizeStatus = (value) =>
  String(value || "")
    .trim()
    .toUpperCase();

export default function DispatchItemsScreen() {
  const [loading, setLoading] =
    useState(false);

  const [refreshing, setRefreshing] =
    useState(false);

  const [items, setItems] =
    useState([]);

  const load = async () => {
    try {
      setLoading(true);

      const data =
        await fetchDispatchedItems();

      setItems(
        Array.isArray(data)
          ? data
          : []
      );
    } catch (e) {
      Alert.alert(
        "Items failed",
        e?.response?.data?.message ||
          e?.response?.data ||
          e?.message ||
          "Failed to load items"
      );
    } finally {
      setLoading(false);
    }
  };

  const refresh = async () => {
    try {
      setRefreshing(true);

      const data =
        await fetchDispatchedItems();

      setItems(
        Array.isArray(data)
          ? data
          : []
      );
    } catch (e) {
      Alert.alert(
        "Refresh failed",
        e?.message || "Failed to refresh"
      );
    } finally {
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  const readyItems = useMemo(
    () =>
      items.filter(
        (item) =>
          normalizeStatus(item.status) === "READY"
      ),
    [items]
  );

  const readyToDispatchItems = useMemo(
    () =>
      items.filter(
        (item) =>
          normalizeStatus(item.status) ===
          "READY_TO_DISPATCH"
      ),
    [items]
  );

  if (loading && items.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />

        <Text style={styles.loadingText}>
          Loading dispatch items...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <Text style={styles.title}>
        Dispatch Items
      </Text>

      <Text style={styles.sub}>
        Plant-wise dispatch item list and actions
      </Text>

      <FlatList
        data={items}
        keyExtractor={(item, index) =>
          item.zohoItemId ||
          item.id ||
          String(index)
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor="#fff"
          />
        }
        ListHeaderComponent={
          <View style={styles.summaryRow}>
            <Summary
              label="Total"
              value={items.length}
            />

            <Summary
              label="Ready"
              value={readyItems.length}
            />

            <Summary
              label="Ready Dispatch"
              value={readyToDispatchItems.length}
            />
          </View>
        }
        renderItem={({ item }) => (
          <ItemCard
            item={item}
            reload={load}
          />
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>
            No dispatch items found
          </Text>
        }
      />
    </View>
  );
}

function ItemCard({
  item,
  reload,
}) {
  const status =
    normalizeStatus(item.status);

  const canMarkReadyToDispatch =
    status === "READY";

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.itemName}>
            {item.name || item.itemName || "Unnamed Item"}
          </Text>

          <Text style={styles.meta}>
            {item.sku || "No SKU"}
          </Text>
        </View>

        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {status || "—"}
          </Text>
        </View>
      </View>

      <View style={styles.grid}>
        <Info
          label="PD No"
          value={item.pdNo || "—"}
        />

        <Info
          label="Client"
          value={item.clientName || "—"}
        />

        <Info
          label="Plant"
          value={item.plantCode || "—"}
        />

        <Info
          label="Location"
          value={
            item.currentLocationCode ||
            item.location ||
            "—"
          }
        />
      </View>

      {canMarkReadyToDispatch ? (
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={async () => {
            try {
              await updateDispatchStatus(
                item.zohoItemId,
                "READY_TO_DISPATCH"
              );

              Alert.alert(
                "Updated",
                "Item marked Ready To Dispatch"
              );

              await reload();
            } catch (e) {
              Alert.alert(
                "Action failed",
                e?.response?.data?.message ||
                  e?.response?.data ||
                  e?.message ||
                  "Unable to update item"
              );
            }
          }}
        >
          <Text style={styles.primaryText}>
            Mark Ready To Dispatch
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function Summary({
  label,
  value,
}) {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryValue}>
        {value}
      </Text>

      <Text style={styles.summaryLabel}>
        {label}
      </Text>
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

  title: {
    color: "#fff",
    fontSize: 26,
    fontWeight: "900",
  },

  sub: {
    color: "#94a3b8",
    marginTop: 4,
    marginBottom: 14,
    fontWeight: "700",
  },

  summaryRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },

  summaryCard: {
    flex: 1,
    padding: 12,
    borderRadius: 16,
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.08)",
  },

  summaryValue: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 18,
  },

  summaryLabel: {
    color: "#94a3b8",
    fontWeight: "700",
    fontSize: 11,
    marginTop: 4,
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
    marginBottom: 12,
  },

  itemName: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "900",
  },

  meta: {
    color: "#94a3b8",
    marginTop: 4,
    fontWeight: "700",
  },

  badge: {
    backgroundColor: "rgba(59,130,246,.14)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  badgeText: {
    color: "#93c5fd",
    fontSize: 10,
    fontWeight: "900",
  },

  grid: {
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

  primaryBtn: {
    height: 44,
    borderRadius: 12,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },

  primaryText: {
    color: "#fff",
    fontWeight: "900",
  },

  empty: {
    color: "#94a3b8",
    textAlign: "center",
    marginTop: 40,
    fontWeight: "700",
  },
};