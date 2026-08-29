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
  Modal,
} from "react-native";

import {
  useFocusEffect,
} from "@react-navigation/native";

import {
  fetchDispatchedItems,
  updateDispatchStatus,
} from "../api/dispatchedApi";

import {
  getBackendMessage,
} from "../api/client";

import {
  useAuth,
} from "../auth/AuthContext";

import {
  getDisplayPlantCode,
  getDisplaySku,
} from "../api/operationalMetadataApi";

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

function formatStatus(value) {
  const text =
    String(value || "")
      .trim();

  if (!text || text === "ALL") {
    return "All";
  }

  return text.replace(/_/g, " ");
}

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

    let date;

    if (!hasTimezone && raw.includes("T")) {
      const match =
        raw.match(
          /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/
        );

      if (!match) {
        return raw;
      }

      date =
        new Date(
          Number(match[1]),
          Number(match[2]) - 1,
          Number(match[3]),
          Number(match[4]),
          Number(match[5]),
          Number(match[6] || 0)
        );
    } else {
      date =
        new Date(raw);
    }

    if (Number.isNaN(date.getTime())) {
      return raw;
    }

    return new Intl.DateTimeFormat("en-IN", {
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


function isLegacyLocationMissing(item) {
  return (
    !item?.plantCode ||
    !item?.currentLocationCode ||
    !item?.fgAreaCode
  );
}

function isFgLocation(item) {
  const location =
    String(item?.currentLocationCode || "")
      .trim()
      .toUpperCase();

  const fgArea =
    String(item?.fgAreaCode || "")
      .trim()
      .toUpperCase();

  return Boolean(
    location &&
    fgArea &&
    location.startsWith(fgArea)
  );
}

function canMarkReadyToDispatch(item) {
  return (
    normalizeStatus(item?.status) === "READY" &&
    (
      isLegacyLocationMissing(item) ||
      isFgLocation(item)
    )
  );
}

function needsFgBeforeDispatch(item) {
  return (
    normalizeStatus(item?.status) === "READY" &&
    !isLegacyLocationMissing(item) &&
    !isFgLocation(item)
  );
}

function getSearchBlob(item) {
  return [
    item.clientName,
    item.clientAddress,
    getDisplaySku(item),
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
    getDisplayPlantCode(item),
  ]
    .map(normalizeText)
    .join(" ");
}

export default function DispatchItemsScreen() {
  const { hasAnyRole } = useAuth();

  const canMutateDispatch =
    hasAnyRole(
      "DISPATCH",
      "UTL_DISPATCH"
    );

  const [loading, setLoading] =
    useState(false);

  const [refreshing, setRefreshing] =
    useState(false);

  const [items, setItems] =
    useState([]);

  const [search, setSearch] =
    useState("");

  const [itemNameFilter, setItemNameFilter] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState("ALL");

  const [plantFilter, setPlantFilter] =
    useState("ALL");

  const [locationFilter, setLocationFilter] =
    useState("ALL");

  const [filterOpen, setFilterOpen] =
    useState(false);

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
        getBackendMessage(
          e,
          "Failed to load items"
        )
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
        getBackendMessage(
          e,
          "Failed to refresh"
        )
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

  const statusOptions =
    useMemo(() => {
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

  const plantOptions =
    useMemo(() => {
      const plants =
        items
          .map((item) =>
            getDisplayPlantCode(item)
          )
          .filter(Boolean);

      return [
        "ALL",
        ...Array.from(new Set(plants)).sort(),
      ];
    }, [items]);

  const locationOptions =
    useMemo(() => {
      const locations =
        items
          .map(getItemLocation)
          .filter((x) => x && x !== "—");

      return [
        "ALL",
        ...Array.from(new Set(locations)).sort(),
      ];
    }, [items]);

  const filteredItems =
    useMemo(() => {
      const query =
        normalizeText(search);

      const nameQuery =
        normalizeText(itemNameFilter);

      return items.filter((item) => {
        const itemStatus =
          normalizeStatus(item.status);

        const itemPlant =
          getDisplayPlantCode(item);

        const itemLocation =
          getItemLocation(item);

        const itemName =
          normalizeText(getItemName(item));

        const matchesSearch =
          !query ||
          getSearchBlob(item).includes(query);

        const matchesName =
          !nameQuery ||
          itemName.includes(nameQuery);

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
          matchesName &&
          matchesStatus &&
          matchesPlant &&
          matchesLocation
        );
      });
    }, [
      items,
      search,
      itemNameFilter,
      statusFilter,
      plantFilter,
      locationFilter,
    ]);

  const totalPages =
    useMemo(
      () =>
        Math.max(
          1,
          Math.ceil(filteredItems.length / pageSize)
        ),
      [filteredItems.length, pageSize]
    );

  const currentPage =
    Math.min(pageNo, totalPages);

  const paginatedItems =
    useMemo(
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
    itemNameFilter,
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

  const readyItems =
    useMemo(
      () =>
        filteredItems.filter(
          (item) =>
            normalizeStatus(item.status) === "READY"
        ),
      [filteredItems]
    );

  const readyToDispatchItems =
    useMemo(
      () =>
        filteredItems.filter(
          (item) =>
            normalizeStatus(item.status) ===
            "READY_TO_DISPATCH"
        ),
      [filteredItems]
    );

  const dispatchedItems =
    useMemo(
      () =>
        filteredItems.filter(
          (item) =>
            normalizeStatus(item.status) === "DISPATCHED"
        ),
      [filteredItems]
    );

  const filterCount =
    [
      itemNameFilter.trim(),
      statusFilter !== "ALL",
      plantFilter !== "ALL",
      locationFilter !== "ALL",
    ].filter(Boolean).length;

  const hasAnyFilter =
    Boolean(search.trim()) ||
    filterCount > 0;

  const clearFilters = () => {
    setSearch("");
    setItemNameFilter("");
    setStatusFilter("ALL");
    setPlantFilter("ALL");
    setLocationFilter("ALL");
  };

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
          String(
            item.zohoItemId ||
            item.id ||
            index
          )
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
                placeholder="Search client, SKU, PD, DWG, challan..."
                placeholderTextColor="#64748b"
                style={styles.searchInput}
                autoCapitalize="none"
              />

              {search ? (
                <TouchableOpacity
                  onPress={() =>
                    setSearch("")
                  }
                  style={styles.searchClear}
                >
                  <Text style={styles.searchClearText}>
                    ×
                  </Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity
                style={[
                  styles.filterOpenBtn,
                  filterCount > 0
                    ? styles.filterOpenBtnActive
                    : null,
                ]}
                onPress={() =>
                  setFilterOpen(true)
                }
              >
                <Text
                  style={[
                    styles.filterOpenText,
                    filterCount > 0
                      ? styles.filterOpenTextActive
                      : null,
                  ]}
                >
                  ⚙
                </Text>

                {filterCount > 0 ? (
                  <View style={styles.filterCountBadge}>
                    <Text style={styles.filterCountText}>
                      {filterCount}
                    </Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            </View>

            <ActiveFilterStrip
              search={search}
              itemNameFilter={itemNameFilter}
              statusFilter={statusFilter}
              plantFilter={plantFilter}
              locationFilter={locationFilter}
              hasAnyFilter={hasAnyFilter}
              onClear={clearFilters}
            />

            <CompactStats
              showing={filteredItems.length}
              total={items.length}
              ready={readyItems.length}
              readyDispatch={readyToDispatchItems.length}
              dispatched={dispatchedItems.length}
              filtersOn={hasAnyFilter}
            />

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
            canMutateDispatch={canMutateDispatch}
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

      <FilterSheet
        visible={filterOpen}
        onClose={() =>
          setFilterOpen(false)
        }
        itemNameFilter={itemNameFilter}
        setItemNameFilter={setItemNameFilter}
        statusOptions={statusOptions}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        plantOptions={plantOptions}
        plantFilter={plantFilter}
        setPlantFilter={setPlantFilter}
        locationOptions={locationOptions}
        locationFilter={locationFilter}
        setLocationFilter={setLocationFilter}
        clearFilters={clearFilters}
      />
    </View>
  );
}

function ActiveFilterStrip({
  search,
  itemNameFilter,
  statusFilter,
  plantFilter,
  locationFilter,
  hasAnyFilter,
  onClear,
}) {
  if (!hasAnyFilter) {
    return null;
  }

  const chips = [];

  if (search.trim()) {
    chips.push(`Search: ${search.trim()}`);
  }

  if (itemNameFilter.trim()) {
    chips.push(`Name: ${itemNameFilter.trim()}`);
  }

  if (statusFilter !== "ALL") {
    chips.push(formatStatus(statusFilter));
  }

  if (plantFilter !== "ALL") {
    chips.push(`Plant: ${plantFilter}`);
  }

  if (locationFilter !== "ALL") {
    chips.push(`Location: ${locationFilter}`);
  }

  return (
    <View style={styles.activeStripWrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.activeStrip}
      >
        {chips.map((chip, index) => (
          <View
            key={`${chip}-${index}`}
            style={styles.activeChip}
          >
            <Text
              style={styles.activeChipText}
              numberOfLines={1}
            >
              {chip}
            </Text>
          </View>
        ))}

        <TouchableOpacity
          style={styles.activeClearBtn}
          onPress={onClear}
        >
          <Text style={styles.activeClearText}>
            Clear
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function CompactStats({
  showing,
  total,
  ready,
  readyDispatch,
  dispatched,
  filtersOn,
}) {
  return (
    <View style={styles.statsGrid}>
      <MiniStat
        label="Showing"
        value={showing}
      />

      <MiniStat
        label="Ready"
        value={ready}
      />

      <MiniStat
        label="R.T.D."
        value={readyDispatch}
      />

      <MiniStat
        label="Dispatched"
        value={dispatched}
      />

      <MiniStat
        label="Total"
        value={total}
      />

      <MiniStat
        label="Filters"
        value={filtersOn ? "ON" : "OFF"}
        active={filtersOn}
      />
    </View>
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
      <Text style={styles.miniStatValue}>
        {value}
      </Text>

      <Text style={styles.miniStatLabel}>
        {label}
      </Text>
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
      <View style={styles.paginationTop}>
        <Text style={styles.paginationText}>
          Page {pageNo}/{totalPages}
        </Text>

        <Text style={styles.paginationSubText}>
          {totalItems} items
        </Text>
      </View>

      <View style={styles.paginationRow}>
        <View style={styles.pageSizes}>
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
        </View>

        <View style={styles.pageNav}>
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
              ‹
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
              ›
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function FilterSheet({
  visible,
  onClose,
  itemNameFilter,
  setItemNameFilter,
  statusOptions,
  statusFilter,
  setStatusFilter,
  plantOptions,
  plantFilter,
  setPlantFilter,
  locationOptions,
  locationFilter,
  setLocationFilter,
  clearFilters,
}) {
  const handleClear = () => {
    clearFilters();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={onClose}
        />

        <View style={styles.filterSheet}>
          <View style={styles.filterHeader}>
            <View>
              <Text style={styles.filterSheetTitle}>
                Filters
              </Text>

              <Text style={styles.filterSheetSub}>
                Choose name, status, plant and location
              </Text>
            </View>

            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={onClose}
            >
              <Text style={styles.modalCloseText}>
                ×
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingBottom: 12,
            }}
          >
            <View style={styles.sheetField}>
              <Text style={styles.sheetLabel}>
                Item Name
              </Text>

              <TextInput
                value={itemNameFilter}
                onChangeText={setItemNameFilter}
                placeholder="Type item name..."
                placeholderTextColor="#64748b"
                style={styles.sheetInput}
                autoCapitalize="none"
              />
            </View>

            <FilterGroup
              title="Status"
              options={statusOptions}
              selected={statusFilter}
              onSelect={setStatusFilter}
            />

            <FilterGroup
              title="Plant"
              options={plantOptions}
              selected={plantFilter}
              onSelect={setPlantFilter}
            />

            <FilterGroup
              title="Location"
              options={locationOptions}
              selected={locationFilter}
              onSelect={setLocationFilter}
            />
          </ScrollView>

          <View style={styles.sheetActions}>
            <TouchableOpacity
              style={styles.sheetClearBtn}
              onPress={handleClear}
            >
              <Text style={styles.sheetClearText}>
                Clear All
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sheetApplyBtn}
              onPress={onClose}
            >
              <Text style={styles.sheetApplyText}>
                Apply Filters
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function FilterGroup({
  title,
  options,
  selected,
  onSelect,
}) {
  return (
    <View style={styles.filterGroup}>
      <Text style={styles.sheetLabel}>
        {title}
      </Text>

      <View style={styles.filterChipWrap}>
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
                {formatStatus(option)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function ItemCard({
  item,
  reload,
  canMutateDispatch = false,
}) {
  const status =
    normalizeStatus(item.status);

  const canMarkReadyToDispatchAction =
    canMarkReadyToDispatch(item);

  const needsFgAction =
    needsFgBeforeDispatch(item);

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
          <Text
            style={styles.itemName}
            numberOfLines={2}
          >
            {getItemName(item)}
          </Text>

          <Text style={styles.meta}>
            SKU: {cleanValue(
              getDisplaySku(item)
            )}
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
            {formatStatus(status) || "—"}
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
          value={
            getDisplayPlantCode(item) ||
            "—"
          }
        />

        <Info
          label="Location"
          value={getItemLocation(item)}
        />

        <Info
          label="Item ID"
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

      {needsFgAction ? (
        <View style={styles.fgWarningBox}>
          <Text style={styles.fgWarningTitle}>
            Move to FG first
          </Text>

          <Text style={styles.fgWarningText}>
            This plant-tracked item must be in its FG area before it can be marked Ready To Dispatch.
          </Text>
        </View>
      ) : null}

      {canMutateDispatch &&
      canMarkReadyToDispatchAction ? (
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
                getBackendMessage(
                  e,
                  "Unable to update item"
                )
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
    fontSize: 25,
    fontWeight: "900",
  },

  sub: {
    color: "#94a3b8",
    marginTop: 4,
    marginBottom: 12,
    fontWeight: "700",
    fontSize: 12,
    lineHeight: 18,
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
    marginBottom: 8,
  },

  searchIcon: {
    fontSize: 17,
    marginRight: 8,
  },

  searchInput: {
    flex: 1,
    color: "#fff",
    fontWeight: "800",
    fontSize: 12,
    minHeight: 48,
  },

  searchClear: {
    width: 27,
    height: 27,
    borderRadius: 999,
    backgroundColor: "rgba(148,163,184,.18)",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 6,
  },

  searchClearText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 18,
    lineHeight: 20,
  },

  filterOpenBtn: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: "rgba(59,130,246,.12)",
    borderWidth: 1,
    borderColor: "rgba(59,130,246,.25)",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
    position: "relative",
  },

  filterOpenBtnActive: {
    backgroundColor: "rgba(16,185,129,.16)",
    borderColor: "rgba(16,185,129,.35)",
  },

  filterOpenText: {
    color: "#93c5fd",
    fontWeight: "900",
    fontSize: 17,
  },

  filterOpenTextActive: {
    color: "#6ee7b7",
  },

  filterCountBadge: {
    position: "absolute",
    top: -6,
    right: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#ef4444",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#020617",
  },

  filterCountText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 10,
  },

  activeStripWrap: {
    marginBottom: 9,
  },

  activeStrip: {
    gap: 7,
    paddingRight: 10,
  },

  activeChip: {
    maxWidth: 180,
    minHeight: 28,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "rgba(16,185,129,.12)",
    borderWidth: 1,
    borderColor: "rgba(16,185,129,.22)",
    justifyContent: "center",
  },

  activeChipText: {
    color: "#6ee7b7",
    fontWeight: "900",
    fontSize: 10,
  },

  activeClearBtn: {
    minHeight: 28,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "rgba(239,68,68,.12)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,.24)",
    justifyContent: "center",
  },

  activeClearText: {
    color: "#fca5a5",
    fontWeight: "900",
    fontSize: 10,
  },

  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },

  miniStat: {
    width: "31.6%",
    minHeight: 54,
    borderRadius: 14,
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.08)",
    paddingHorizontal: 10,
    paddingVertical: 8,
    justifyContent: "center",
  },

  miniStatActive: {
    borderColor: "rgba(16,185,129,.32)",
    backgroundColor: "rgba(16,185,129,.08)",
  },

  miniStatValue: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 16,
  },

  miniStatLabel: {
    color: "#94a3b8",
    fontWeight: "800",
    fontSize: 10,
    marginTop: 2,
  },

  paginationBox: {
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.08)",
    borderRadius: 15,
    padding: 10,
    marginBottom: 12,
  },

  paginationTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },

  paginationText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 12,
  },

  paginationSubText: {
    color: "#94a3b8",
    fontWeight: "800",
    fontSize: 11,
  },

  paginationRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  pageSizes: {
    flexDirection: "row",
    gap: 7,
  },

  pageSizeBtn: {
    minWidth: 38,
    height: 30,
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
    fontSize: 11,
  },

  pageSizeTextActive: {
    color: "#93c5fd",
  },

  pageNav: {
    flexDirection: "row",
    gap: 8,
  },

  pageBtn: {
    width: 36,
    height: 30,
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
    fontSize: 18,
    lineHeight: 20,
  },

  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,.55)",
  },

  modalBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },

  filterSheet: {
    maxHeight: "86%",
    backgroundColor: "#020617",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.10)",
    padding: 16,
  },

  filterHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
  },

  filterSheetTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "900",
  },

  filterSheetSub: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 3,
  },

  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,.07)",
    alignItems: "center",
    justifyContent: "center",
  },

  modalCloseText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 24,
    lineHeight: 26,
  },

  sheetField: {
    marginBottom: 15,
  },

  sheetLabel: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "900",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },

  sheetInput: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.10)",
    backgroundColor: "rgba(255,255,255,.05)",
    color: "#fff",
    paddingHorizontal: 13,
    fontWeight: "800",
    fontSize: 13,
  },

  filterGroup: {
    marginBottom: 15,
  },

  filterChipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  filterChip: {
    minHeight: 34,
    paddingHorizontal: 12,
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
    fontSize: 10.5,
    fontWeight: "900",
  },

  filterChipTextActive: {
    color: "#93c5fd",
  },

  sheetActions: {
    flexDirection: "row",
    gap: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,.08)",
  },

  sheetClearBtn: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    backgroundColor: "rgba(239,68,68,.12)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,.28)",
    alignItems: "center",
    justifyContent: "center",
  },

  sheetClearText: {
    color: "#fca5a5",
    fontWeight: "900",
  },

  sheetApplyBtn: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
  },

  sheetApplyText: {
    color: "#fff",
    fontWeight: "900",
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
    maxWidth: 150,
    marginLeft: 10,
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
    fontSize: 9.5,
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

  fgWarningBox: {
    marginTop: 12,
    borderRadius: 12,
    padding: 11,
    backgroundColor: "rgba(245,158,11,.08)",
    borderWidth: 1,
    borderColor: "rgba(245,158,11,.22)",
  },

  fgWarningTitle: {
    color: "#facc15",
    fontWeight: "900",
    fontSize: 12,
  },

  fgWarningText: {
    color: "#cbd5e1",
    fontWeight: "700",
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
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