import React, {
  useCallback,
  useEffect,
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
  TextInput,
  ScrollView,
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

const normalizeText = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const ALL_STATUSES = [
  "READY",
  "READY_TO_STORE",
  "WAREHOUSE_REQUESTED",
  "IN_WAREHOUSE",
  "READY_TO_DISPATCH",
  "DISPATCHED",
  "AVAILABLE",
  "WAREHOUSE_RETURN_REQUESTED",
  "RESTORED",
];

function formatDateTime(value) {
  if (!value) {
    return "—";
  }

  const raw =
    String(value).trim();

  if (!raw) {
    return "—";
  }

  try {
    const hasTimezone =
      /z$/i.test(raw) ||
      /[+-]\d{2}:\d{2}$/.test(raw);

    const utcSafeValue =
      raw.includes("T") && !hasTimezone
        ? `${raw}Z`
        : raw;

    const date =
      new Date(utcSafeValue);

    if (Number.isNaN(date.getTime())) {
      return raw;
    }

    return new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(date);
  } catch {
    return raw;
  }
}

function cleanValue(value) {
  const text =
    String(value || "").trim();

  return text || "—";
}

function getItemName(item) {
  return (
    item.name ||
    item.itemName ||
    item.item_name ||
    "Unnamed Item"
  );
}

function getItemLocation(item) {
  return (
    item.currentLocationCode ||
    item.location ||
    item.warehouseCode ||
    item.fgZoneCode ||
    "—"
  );
}

function getSearchBlob(item) {
  return [
    item.clientName,
    item.clientAddress,
    item.sku,
    item.pdNo,
    item.drawingNo,
    item.dwgNo,
    item.name,
    item.itemName,
    item.zohoItemId,
    item.description,
    item.remarks,
    item.chalaanNumber,
    item.challanNumber,
    item.driverName,
    item.vehicleNumber,
    item.dispatchedBy,
  ]
    .map(normalizeText)
    .join(" ");
}

export default function DispatchItemsScreen() {
  const [loading, setLoading] =
    useState(false);

  const [refreshing, setRefreshing] =
    useState(false);

  const [items, setItems] =
    useState([]);

  const [search, setSearch] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState("ALL");

  const [plantFilter, setPlantFilter] =
    useState("ALL");

  const [locationFilter, setLocationFilter] =
    useState("ALL");

  const [pageNo, setPageNo] =
    useState(1);

  const [pageSize, setPageSize] =
    useState(10);

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
        e?.response?.data?.message ||
        e?.response?.data ||
        e?.message ||
        "Failed to refresh"
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

  const statusOptions = useMemo(() => {
    const existing =
      new Set(
        items
          .map((item) =>
            normalizeStatus(item.status)
          )
          .filter(Boolean)
          .filter((status) =>
            ALL_STATUSES.includes(status)
          )
      );

    const merged =
      ALL_STATUSES.filter(
        (status) =>
          existing.has(status) ||
          status === "READY" ||
          status === "READY_TO_DISPATCH" ||
          status === "DISPATCHED"
      );

    const extra =
      [...existing].filter(
        (status) =>
          !merged.includes(status)
      );

    return [
      "ALL",
      ...merged,
      ...extra,
    ];
  }, [items]);

  const plantOptions = useMemo(() => {
    const plants =
      items
        .map((item) =>
          String(item.plantCode || "").trim()
        )
        .filter(Boolean);

    return [
      "ALL",
      ...Array.from(new Set(plants)).sort(),
    ];
  }, [items]);

  const locationOptions = useMemo(() => {
    const locations =
      items
        .map(getItemLocation)
        .filter((x) => x && x !== "—");

    return [
      "ALL",
      ...Array.from(new Set(locations)).sort(),
    ];
  }, [items]);

  const filteredItems = useMemo(() => {
    const query =
      normalizeText(search);

    return items.filter((item) => {
      const itemStatus =
        normalizeStatus(item.status);

      const itemPlant =
        String(item.plantCode || "").trim();

      const itemLocation =
        getItemLocation(item);

      const matchesSearch =
        !query ||
        getSearchBlob(item).includes(query);

      const matchesStatus =
        statusFilter === "ALL" ||
        itemStatus === statusFilter;

      const matchesPlant =
        plantFilter === "ALL" ||
        itemPlant === plantFilter;

      const matchesLocation =
        locationFilter === "ALL" ||
        itemLocation === locationFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesPlant &&
        matchesLocation
      );
    });
  }, [
    items,
    search,
    statusFilter,
    plantFilter,
    locationFilter,
  ]);

  const totalPages = useMemo(
    () =>
      Math.max(
        1,
        Math.ceil(filteredItems.length / pageSize)
      ),
    [filteredItems.length, pageSize]
  );

  const currentPage =
    Math.min(pageNo, totalPages);

  const paginatedItems = useMemo(
    () =>
      filteredItems.slice(
        (currentPage - 1) * pageSize,
        currentPage * pageSize
      ),
    [filteredItems, currentPage, pageSize]
  );

  useEffect(() => {
    setPageNo(1);
  }, [
    search,
    statusFilter,
    plantFilter,
    locationFilter,
    pageSize,
  ]);

  useEffect(() => {
    if (pageNo > totalPages) {
      setPageNo(totalPages);
    }
  }, [pageNo, totalPages]);

  const readyItems = useMemo(
    () =>
      filteredItems.filter(
        (item) =>
          normalizeStatus(item.status) === "READY"
      ),
    [filteredItems]
  );

  const readyToDispatchItems = useMemo(
    () =>
      filteredItems.filter(
        (item) =>
          normalizeStatus(item.status) ===
          "READY_TO_DISPATCH"
      ),
    [filteredItems]
  );

  const dispatchedItems = useMemo(
    () =>
      filteredItems.filter(
        (item) =>
          normalizeStatus(item.status) === "DISPATCHED"
      ),
    [filteredItems]
  );

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("ALL");
    setPlantFilter("ALL");
    setLocationFilter("ALL");
  };

  const hasAnyFilter =
    search.trim() ||
    statusFilter !== "ALL" ||
    plantFilter !== "ALL" ||
    locationFilter !== "ALL";

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
        Search, filter and manage plant-wise dispatch items
      </Text>

      <FlatList
        data={paginatedItems}
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
          <View>
            <View style={styles.searchBox}>
              <Text style={styles.searchIcon}>
                🔍
              </Text>

              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search client, SKU, PD, DWG, item, challan..."
                placeholderTextColor="#64748b"
                style={styles.searchInput}
                autoCapitalize="none"
              />

              {search ? (
                <TouchableOpacity
                  onPress={() => setSearch("")}
                  style={styles.searchClear}
                >
                  <Text style={styles.searchClearText}>
                    ×
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>

            <FilterSection
              title="Status"
              options={statusOptions}
              selected={statusFilter}
              onSelect={setStatusFilter}
            />

            <FilterSection
              title="Plant"
              options={plantOptions}
              selected={plantFilter}
              onSelect={setPlantFilter}
            />

            <FilterSection
              title="Location"
              options={locationOptions}
              selected={locationFilter}
              onSelect={setLocationFilter}
            />

            {hasAnyFilter ? (
              <TouchableOpacity
                style={styles.clearFiltersBtn}
                onPress={clearFilters}
              >
                <Text style={styles.clearFiltersText}>
                  Clear Filters
                </Text>
              </TouchableOpacity>
            ) : null}

            <View style={styles.summaryRow}>
              <Summary
                label="Showing"
                value={filteredItems.length}
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

            <View style={styles.summaryRow}>
              <Summary
                label="Dispatched"
                value={dispatchedItems.length}
              />

              <Summary
                label="Total Access"
                value={items.length}
              />

              <Summary
                label="Filters"
                value={
                  hasAnyFilter
                    ? "ON"
                    : "OFF"
                }
              />
            </View>

            <PaginationBar
              pageNo={currentPage}
              totalPages={totalPages}
              pageSize={pageSize}
              setPageNo={setPageNo}
              setPageSize={setPageSize}
              totalItems={filteredItems.length}
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
        contentContainerStyle={{
          paddingBottom: 36,
        }}
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
        Page {pageNo} of {totalPages} • {totalItems} items
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

function FilterSection({
  title,
  options,
  selected,
  onSelect,
}) {
  return (
    <View style={styles.filterBlock}>
      <Text style={styles.filterTitle}>
        {title}
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterScroll}
      >
        {options.map((option) => {
          const active =
            selected === option;

          return (
            <TouchableOpacity
              key={option}
              style={[
                styles.filterChip,
                active
                  ? styles.filterChipActive
                  : null,
              ]}
              onPress={() =>
                onSelect(option)
              }
            >
              <Text
                style={[
                  styles.filterChipText,
                  active
                    ? styles.filterChipTextActive
                    : null,
                ]}
              >
                {option === "ALL"
                  ? "All"
                  : option.replaceAll("_", " ")}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
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

  const challanNumber =
    item.chalaanNumber ||
    item.challanNumber ||
    "";

  const isDispatched =
    status === "DISPATCHED";

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.itemName}>
            {getItemName(item)}
          </Text>

          <Text style={styles.meta}>
            SKU: {cleanValue(item.sku)}
          </Text>

          {challanNumber ? (
            <Text style={styles.meta}>
              Challan: {challanNumber}
            </Text>
          ) : null}
        </View>

        <View
          style={[
            styles.badge,
            status === "READY_TO_DISPATCH"
              ? styles.readyDispatchBadge
              : status === "READY"
                ? styles.readyBadge
                : status === "DISPATCHED"
                  ? styles.dispatchedBadge
                  : null,
          ]}
        >
          <Text
            style={[
              styles.badgeText,
              status === "DISPATCHED"
                ? styles.dispatchedBadgeText
                : null,
            ]}
          >
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
          label="DWG No"
          value={
            item.drawingNo ||
            item.dwgNo ||
            "—"
          }
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
          value={getItemLocation(item)}
        />

        <Info
          label="Zoho / Item ID"
          value={item.zohoItemId || "—"}
        />

        {isDispatched ? (
          <>
            <Info
              label="Driver"
              value={item.driverName || "—"}
            />

            <Info
              label="Vehicle"
              value={item.vehicleNumber || "—"}
            />

            <Info
              label="Dispatched At"
              value={formatDateTime(
                item.dispatchedAt
              )}
            />

            <Info
              label="Dispatched By"
              value={item.dispatchedBy || "—"}
            />
          </>
        ) : null}
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

  searchBox: {
    minHeight: 50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.10)",
    backgroundColor: "rgba(255,255,255,.05)",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    marginBottom: 14,
  },

  searchIcon: {
    fontSize: 18,
    marginRight: 8,
  },

  searchInput: {
    flex: 1,
    color: "#fff",
    fontWeight: "800",
    fontSize: 13,
    minHeight: 48,
  },

  searchClear: {
    width: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: "rgba(148,163,184,.18)",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },

  searchClearText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 18,
    lineHeight: 20,
  },

  filterBlock: {
    marginBottom: 12,
  },

  filterTitle: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "900",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },

  filterScroll: {
    gap: 8,
    paddingRight: 10,
  },

  filterChip: {
    minHeight: 36,
    paddingHorizontal: 13,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.08)",
    backgroundColor: "rgba(15,23,42,.88)",
    alignItems: "center",
    justifyContent: "center",
  },

  filterChipActive: {
    borderColor: "rgba(37,99,235,.55)",
    backgroundColor: "rgba(37,99,235,.22)",
  },

  filterChipText: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "900",
  },

  filterChipTextActive: {
    color: "#93c5fd",
  },

  clearFiltersBtn: {
    height: 38,
    borderRadius: 12,
    backgroundColor: "rgba(239,68,68,.12)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,.28)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },

  clearFiltersText: {
    color: "#fca5a5",
    fontWeight: "900",
    fontSize: 12,
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
    fontSize: 12,
  },

  badge: {
    backgroundColor: "rgba(59,130,246,.14)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: 160,
  },

  readyBadge: {
    backgroundColor: "rgba(59,130,246,.14)",
  },

  readyDispatchBadge: {
    backgroundColor: "rgba(16,185,129,.14)",
  },

  dispatchedBadge: {
    backgroundColor: "rgba(34,197,94,.14)",
  },

  badgeText: {
    color: "#93c5fd",
    fontSize: 10,
    fontWeight: "900",
  },

  dispatchedBadgeText: {
    color: "#86efac",
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
};