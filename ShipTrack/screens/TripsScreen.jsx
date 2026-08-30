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
  Modal,
  Platform,
  TextInput,
  ScrollView,
} from "react-native";

import DateTimePicker from "@react-native-community/datetimepicker";

import {
  useFocusEffect,
} from "@react-navigation/native";

import {
  safeOpenChallanPdf,
} from "../api/challanDownloadApi";

import {
  useAuth,
} from "../auth/AuthContext";

import {
  fetchDispatchedChallans,
  endDispatchedChallanTrip,
} from "../api/logisticsApi";

import {
  getBackendMessage,
} from "../api/client";

import {
  getDisplayPlantCode,
  getDisplaySku,
} from "../api/operationalMetadataApi";

import SiteProofInspectorModal, {
  SiteStatusPill,
} from "../components/SiteProofInspectorModal";

import {
  fetchSiteLifecycleMetadataMap,
  getSiteMetadataForItem,
  getSitePacketItemId,
  normalizeSiteStatus,
  siteStatusLabel,
  siteSummaryLabel,
  summarizeSiteLifecycle,
} from "../api/siteLifecycleApi";

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function normalizeStatus(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function formatStatus(value) {
  const text =
    String(value || "").trim();

  if (!text || text === "ALL") {
    return "All";
  }

  return text.replace(/_/g, " ");
}


function getTripStatus(challan) {
  if (challan?.tripEndedAt) {
    return "ENDED";
  }

  return (
    normalizeStatus(challan?.tripStatus) ||
    "RUNNING"
  );
}

function isTripEnded(challan) {
  return [
    "ENDED",
    "COMPLETED",
    "DELIVERED",
  ].includes(
    getTripStatus(challan)
  );
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

function formatDuration(minutes) {
  if (
    minutes === null ||
    minutes === undefined ||
    Number.isNaN(Number(minutes))
  ) {
    return "—";
  }

  const total =
    Math.max(0, Number(minutes));

  const hours =
    Math.floor(total / 60);

  const mins =
    total % 60;

  if (hours <= 0) {
    return `${mins} min`;
  }

  return `${hours} hr ${mins} min`;
}

function getNowDateTimeLocal() {
  const d =
    new Date();

  d.setMinutes(
    d.getMinutes() - d.getTimezoneOffset()
  );

  return d.toISOString().slice(0, 16);
}

function toBackendLocalDateTime(value) {
  if (!value) {
    return null;
  }

  return value.length === 16
    ? `${value}:00`
    : value;
}

function toDateTimeLocalInput(value) {
  if (!value) {
    return "";
  }

  const raw =
    String(value).trim();

  const match =
    raw.match(
      /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/
    );

  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}`;
  }

  return "";
}

function parseLocalDateTime(value) {
  if (!value) {
    return new Date();
  }

  const raw =
    String(value).trim();

  const match =
    raw.match(
      /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/
    );

  if (match) {
    return new Date(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      Number(match[4]),
      Number(match[5]),
      Number(match[6] || 0)
    );
  }

  const fallback =
    new Date(raw);

  return Number.isNaN(fallback.getTime())
    ? new Date()
    : fallback;
}

function dateToLocalInputValue(date) {
  const d =
    date instanceof Date &&
      !Number.isNaN(date.getTime())
      ? date
      : new Date();

  const yyyy =
    d.getFullYear();

  const mm =
    String(d.getMonth() + 1).padStart(2, "0");

  const dd =
    String(d.getDate()).padStart(2, "0");

  const hh =
    String(d.getHours()).padStart(2, "0");

  const mi =
    String(d.getMinutes()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function formatPickerDisplay(value) {
  return formatDateTime(
    toBackendLocalDateTime(value)
  );
}

function getItemLocation(item) {
  return (
    item?.currentLocationCode ||
    item?.location ||
    item?.warehouseCode ||
    item?.fgZoneCode ||
    "—"
  );
}

function getChallanSearchBlob(challan) {
  const itemText =
    (challan.items || [])
      .map((item) =>
        [
          item.name,
          item.itemName,
          getDisplaySku(item),
          item.pdNo,
          item.drawingNo,
          item.clientName,
          item.description,
          item.remarks,
          getDisplayPlantCode(item),
          item.currentLocationCode,
          item.location,
          item.status,
        ]
          .map(normalizeText)
          .join(" ")
      )
      .join(" ");

  return [
    challan.challanNumber,
    challan.driverName,
    challan.vehicleNumber,
    challan.dispatchedBy,
    challan.tripStatus,
    itemText,
  ]
    .map(normalizeText)
    .join(" ");
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

  const [search, setSearch] =
    useState("");

  const [filterOpen, setFilterOpen] =
    useState(false);

  const [challanFilter, setChallanFilter] =
    useState("");

  const [itemNameFilter, setItemNameFilter] =
    useState("");

  const [driverFilter, setDriverFilter] =
    useState("ALL");

  const [vehicleFilter, setVehicleFilter] =
    useState("ALL");

  const [tripStatusFilter, setTripStatusFilter] =
    useState("ALL");

  const [plantFilter, setPlantFilter] =
    useState("ALL");

  const [locationFilter, setLocationFilter] =
    useState("ALL");

  const [pageNo, setPageNo] =
    useState(1);

  const [pageSize, setPageSize] =
    useState(10);

  const {
    hasAnyRole,
  } = useAuth();

  const canManageTripEnd =
    hasAnyRole(
      "LOGISTICS",
      "ADMIN"
    );

  const canViewSiteProof =
    hasAnyRole(
      "ADMIN",
      "DISPATCH",
      "UTL_DISPATCH",
      "LOGISTICS"
    );

  const [endTripDrafts, setEndTripDrafts] =
    useState({});

  const [savingEndTrip, setSavingEndTrip] =
    useState("");

  const [
    siteLifecycleMetadata,
    setSiteLifecycleMetadata,
  ] = useState({});

  const [
    siteProofItem,
    setSiteProofItem,
  ] = useState(null);

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
      Alert.alert(
        "Challans failed",
        getBackendMessage(
          e,
          "Failed to load dispatched challans"
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
        await fetchDispatchedChallans();

      setChallans(
        Array.isArray(data)
          ? data
          : []
      );
    } catch (e) {
      Alert.alert(
        "Refresh failed",
        getBackendMessage(
          e,
          "Failed to refresh challans"
        )
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

  const driverOptions =
    useMemo(() => {
      const values =
        challans
          .map((x) =>
            String(x.driverName || "").trim()
          )
          .filter(Boolean);

      return [
        "ALL",
        ...Array.from(new Set(values)).sort(),
      ];
    }, [challans]);

  const vehicleOptions =
    useMemo(() => {
      const values =
        challans
          .map((x) =>
            String(x.vehicleNumber || "").trim()
          )
          .filter(Boolean);

      return [
        "ALL",
        ...Array.from(new Set(values)).sort(),
      ];
    }, [challans]);

  const tripStatusOptions =
    useMemo(() => {
      const values =
        challans
          .map((x) =>
            getTripStatus(x)
          )
          .filter(Boolean);

      return [
        "ALL",
        ...Array.from(new Set(values)).sort(),
      ];
    }, [challans]);

  const plantOptions =
    useMemo(() => {
      const values = [];

      challans.forEach((challan) => {
        (challan.items || []).forEach((item) => {
          const plant =
            getDisplayPlantCode(item);

          if (plant) {
            values.push(plant);
          }
        });
      });

      return [
        "ALL",
        ...Array.from(new Set(values)).sort(),
      ];
    }, [challans]);

  const locationOptions =
    useMemo(() => {
      const values = [];

      challans.forEach((challan) => {
        (challan.items || []).forEach((item) => {
          const location =
            getItemLocation(item);

          if (location && location !== "—") {
            values.push(location);
          }
        });
      });

      return [
        "ALL",
        ...Array.from(new Set(values)).sort(),
      ];
    }, [challans]);

  const filteredChallans =
    useMemo(() => {
      const query =
        normalizeText(search);

      const challanQuery =
        normalizeText(challanFilter);

      const itemNameQuery =
        normalizeText(itemNameFilter);

      return challans.filter((challan) => {
        const blob =
          getChallanSearchBlob(challan);

        const matchesSearch =
          !query ||
          blob.includes(query);

        const matchesChallan =
          !challanQuery ||
          normalizeText(challan.challanNumber).includes(challanQuery);

        const matchesDriver =
          driverFilter === "ALL" ||
          String(challan.driverName || "").trim() === driverFilter;

        const matchesVehicle =
          vehicleFilter === "ALL" ||
          String(challan.vehicleNumber || "").trim() === vehicleFilter;

        const challanTripStatus =
          getTripStatus(challan);

        const matchesTripStatus =
          tripStatusFilter === "ALL" ||
          challanTripStatus === tripStatusFilter;

        const items =
          Array.isArray(challan.items)
            ? challan.items
            : [];

        const matchesItemName =
          !itemNameQuery ||
          items.some((item) =>
            normalizeText(
              item.name ||
              item.itemName ||
              item.clientName ||
              ""
            ).includes(itemNameQuery)
          );

        const matchesPlant =
          plantFilter === "ALL" ||
          items.some(
            (item) =>
              getDisplayPlantCode(item) === plantFilter
          );

        const matchesLocation =
          locationFilter === "ALL" ||
          items.some(
            (item) =>
              getItemLocation(item) === locationFilter
          );

        return (
          matchesSearch &&
          matchesChallan &&
          matchesDriver &&
          matchesVehicle &&
          matchesTripStatus &&
          matchesItemName &&
          matchesPlant &&
          matchesLocation
        );
      });
    }, [
      challans,
      search,
      challanFilter,
      itemNameFilter,
      driverFilter,
      vehicleFilter,
      tripStatusFilter,
      plantFilter,
      locationFilter,
    ]);

  const totalPages =
    useMemo(
      () =>
        Math.max(
          1,
          Math.ceil(filteredChallans.length / pageSize)
        ),
      [filteredChallans.length, pageSize]
    );

  const currentPage =
    Math.min(pageNo, totalPages);

  const paginatedChallans =
    useMemo(
      () =>
        filteredChallans.slice(
          (currentPage - 1) * pageSize,
          currentPage * pageSize
        ),
      [filteredChallans, currentPage, pageSize]
    );

  /*
   * Only hydrate site lifecycle metadata for the challans visible on this
   * screen page. This preserves the bounded challan list behavior while still
   * giving Dispatch/Admin live site status and evidence counts.
   */
  useEffect(() => {
    let cancelled = false;

    if (!canViewSiteProof) {
      setSiteLifecycleMetadata({});
      return undefined;
    }

    const packetItemIds =
      paginatedChallans
        .flatMap((challan) =>
          Array.isArray(challan?.items)
            ? challan.items
            : []
        )
        .map(getSitePacketItemId)
        .filter(Boolean);

    if (packetItemIds.length === 0) {
      return undefined;
    }

    fetchSiteLifecycleMetadataMap(
      packetItemIds
    )
      .then((metadata) => {
        if (!cancelled) {
          setSiteLifecycleMetadata(
            (current) => ({
              ...current,
              ...metadata,
            })
          );
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.debug(
            "Challan site lifecycle metadata unavailable:",
            error?.message || error
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    canViewSiteProof,
    paginatedChallans,
  ]);

  useEffect(() => {
    setPageNo(1);
  }, [
    search,
    challanFilter,
    itemNameFilter,
    driverFilter,
    vehicleFilter,
    tripStatusFilter,
    plantFilter,
    locationFilter,
    pageSize,
  ]);

  useEffect(() => {
    if (pageNo > totalPages) {
      setPageNo(totalPages);
    }
  }, [pageNo, totalPages]);

  const totalItems =
    useMemo(
      () =>
        filteredChallans.reduce(
          (sum, challan) =>
            sum +
            Number(
              challan.totalItems ||
              challan.items?.length ||
              0
            ),
          0
        ),
      [filteredChallans]
    );

  const runningTrips =
    useMemo(
      () =>
        filteredChallans.filter(
          (challan) =>
            !isTripEnded(challan)
        ).length,
      [filteredChallans]
    );

  const endedTrips =
    useMemo(
      () =>
        filteredChallans.filter(
          (challan) =>
            isTripEnded(challan)
        ).length,
      [filteredChallans]
    );

  const filterCount =
    [
      challanFilter.trim(),
      itemNameFilter.trim(),
      driverFilter !== "ALL",
      vehicleFilter !== "ALL",
      tripStatusFilter !== "ALL",
      plantFilter !== "ALL",
      locationFilter !== "ALL",
    ].filter(Boolean).length;

  const hasAnyFilter =
    Boolean(search.trim()) ||
    filterCount > 0;

  const clearFilters = () => {
    setSearch("");
    setChallanFilter("");
    setItemNameFilter("");
    setDriverFilter("ALL");
    setVehicleFilter("ALL");
    setTripStatusFilter("ALL");
    setPlantFilter("ALL");
    setLocationFilter("ALL");
  };

  const getEndTripDraft = (challan) => {
    const challanNumber =
      challan?.challanNumber || "";

    if (endTripDrafts[challanNumber]) {
      return endTripDrafts[challanNumber];
    }

    const existingEnd =
      toDateTimeLocalInput(challan?.tripEndedAt);

    if (existingEnd) {
      return existingEnd;
    }

    return getNowDateTimeLocal();
  };

  const updateEndTripDraft = (
    challanNumber,
    value
  ) => {
    setEndTripDrafts((prev) => ({
      ...prev,
      [challanNumber]: value,
    }));
  };

  const submitEndTrip = async (challan) => {
    const challanNumber =
      challan?.challanNumber || "";

    if (!challanNumber) {
      Alert.alert(
        "Missing challan",
        "Challan number missing."
      );
      return;
    }

    const value =
      getEndTripDraft(challan);

    if (!value) {
      Alert.alert(
        "End time required",
        "Please enter trip end time."
      );
      return;
    }

    try {
      setSavingEndTrip(challanNumber);

      await endDispatchedChallanTrip(
        challanNumber,
        toBackendLocalDateTime(value)
      );

      Alert.alert(
        "Saved",
        "Trip end time saved successfully."
      );

      await loadChallans();
    } catch (e) {
      Alert.alert(
        "Save failed",
        getBackendMessage(
          e,
          "Unable to save trip end time"
        )
      );
    } finally {
      setSavingEndTrip("");
    }
  };

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
          Trips with Challans
        </Text>

        <Text style={styles.sub}>
          Challan-wise trips with driver, vehicle, items and end-time control
        </Text>
      </View>

      <FlatList
        data={paginatedChallans}
        keyExtractor={(item, index) =>
          String(
            item.challanNumber ||
            `challan-${index}`
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
                placeholder="Search challan, driver, vehicle, item, client..."
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
              challanFilter={challanFilter}
              itemNameFilter={itemNameFilter}
              driverFilter={driverFilter}
              vehicleFilter={vehicleFilter}
              tripStatusFilter={tripStatusFilter}
              plantFilter={plantFilter}
              locationFilter={locationFilter}
              hasAnyFilter={hasAnyFilter}
              onClear={clearFilters}
            />

            <CompactStats
              challans={filteredChallans.length}
              items={totalItems}
              running={runningTrips}
              ended={endedTrips}
              total={challans.length}
              filtersOn={hasAnyFilter}
            />

            <PaginationBar
              pageNo={currentPage}
              totalPages={totalPages}
              pageSize={pageSize}
              setPageNo={setPageNo}
              setPageSize={setPageSize}
              totalItems={filteredChallans.length}
            />
          </View>
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
            canManageTripEnd={canManageTripEnd}
            canViewSiteProof={canViewSiteProof}
            siteLifecycleMetadata={siteLifecycleMetadata}
            onOpenSiteProof={(packetItem) =>
              setSiteProofItem(packetItem)
            }
            endTimeValue={getEndTripDraft(item)}
            savingEndTrip={
              savingEndTrip === item.challanNumber
            }
            onEndTimeChange={(value) =>
              updateEndTripDraft(
                item.challanNumber,
                value
              )
            }
            onSaveEndTime={() =>
              submitEndTrip(item)
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

      <FilterSheet
        visible={filterOpen}
        onClose={() =>
          setFilterOpen(false)
        }
        challanFilter={challanFilter}
        setChallanFilter={setChallanFilter}
        itemNameFilter={itemNameFilter}
        setItemNameFilter={setItemNameFilter}
        driverOptions={driverOptions}
        driverFilter={driverFilter}
        setDriverFilter={setDriverFilter}
        vehicleOptions={vehicleOptions}
        vehicleFilter={vehicleFilter}
        setVehicleFilter={setVehicleFilter}
        tripStatusOptions={tripStatusOptions}
        tripStatusFilter={tripStatusFilter}
        setTripStatusFilter={setTripStatusFilter}
        plantOptions={plantOptions}
        plantFilter={plantFilter}
        setPlantFilter={setPlantFilter}
        locationOptions={locationOptions}
        locationFilter={locationFilter}
        setLocationFilter={setLocationFilter}
        clearFilters={clearFilters}
      />

      <SiteProofInspectorModal
        visible={Boolean(siteProofItem)}
        item={siteProofItem}
        metadata={
          siteProofItem
            ? getSiteMetadataForItem(
                siteProofItem,
                siteLifecycleMetadata
              )
            : null
        }
        onClose={() =>
          setSiteProofItem(null)
        }
      />
    </View>
  );
}

function ActiveFilterStrip({
  search,
  challanFilter,
  itemNameFilter,
  driverFilter,
  vehicleFilter,
  tripStatusFilter,
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

  if (challanFilter.trim()) {
    chips.push(`Challan: ${challanFilter.trim()}`);
  }

  if (itemNameFilter.trim()) {
    chips.push(`Name: ${itemNameFilter.trim()}`);
  }

  if (driverFilter !== "ALL") {
    chips.push(`Driver: ${driverFilter}`);
  }

  if (vehicleFilter !== "ALL") {
    chips.push(`Vehicle: ${vehicleFilter}`);
  }

  if (tripStatusFilter !== "ALL") {
    chips.push(formatStatus(tripStatusFilter));
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
  challans,
  items,
  running,
  ended,
  total,
  filtersOn,
}) {
  return (
    <View style={styles.statsGrid}>
      <MiniStat
        label="Challans"
        value={challans}
      />

      <MiniStat
        label="Items"
        value={items}
      />

      <MiniStat
        label="Running"
        value={running}
        active={running > 0}
      />

      <MiniStat
        label="Ended"
        value={ended}
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
          {totalItems} challans
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
  challanFilter,
  setChallanFilter,
  itemNameFilter,
  setItemNameFilter,
  driverOptions,
  driverFilter,
  setDriverFilter,
  vehicleOptions,
  vehicleFilter,
  setVehicleFilter,
  tripStatusOptions,
  tripStatusFilter,
  setTripStatusFilter,
  plantOptions,
  plantFilter,
  setPlantFilter,
  locationOptions,
  locationFilter,
  setLocationFilter,
  clearFilters,
}) {
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
                Trip Filters
              </Text>

              <Text style={styles.filterSheetSub}>
                Filter by challan, name, driver, vehicle, status, plant and location
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
                Challan No.
              </Text>

              <TextInput
                value={challanFilter}
                onChangeText={setChallanFilter}
                placeholder="Type challan no..."
                placeholderTextColor="#64748b"
                style={styles.sheetInput}
                autoCapitalize="none"
              />
            </View>

            <View style={styles.sheetField}>
              <Text style={styles.sheetLabel}>
                Item / Client Name
              </Text>

              <TextInput
                value={itemNameFilter}
                onChangeText={setItemNameFilter}
                placeholder="Type item or client name..."
                placeholderTextColor="#64748b"
                style={styles.sheetInput}
                autoCapitalize="none"
              />
            </View>

            <FilterGroup
              title="Trip Status"
              options={tripStatusOptions}
              selected={tripStatusFilter}
              onSelect={setTripStatusFilter}
            />

            <FilterGroup
              title="Driver"
              options={driverOptions}
              selected={driverFilter}
              onSelect={setDriverFilter}
            />

            <FilterGroup
              title="Vehicle"
              options={vehicleOptions}
              selected={vehicleFilter}
              onSelect={setVehicleFilter}
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
              onPress={clearFilters}
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
                numberOfLines={1}
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

function ChallanCard({
  challan,
  expanded,
  canManageTripEnd,
  canViewSiteProof = false,
  siteLifecycleMetadata = {},
  onOpenSiteProof,
  endTimeValue,
  savingEndTrip,
  onEndTimeChange,
  onSaveEndTime,
  onToggle,
}) {
  const driverName =
    challan?.driverName || "—";

  const vehicleNo =
    challan?.vehicleNumber || "—";

  const items =
    Array.isArray(challan?.items)
      ? challan.items
      : [];

  const siteSummary =
    summarizeSiteLifecycle(
      items,
      siteLifecycleMetadata
    );

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.challan}>
            {challan?.challanNumber || "—"}
          </Text>

          <Text style={styles.meta}>
            {driverName} • {vehicleNo}
          </Text>

          <Text style={styles.smallMeta}>
            By {challan?.dispatchedBy || "—"} •{" "}
            {formatDateTime(challan?.dispatchedAt)}
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
            challan?.totalItems ||
            items.length ||
            0
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
          label="Trip Start"
          value={formatDateTime(
            challan?.tripStartedAt
          )}
        />

        <Info
          label="Trip End"
          value={formatDateTime(
            challan?.tripEndedAt
          )}
        />

        <Info
          label="Duration"
          value={formatDuration(
            challan?.tripDurationMinutes
          )}
        />

        <Info
          label="Trip Status"
          value={getTripStatus(challan)}
        />

        <Info
          label="Dispatch Time"
          value={formatDateTime(
            challan?.dispatchedAt
          )}
        />
      </View>

      {canViewSiteProof &&
      siteSummary.linkedPackets > 0 ? (
        <View style={styles.challanSiteBox}>
          <View style={styles.challanSiteHead}>
            <View style={{ flex: 1 }}>
              <Text style={styles.challanSiteKicker}>
                SITE PROOF
              </Text>

              <Text style={styles.challanSiteTitle}>
                {siteSummaryLabel(
                  siteSummary
                )}
              </Text>
            </View>

            <Text style={styles.challanSitePhotos}>
              {siteSummary.evidencePhotos} evidence photo{
                siteSummary.evidencePhotos === 1
                  ? ""
                  : "s"
              }
            </Text>
          </View>

          <View style={styles.challanSiteCounts}>
            <ChallanSiteStat
              label="Awaiting"
              value={siteSummary.awaiting}
            />

            <ChallanSiteStat
              label="Delivered"
              value={siteSummary.delivered}
            />

            <ChallanSiteStat
              label="Opened"
              value={siteSummary.opened}
            />
          </View>
        </View>
      ) : null}

      {canManageTripEnd ? (
        <EndTimePickerPanel
          challan={challan}
          value={endTimeValue}
          onChange={onEndTimeChange}
          onSave={onSaveEndTime}
          saving={savingEndTrip}
        />
      ) : null}

      <TouchableOpacity
        style={styles.challanBtn}
        onPress={() =>
          safeOpenChallanPdf(
            challan?.challanNumber
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

      {expanded ? (
        <View style={styles.itemsBox}>
          {items.length === 0 ? (
            <Text style={styles.noItems}>
              No items found in this challan.
            </Text>
          ) : (
            items.map((item, index) => (
              <View
                key={
                  item?.zohoItemId ||
                  item?.packetItemId ||
                  `${challan?.challanNumber}-${index}`
                }
                style={styles.itemCard}
              >
                <Text
                  style={styles.itemName}
                  numberOfLines={2}
                >
                  {index + 1}.{" "}
                  {item?.name ||
                    item?.itemName ||
                    "—"}
                </Text>

                <Text
                  style={styles.itemMeta}
                  numberOfLines={2}
                >
                  SKU: {getDisplaySku(item) || "—"}
                </Text>

                <Text style={styles.itemMeta}>
                  PD: {item?.pdNo || "—"} • Client:{" "}
                  {item?.clientName || "—"}
                </Text>

                <Text style={styles.itemMeta}>
                  Plant: {getDisplayPlantCode(item) || "—"} • Location:{" "}
                  {item?.currentLocationCode ||
                    item?.location ||
                    "—"}
                </Text>

                <Text style={styles.itemMeta}>
                  Status: {item?.status || "DISPATCHED"}
                </Text>

                {canViewSiteProof &&
                getSitePacketItemId(item) ? (
                  <>
                    <View style={styles.expandedSiteRow}>
                      <SiteStatusPill
                        status={normalizeSiteStatus(
                          getSiteMetadataForItem(
                            item,
                            siteLifecycleMetadata
                          )?.siteStatus
                        )}
                      />

                      <Text style={styles.expandedSiteCount}>
                        {Number(
                          getSiteMetadataForItem(
                            item,
                            siteLifecycleMetadata
                          )?.deliveryPhotoCount ||
                          0
                        ) +
                          Number(
                            getSiteMetadataForItem(
                              item,
                              siteLifecycleMetadata
                            )?.openingPhotoCount ||
                            0
                          )} photo(s)
                      </Text>
                    </View>

                    <Text style={styles.itemMeta}>
                      Site:{" "}
                      {siteStatusLabel(
                        getSiteMetadataForItem(
                          item,
                          siteLifecycleMetadata
                        )?.siteStatus
                      )}
                    </Text>

                    <TouchableOpacity
                      style={styles.expandedSiteBtn}
                      onPress={() =>
                        onOpenSiteProof?.(item)
                      }
                    >
                      <Text style={styles.expandedSiteBtnText}>
                        Site Info / Evidence
                      </Text>
                    </TouchableOpacity>
                  </>
                ) : null}
              </View>
            ))
          )}
        </View>
      ) : null}
    </View>
  );
}

function ChallanSiteStat({
  label,
  value,
}) {
  return (
    <View style={styles.challanSiteStat}>
      <Text style={styles.challanSiteStatValue}>
        {value}
      </Text>

      <Text style={styles.challanSiteStatLabel}>
        {label}
      </Text>
    </View>
  );
}

function EndTimePickerPanel({
  challan,
  value,
  onChange,
  onSave,
  saving,
}) {
  const [pickerOpen, setPickerOpen] =
    useState(false);

  const [pickerMode, setPickerMode] =
    useState("date");

  const [tempDate, setTempDate] =
    useState(parseLocalDateTime(value));

  const openPicker = () => {
    setTempDate(
      parseLocalDateTime(value)
    );

    setPickerMode("date");
    setPickerOpen(true);
  };

  const applyNow = () => {
    onChange(
      dateToLocalInputValue(new Date())
    );
  };

  const addMinutes = (minutes) => {
    const base =
      parseLocalDateTime(value);

    base.setMinutes(
      base.getMinutes() + minutes
    );

    onChange(
      dateToLocalInputValue(base)
    );
  };

  const onAndroidChange = (
    event,
    selectedDate
  ) => {
    if (event?.type === "dismissed") {
      setPickerOpen(false);
      return;
    }

    if (!selectedDate) {
      return;
    }

    if (pickerMode === "date") {
      const merged =
        new Date(tempDate);

      merged.setFullYear(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        selectedDate.getDate()
      );

      setTempDate(merged);
      setPickerMode("time");
      return;
    }

    const finalDate =
      new Date(tempDate);

    finalDate.setHours(
      selectedDate.getHours(),
      selectedDate.getMinutes(),
      0,
      0
    );

    onChange(
      dateToLocalInputValue(finalDate)
    );

    setPickerOpen(false);
    setPickerMode("date");
  };

  const onIosChange = (
    event,
    selectedDate
  ) => {
    if (selectedDate) {
      setTempDate(selectedDate);
    }
  };

  const saveIosPicker = () => {
    onChange(
      dateToLocalInputValue(tempDate)
    );

    setPickerOpen(false);
  };

  return (
    <View style={styles.endTimePanel}>
      <View style={styles.endTimeTopRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.endTimeTitle}>
            Trip End Time
          </Text>

          <Text style={styles.endTimeSub}>
            {challan?.tripEndedAt
              ? "Existing end time can be edited."
              : "Select the actual trip closing time."}
          </Text>
        </View>

        <View style={styles.endStatusBadge}>
          <Text style={styles.endStatusText}>
            {challan?.tripEndedAt
              ? "ENDED"
              : "RUNNING"}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.datePickerBox}
        onPress={openPicker}
      >
        <Text style={styles.datePickerLabel}>
          Selected End Time
        </Text>

        <Text style={styles.datePickerValue}>
          {formatPickerDisplay(value)}
        </Text>

        <Text style={styles.datePickerHint}>
          Tap to choose date and time
        </Text>
      </TouchableOpacity>

      <View style={styles.quickTimeRow}>
        <TouchableOpacity
          style={styles.quickTimeBtn}
          onPress={applyNow}
        >
          <Text style={styles.quickTimeText}>
            Now
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickTimeBtn}
          onPress={() => addMinutes(30)}
        >
          <Text style={styles.quickTimeText}>
            +30 min
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickTimeBtn}
          onPress={() => addMinutes(60)}
        >
          <Text style={styles.quickTimeText}>
            +1 hr
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.endTimeBtn}
        onPress={onSave}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.endTimeBtnText}>
            {challan?.tripEndedAt
              ? "Update End Time"
              : "Save End Time"}
          </Text>
        )}
      </TouchableOpacity>

      {Platform.OS === "android" &&
        pickerOpen ? (
        <DateTimePicker
          value={tempDate}
          mode={pickerMode}
          display="default"
          is24Hour={false}
          onChange={onAndroidChange}
        />
      ) : null}

      {Platform.OS === "ios" ? (
        <Modal
          visible={pickerOpen}
          transparent
          animationType="fade"
          onRequestClose={() =>
            setPickerOpen(false)
          }
        >
          <View style={styles.pickerModalOverlay}>
            <View style={styles.pickerModalCard}>
              <Text style={styles.pickerModalTitle}>
                Select Trip End Time
              </Text>

              <DateTimePicker
                value={tempDate}
                mode="datetime"
                display="spinner"
                onChange={onIosChange}
              />

              <View style={styles.pickerModalActions}>
                <TouchableOpacity
                  style={styles.pickerCancelBtn}
                  onPress={() =>
                    setPickerOpen(false)
                  }
                >
                  <Text style={styles.pickerCancelText}>
                    Cancel
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.pickerSaveBtn}
                  onPress={saveIosPicker}
                >
                  <Text style={styles.pickerSaveText}>
                    Use Time
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
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

  header: {
    marginBottom: 10,
  },

  title: {
    color: "#fff",
    fontSize: 25,
    fontWeight: "900",
  },

  sub: {
    color: "#94a3b8",
    marginTop: 4,
    fontWeight: "700",
    lineHeight: 18,
    fontSize: 12,
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
    maxWidth: 190,
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
    maxWidth: 285,
    lineHeight: 17,
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
    maxWidth: "100%",
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
    maxWidth: 220,
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

  challanSiteBox: {
    marginTop: 12,
    borderRadius: 16,
    padding: 12,
    backgroundColor: "rgba(37,99,235,.08)",
    borderWidth: 1,
    borderColor: "rgba(96,165,250,.20)",
  },

  challanSiteHead: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },

  challanSiteKicker: {
    color: "#60a5fa",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: .7,
  },

  challanSiteTitle: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "900",
    marginTop: 3,
  },

  challanSitePhotos: {
    color: "#cbd5e1",
    fontSize: 10,
    fontWeight: "800",
    flexShrink: 1,
    textAlign: "right",
  },

  challanSiteCounts: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },

  challanSiteStat: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,.045)",
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: "center",
  },

  challanSiteStatValue: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "900",
  },

  challanSiteStatLabel: {
    color: "#94a3b8",
    fontSize: 8,
    fontWeight: "900",
    textTransform: "uppercase",
    marginTop: 2,
  },

  endTimePanel: {
    marginTop: 14,
    padding: 14,
    borderRadius: 18,
    backgroundColor: "rgba(239,68,68,.08)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,.22)",
  },

  endTimeTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
  },

  endTimeTitle: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 15,
  },

  endTimeSub: {
    color: "#94a3b8",
    fontWeight: "700",
    fontSize: 11,
    marginTop: 3,
    lineHeight: 16,
  },

  endStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(239,68,68,.16)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,.28)",
    marginLeft: 10,
  },

  endStatusText: {
    color: "#fca5a5",
    fontSize: 10,
    fontWeight: "900",
  },

  datePickerBox: {
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.10)",
    backgroundColor: "rgba(255,255,255,.045)",
    padding: 13,
    marginBottom: 10,
  },

  datePickerLabel: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  datePickerValue: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "900",
    marginTop: 5,
  },

  datePickerHint: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 4,
  },

  quickTimeRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },

  quickTimeBtn: {
    flex: 1,
    height: 36,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,.055)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.09)",
    alignItems: "center",
    justifyContent: "center",
  },

  quickTimeText: {
    color: "#cbd5e1",
    fontWeight: "900",
    fontSize: 11,
  },

  endTimeBtn: {
    height: 46,
    borderRadius: 14,
    backgroundColor: "#dc2626",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#dc2626",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 3,
  },

  endTimeBtnText: {
    color: "#fff",
    fontWeight: "900",
  },

  pickerModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,.65)",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
  },

  pickerModalCard: {
    width: "100%",
    borderRadius: 22,
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.12)",
    padding: 16,
  },

  pickerModalTitle: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 17,
    marginBottom: 12,
  },

  pickerModalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },

  pickerCancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,.06)",
    alignItems: "center",
    justifyContent: "center",
  },

  pickerCancelText: {
    color: "#cbd5e1",
    fontWeight: "900",
  },

  pickerSaveBtn: {
    flex: 1,
    height: 44,
    borderRadius: 13,
    backgroundColor: "#dc2626",
    alignItems: "center",
    justifyContent: "center",
  },

  pickerSaveText: {
    color: "#fff",
    fontWeight: "900",
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

  expandedSiteRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 10,
  },

  expandedSiteCount: {
    color: "#94a3b8",
    fontSize: 10,
    fontWeight: "800",
  },

  expandedSiteBtn: {
    minHeight: 38,
    marginTop: 9,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "rgba(96,165,250,.26)",
    backgroundColor: "rgba(37,99,235,.11)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },

  expandedSiteBtnText: {
    color: "#93c5fd",
    fontSize: 10,
    fontWeight: "900",
  },
};

