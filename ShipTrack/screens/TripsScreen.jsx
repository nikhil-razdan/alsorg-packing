import React, {
  useCallback,
  useMemo,
  useState,
  useEffect,
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

  const [pageNo, setPageNo] =
    useState(1);

  const [pageSize, setPageSize] =
    useState(10);

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

  const totalPages =
    useMemo(
      () =>
        Math.max(
          1,
          Math.ceil(challans.length / pageSize)
        ),
      [challans.length, pageSize]
    );

  const currentPage =
    Math.min(pageNo, totalPages);

  const paginatedChallans =
    useMemo(
      () =>
        challans.slice(
          (currentPage - 1) * pageSize,
          currentPage * pageSize
        ),
      [challans, currentPage, pageSize]
    );

  useEffect(() => {
    if (pageNo > totalPages) {
      setPageNo(totalPages);
    }
  }, [pageNo, totalPages]);

  useEffect(() => {
    setPageNo(1);
  }, [pageSize]);

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
        data={paginatedChallans}
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
        ListHeaderComponent={
          <PaginationBar
            pageNo={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            setPageNo={setPageNo}
            setPageSize={setPageSize}
            totalItems={challans.length}
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

function PaginationBar({
  pageNo,
  totalPages,
  pageSize,
  setPageNo,
  setPageSize,
  totalItems,
}) {
  return (
    <View style={styles.paginationBox}>
      <Text style={styles.paginationText}>
        Page {pageNo} of {totalPages} • {totalItems} challans
      </Text>

      <View style={styles.paginationRow}>
        {[10, 25, 50].map((size) => (
          <TouchableOpacity
            key={size}
            style={[
              styles.pageSizeBtn,
              pageSize === size
                ? styles.pageSizeBtnActive
                : null,
            ]}
            onPress={() => {
              setPageSize(size);
              setPageNo(1);
            }}
          >
            <Text
              style={[
                styles.pageSizeText,
                pageSize === size
                  ? styles.pageSizeTextActive
                  : null,
              ]}
            >
              {size}
            </Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          disabled={pageNo <= 1}
          style={[
            styles.pageBtn,
            pageNo <= 1
              ? styles.pageBtnDisabled
              : null,
          ]}
          onPress={() =>
            setPageNo((prev) =>
              Math.max(1, prev - 1)
            )
          }
        >
          <Text style={styles.pageBtnText}>
            Prev
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          disabled={pageNo >= totalPages}
          style={[
            styles.pageBtn,
            pageNo >= totalPages
              ? styles.pageBtnDisabled
              : null,
          ]}
          onPress={() =>
            setPageNo((prev) =>
              Math.min(totalPages, prev + 1)
            )
          }
        >
          <Text style={styles.pageBtnText}>
            Next
          </Text>
        </TouchableOpacity>
      </View>
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

  paginationBox: {
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.08)",
    borderRadius: 16,
    padding: 12,
    marginBottom: 14,
  },

  paginationText: {
    color: "#94a3b8",
    fontWeight: "800",
    fontSize: 12,
    marginBottom: 10,
  },

  paginationRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
  },

  pageSizeBtn: {
    minWidth: 42,
    height: 34,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.08)",
    alignItems: "center",
    justifyContent: "center",
  },

  pageSizeBtnActive: {
    backgroundColor: "rgba(37,99,235,.22)",
    borderColor: "rgba(37,99,235,.48)",
  },

  pageSizeText: {
    color: "#94a3b8",
    fontWeight: "900",
    fontSize: 12,
  },

  pageSizeTextActive: {
    color: "#93c5fd",
  },

  pageBtn: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: "rgba(59,130,246,.18)",
    borderWidth: 1,
    borderColor: "rgba(59,130,246,.28)",
    alignItems: "center",
    justifyContent: "center",
  },

  pageBtnDisabled: {
    opacity: 0.35,
  },

  pageBtnText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 12,
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