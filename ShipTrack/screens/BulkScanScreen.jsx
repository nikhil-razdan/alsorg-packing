import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import TripStartPicker from "../components/TripStartPicker";

import DriverVehicleFields from
  "../components/DriverVehicleFields";

import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Modal,
} from "react-native";

import {
  CameraView,
  useCameraPermissions,
} from "expo-camera";

import {
  dispatchBulkScans,
  moveItemToFg,
  resolveScan,
} from "../api/dispatchApi";

import {
  fetchDrivers,
  fetchVehicles,
} from "../api/logisticsApi";

import {
  useAuth,
} from "../auth/AuthContext";

function getNowDateTimeLocal() {
  const d = new Date();

  d.setMinutes(
    d.getMinutes() - d.getTimezoneOffset()
  );

  return d.toISOString().slice(0, 16);
}

function toBackendDateTime(value) {
  if (!value) return null;

  return value.length === 16
    ? `${value}:00`
    : value;
}

function normalizeStatus(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function formatStatus(value) {
  const text =
    String(value || "").trim();

  if (!text || text === "ALL") {
    return "All";
  }

  return text.replace(/_/g, " ");
}

function clean(value) {
  return value === null ||
    value === undefined ||
    value === ""
    ? "—"
    : String(value);
}

function getBackendMessage(
  error,
  fallback = "Something went wrong"
) {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.response?.data ||
    error?.message ||
    fallback
  );
}

function getZohoItemId(item) {
  return (
    item?.zohoItemId ||
    item?.zoho_item_id ||
    item?.itemId ||
    item?.id ||
    ""
  );
}

function getItemName(item) {
  return (
    item?.itemName ||
    item?.name ||
    item?.item_name ||
    "Unnamed Item"
  );
}

function getCurrentLocation(item) {
  return (
    item?.currentLocationCode ||
    item?.location ||
    item?.currentLocation ||
    ""
  );
}

function getPlantCode(item) {
  return String(item?.plantCode || "")
    .trim();
}

function isLegacyLocationMissing(item) {
  return (
    !item?.plantCode ||
    !item?.currentLocationCode ||
    !item?.fgAreaCode
  );
}

function isPkdLocation(item) {
  const loc =
    getCurrentLocation(item);

  return String(loc || "")
    .toUpperCase()
    .startsWith("PKD");
}

function isFgLocation(item) {
  const loc =
    getCurrentLocation(item);

  const fg =
    item?.fgAreaCode;

  if (!loc || !fg) {
    return false;
  }

  return String(loc)
    .toUpperCase()
    .startsWith(
      String(fg).toUpperCase()
    );
}

function getResolvedItem(data) {
  return (
    data?.item ||
    data?.dispatchedItem ||
    data?.packetItem ||
    data ||
    {}
  );
}

function getFgOptions(item) {
  if (Array.isArray(item?.fgZones)) {
    return item.fgZones
      .map((zone) =>
        typeof zone === "string"
          ? zone
          : zone?.zoneCode ||
          zone?.code ||
          zone?.name ||
          ""
      )
      .filter(Boolean)
      .map(String);
  }

  const fg =
    item?.fgAreaCode ||
    item?.fgCode ||
    "";

  const plant =
    item?.plantCode || "";

  if (
    String(plant).toUpperCase() === "AL-P1" ||
    String(fg).toUpperCase() === "FG-1"
  ) {
    return ["A", "B", "C"];
  }

  return [];
}

function needsFgMove(item) {
  const status =
    normalizeStatus(item?.status);

  return (
    status === "READY" &&
    !isLegacyLocationMissing(item) &&
    isPkdLocation(item)
  );
}

function canDispatchItem(item) {
  const status =
    normalizeStatus(item?.status);

  if (status === "READY_TO_DISPATCH") {
    return true;
  }

  if (status === "READY") {
    return (
      isLegacyLocationMissing(item) ||
      isFgLocation(item)
    );
  }

  return false;
}

function getRowVirtualStatus(row) {
  const item =
    row?.item || {};

  if (needsFgMove(item)) {
    return "NEED_FG";
  }

  if (canDispatchItem(item)) {
    return "READY";
  }

  return normalizeStatus(item.status) || "BLOCKED";
}

function getRowReadiness(item) {
  const status =
    normalizeStatus(item?.status);

  if (needsFgMove(item)) {
    return {
      label: "NEED FG",
      tone: "warning",
      message: "Move this item to FG before bulk dispatch.",
    };
  }

  if (canDispatchItem(item)) {
    return {
      label: "READY",
      tone: "success",
      message: "Ready for bulk dispatch.",
    };
  }

  return {
    label: "BLOCKED",
    tone: "danger",
    message: `Current status is ${formatStatus(status)}. This item cannot be dispatched now.`,
  };
}

function getSearchBlob(row) {
  const item =
    row?.item || {};

  return [
    row?.scanText,
    item.itemName,
    item.name,
    item.sku,
    item.pdNo,
    item.drawingNo,
    item.clientName,
    item.description,
    item.remarks,
    item.plantCode,
    item.currentLocationCode,
    item.location,
    item.status,
    item.zohoItemId,
  ]
    .map(normalizeText)
    .join(" ");
}

export default function BulkScanScreen({
  navigation,
}) {

  const {
    hasRole,
  } = useAuth();

  const isDispatch =
    hasRole("DISPATCH");

  const [permission, requestPermission] =
    useCameraPermissions();

  const [scannerActive, setScannerActive] =
    useState(true);

  const [notice, setNotice] =
    useState(null);

  const [loading, setLoading] =
    useState(false);

  const [dispatching, setDispatching] =
    useState(false);

  const [movingId, setMovingId] =
    useState("");

  const [rows, setRows] =
    useState([]);

  const [drivers, setDrivers] =
    useState([]);

  const [vehicles, setVehicles] =
    useState([]);

  const [bulkMovingFg, setBulkMovingFg] =
    useState(false);

  const [bulkFgZoneCode, setBulkFgZoneCode] =
    useState("");

  const [cartSearch, setCartSearch] =
    useState("");

  const [filterOpen, setFilterOpen] =
    useState(false);

  const [itemNameFilter, setItemNameFilter] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState("ALL");

  const [plantFilter, setPlantFilter] =
    useState("ALL");

  const [locationFilter, setLocationFilter] =
    useState("ALL");

  const [form, setForm] =
    useState({
      driverId: "",
      vehicleId: "",
      tripStart: getNowDateTimeLocal(),
      helperLoaderCount: "",
      remarks: "",
    });

  const showNotice = (
    type,
    title,
    message
  ) => {
    setNotice({
      type,
      title,
      message,
    });
  };

  const clearNotice = () => {
    setNotice(null);
  };

  const loadMasters = async () => {
    try {
      const [
        driverData,
        vehicleData,
      ] =
        await Promise.all([
          fetchDrivers(),
          fetchVehicles(),
        ]);

      setDrivers(
        Array.isArray(driverData)
          ? driverData
          : []
      );

      setVehicles(
        Array.isArray(vehicleData)
          ? vehicleData
          : []
      );
    } catch (e) {
      showNotice(
        "error",
        "Masters failed",
        getBackendMessage(
          e,
          "Unable to load drivers/vehicles"
        )
      );
    }
  };

  useEffect(() => {
    if (isDispatch) {
      loadMasters();
    }
  }, [isDispatch]);

  const update = (
    key,
    value
  ) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const addCreatedMaster = (
    type,
    created
  ) => {
    if (type === "driver") {
      setDrivers((prev) => [
        created,
        ...prev.filter(
          (item) =>
            String(item.id) !==
            String(created.id)
        ),
      ]);

      return;
    }

    setVehicles((prev) => [
      created,
      ...prev.filter(
        (item) =>
          String(item.id) !==
          String(created.id)
      ),
    ]);
  };

  const pendingFgCount =
    useMemo(
      () =>
        rows.filter((r) =>
          needsFgMove(r.item)
        ).length,
      [rows]
    );

  const readyCount =
    useMemo(
      () =>
        rows.filter((r) =>
          canDispatchItem(r.item)
        ).length,
      [rows]
    );

  const blockedCount =
    useMemo(
      () =>
        rows.filter((r) => {
          const item =
            r.item || {};

          return (
            !needsFgMove(item) &&
            !canDispatchItem(item)
          );
        }).length,
      [rows]
    );

  const canBulkDispatch =
    rows.length > 0 &&
    pendingFgCount === 0 &&
    readyCount === rows.length;

  const pendingFgRows =
    useMemo(
      () =>
        rows
          .map((row, index) => ({
            row,
            index,
          }))
          .filter(({ row }) =>
            needsFgMove(row.item)
          ),
      [rows]
    );

  const bulkFgOptions =
    useMemo(() => {
      const options = [];

      pendingFgRows.forEach(({ row }) => {
        getFgOptions(row.item).forEach((zone) => {
          if (!options.includes(zone)) {
            options.push(zone);
          }
        });
      });

      return options;
    }, [pendingFgRows]);

  const pendingFgMissingZoneCount =
    useMemo(
      () =>
        pendingFgRows.filter(({ row }) => {
          const options =
            getFgOptions(row.item);

          return (
            options.length > 0 &&
            !row.fgZoneCode
          );
        }).length,
      [pendingFgRows]
    );

  const statusOptions =
    useMemo(() => {
      const values =
        rows
          .map(getRowVirtualStatus)
          .filter(Boolean);

      return [
        "ALL",
        ...Array.from(new Set(values)).sort(),
      ];
    }, [rows]);

  const plantOptions =
    useMemo(() => {
      const values =
        rows
          .map((row) =>
            getPlantCode(row.item)
          )
          .filter(Boolean);

      return [
        "ALL",
        ...Array.from(new Set(values)).sort(),
      ];
    }, [rows]);

  const locationOptions =
    useMemo(() => {
      const values =
        rows
          .map((row) =>
            getCurrentLocation(row.item)
          )
          .filter(Boolean);

      return [
        "ALL",
        ...Array.from(new Set(values)).sort(),
      ];
    }, [rows]);

  const filteredRows =
    useMemo(() => {
      const query =
        normalizeText(cartSearch);

      const nameQuery =
        normalizeText(itemNameFilter);

      return rows
        .map((row, index) => ({
          row,
          index,
        }))
        .filter(({ row }) => {
          const item =
            row.item || {};

          const itemName =
            normalizeText(
              getItemName(item)
            );

          const clientName =
            normalizeText(
              item.clientName
            );

          const virtualStatus =
            getRowVirtualStatus(row);

          const plant =
            getPlantCode(item);

          const location =
            getCurrentLocation(item);

          const matchesSearch =
            !query ||
            getSearchBlob(row).includes(query);

          const matchesName =
            !nameQuery ||
            itemName.includes(nameQuery) ||
            clientName.includes(nameQuery);

          const matchesStatus =
            statusFilter === "ALL" ||
            virtualStatus === statusFilter;

          const matchesPlant =
            plantFilter === "ALL" ||
            plant === plantFilter;

          const matchesLocation =
            locationFilter === "ALL" ||
            location === locationFilter;

          return (
            matchesSearch &&
            matchesName &&
            matchesStatus &&
            matchesPlant &&
            matchesLocation
          );
        });
    }, [
      rows,
      cartSearch,
      itemNameFilter,
      statusFilter,
      plantFilter,
      locationFilter,
    ]);

  const filterCount =
    [
      itemNameFilter.trim(),
      statusFilter !== "ALL",
      plantFilter !== "ALL",
      locationFilter !== "ALL",
    ].filter(Boolean).length;

  const hasAnyFilter =
    Boolean(cartSearch.trim()) ||
    filterCount > 0;

  const selectedDriver =
    useMemo(
      () =>
        drivers.find(
          (driver) =>
            String(driver.id) ===
            String(form.driverId)
        ),
      [drivers, form.driverId]
    );

  const selectedVehicle =
    useMemo(
      () =>
        vehicles.find(
          (vehicle) =>
            String(vehicle.id) ===
            String(form.vehicleId)
        ),
      [vehicles, form.vehicleId]
    );

  const clearFilters = () => {
    setCartSearch("");
    setItemNameFilter("");
    setStatusFilter("ALL");
    setPlantFilter("ALL");
    setLocationFilter("ALL");
  };

  const addScan = async (raw) => {
    const cleanScan =
      String(raw || "").trim();

    if (!cleanScan) {
      setScannerActive(true);
      return;
    }

    const duplicate =
      rows.some(
        (r) => r.scanText === cleanScan
      );

    if (duplicate) {
      showNotice(
        "warning",
        "Duplicate QR",
        "This QR is already added in the bulk cart."
      );

      setScannerActive(true);
      return;
    }

    try {
      setLoading(true);

      const data =
        await resolveScan(cleanScan);

      const item =
        getResolvedItem(data);

      const zohoItemId =
        getZohoItemId(item);

      const duplicateItem =
        rows.some(
          (r) =>
            getZohoItemId(r.item) ===
            zohoItemId
        );

      if (duplicateItem) {
        showNotice(
          "warning",
          "Duplicate item",
          "This item is already added in the bulk cart."
        );

        setScannerActive(true);
        return;
      }

      setRows((prev) => [
        ...prev,
        {
          scanText: cleanScan,
          item,
          fgZoneCode: "",
          manualFgZone: false,
        },
      ]);

      showNotice(
        "success",
        "Item added",
        `${clean(
          getItemName(item)
        )} added to bulk cart.`
      );
    } catch (e) {
      showNotice(
        "error",
        "Scan failed",
        getBackendMessage(
          e,
          "Unable to resolve QR"
        )
      );
    } finally {
      setLoading(false);
      setScannerActive(true);
    }
  };

  const handleBarcodeScanned =
    async ({
      data,
    }) => {
      if (!scannerActive || loading) {
        return;
      }

      setScannerActive(false);

      await addScan(data);
    };

  const removeRow = (index) => {
    setRows((prev) =>
      prev.filter((_, i) => i !== index)
    );

    showNotice(
      "success",
      "Removed",
      "Item removed from bulk cart."
    );
  };

  const clearAll = () => {
    Alert.alert(
      "Clear bulk cart?",
      "This will remove all scanned items.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Clear",
          style: "destructive",
          onPress: () => {
            setRows([]);
            setBulkFgZoneCode("");
            clearFilters();
            showNotice(
              "success",
              "Cart cleared",
              "All scanned items removed."
            );
          },
        },
      ]
    );
  };

  const updateRowFgZone = (
    index,
    zone
  ) => {
    setRows((prev) =>
      prev.map((r, i) =>
        i === index
          ? {
            ...r,
            fgZoneCode: zone,
            manualFgZone: true,
          }
          : r
      )
    );
  };

  const refreshRow = async (
    index,
    options = {}
  ) => {
    const row =
      rows[index];

    const silent =
      Boolean(options.silent);

    if (!row?.scanText) {
      return;
    }

    try {
      setMovingId(
        getZohoItemId(row.item) ||
        String(index)
      );

      const data =
        await resolveScan(row.scanText);

      const refreshedItem =
        getResolvedItem(data);

      setRows((prev) =>
        prev.map((r, i) => {
          if (i !== index) {
            return r;
          }

          const fgOptions =
            getFgOptions(refreshedItem);

          let nextZone =
            r.fgZoneCode || "";

          if (
            fgOptions.length > 0 &&
            nextZone &&
            !fgOptions.includes(nextZone)
          ) {
            nextZone = "";
          }

          if (fgOptions.length === 0) {
            nextZone = "";
          }

          return {
            ...r,
            item: refreshedItem,
            fgZoneCode: nextZone,
            manualFgZone:
              Boolean(nextZone) &&
              Boolean(r.manualFgZone),
          };
        })
      );

      if (!silent) {
        showNotice(
          "success",
          "Item refreshed",
          "Latest item status loaded."
        );
      }
    } catch (e) {
      showNotice(
        "error",
        "Refresh failed",
        getBackendMessage(
          e,
          "Unable to refresh item"
        )
      );
    } finally {
      setMovingId("");
    }
  };

  const submitMoveToFg = async (
    row,
    index
  ) => {
    const item =
      row.item;

    const zohoItemId =
      getZohoItemId(item);

    if (!zohoItemId) {
      showNotice(
        "error",
        "Missing item",
        "Zoho item id not found."
      );
      return;
    }

    const options =
      getFgOptions(item);

    if (
      options.length > 0 &&
      !row.fgZoneCode
    ) {
      showNotice(
        "warning",
        "FG Zone required",
        "Please select FG zone."
      );
      return;
    }

    try {
      setMovingId(zohoItemId);

      await moveItemToFg(
        zohoItemId,
        row.fgZoneCode
      );

      await refreshRow(
        index,
        {
          silent: true,
        }
      );

      showNotice(
        "success",
        "Moved to FG",
        "Item moved to FG and refreshed successfully."
      );
    } catch (e) {
      const statusCode =
        e?.response?.status;

      const message =
        statusCode === 403
          ? "Only DISPATCH user can move item to FG."
          : getBackendMessage(
            e,
            "Unable to move item to FG"
          );

      showNotice(
        "error",
        "Move failed",
        message
      );
    } finally {
      setMovingId("");
    }
  };

  const applyBulkFgZone = (zone) => {
    setBulkFgZoneCode(zone);

    setRows((prev) =>
      prev.map((row) => {
        if (!needsFgMove(row.item)) {
          return row;
        }

        const options =
          getFgOptions(row.item);

        if (
          options.length > 0 &&
          !options.includes(zone)
        ) {
          return row;
        }

        return {
          ...row,
          fgZoneCode: zone,
          manualFgZone: false,
        };
      })
    );
  };

  const submitBulkMoveToFg = () => {
    if (pendingFgRows.length === 0) {
      showNotice(
        "success",
        "No FG movement needed",
        "All scanned items are already ready for dispatch."
      );
      return;
    }

    if (pendingFgMissingZoneCount > 0) {
      showNotice(
        "warning",
        "FG Zone required",
        "Select a bulk FG zone or select zone item-wise below."
      );
      return;
    }

    Alert.alert(
      "Bulk Move To FG",
      `Move ${pendingFgRows.length} item${pendingFgRows.length > 1
        ? "s"
        : ""
      } to FG?`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Move",
          onPress: executeBulkMoveToFg,
        },
      ]
    );
  };

  const executeBulkMoveToFg = async () => {
    const targetRows =
      rows
        .map((row, index) => ({
          row,
          index,
        }))
        .filter(({ row }) =>
          needsFgMove(row.item)
        );

    if (targetRows.length === 0) {
      showNotice(
        "success",
        "No FG movement needed",
        "All scanned items are already ready for dispatch."
      );
      return;
    }

    const missingZone =
      targetRows.find(({ row }) => {
        const options =
          getFgOptions(row.item);

        return (
          options.length > 0 &&
          !row.fgZoneCode
        );
      });

    if (missingZone) {
      showNotice(
        "warning",
        "FG Zone required",
        "One or more items need FG zone selection."
      );
      return;
    }

    try {
      setBulkMovingFg(true);

      let nextRows = [...rows];

      for (const {
        row,
        index,
      } of targetRows) {
        const item =
          row.item || {};

        const zohoItemId =
          getZohoItemId(item);

        if (!zohoItemId) {
          throw new Error(
            `Zoho item id missing for item ${index + 1}`
          );
        }

        setMovingId(zohoItemId);

        await moveItemToFg(
          zohoItemId,
          row.fgZoneCode || ""
        );

        if (row.scanText) {
          const refreshed =
            await resolveScan(row.scanText);

          const refreshedItem =
            getResolvedItem(refreshed);

          nextRows[index] = {
            ...nextRows[index],
            item: refreshedItem,
            fgZoneCode: "",
            manualFgZone: false,
          };

          setRows([...nextRows]);
        }
      }

      setBulkFgZoneCode("");
      setMovingId("");

      showNotice(
        "success",
        "Bulk FG completed",
        "All required items moved to FG successfully."
      );
    } catch (e) {
      showNotice(
        "error",
        "Bulk move failed",
        getBackendMessage(
          e,
          "Unable to move all items to FG"
        )
      );
    } finally {
      setBulkMovingFg(false);
      setMovingId("");
    }
  };

  const submitBulkDispatch = async () => {
    if (!canBulkDispatch) {
      showNotice(
        "warning",
        "Not ready",
        pendingFgCount > 0
          ? "Move all required items to FG first."
          : "Some items are not ready for dispatch."
      );
      return;
    }

    if (!form.driverId) {
      showNotice(
        "warning",
        "Driver required",
        "Please select driver."
      );
      return;
    }

    if (!form.vehicleId) {
      showNotice(
        "warning",
        "Vehicle required",
        "Please select vehicle."
      );
      return;
    }

    const selectedDispatchTime =
      toBackendDateTime(form.tripStart);

    if (!selectedDispatchTime) {
      showNotice(
        "warning",
        "Challan time required",
        "Please select challan date and time."
      );
      return;
    }

    try {
      setDispatching(true);

      const result =
        await dispatchBulkScans({
          scanTexts: rows.map(
            (row) => row.scanText
          ),

          driverId:
            form.driverId || null,

          vehicleId:
            form.vehicleId || null,

          dispatchTime:
            selectedDispatchTime,

          tripStart:
            selectedDispatchTime,

          helperLoaderCount:
            form.helperLoaderCount,

          remarks:
            form.remarks || "",
        });

      Alert.alert(
        "Bulk dispatch created",
        result?.challanNo
          ? `Dispatch created. Challan: ${result.challanNo}`
          : "Bulk dispatch challan generated successfully.",
        [
          {
            text: "View Challans",
            onPress: () =>
              navigation.navigate("Trips"),
          },
          {
            text: "New Bulk Scan",
            onPress: () => {
              setRows([]);
              setBulkFgZoneCode("");
              clearFilters();

              setForm((prev) => ({
                ...prev,
                helperLoaderCount: "",
                remarks: "",
                tripStart: getNowDateTimeLocal(),
              }));

              setNotice(null);
            },
          },
        ]
      );
    } catch (e) {
      showNotice(
        "error",
        "Bulk dispatch failed",
        getBackendMessage(
          e,
          "Unable to create bulk dispatch"
        )
      );
    } finally {
      setDispatching(false);
    }
  };

  if (!isDispatch) {
    return (
      <View style={styles.center}>
        <Text style={styles.permissionTitle}>
          Access Restricted
        </Text>

        <Text style={styles.permissionText}>
          Bulk QR Dispatch is allowed only for DISPATCH users.
        </Text>

        <Text style={styles.permissionText}>
          Current role: {normalizedRole || "UNKNOWN"}
        </Text>

        <TouchableOpacity
          style={styles.primaryFullBtn}
          onPress={() =>
            navigation.navigate("Trips")
          }
        >
          <Text style={styles.primaryText}>
            Go to Trips / Challans
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.permissionTitle}>
          Camera Permission Required
        </Text>

        <Text style={styles.permissionText}>
          ShipTrack needs camera access to scan dispatch QR codes.
        </Text>

        <TouchableOpacity
          style={styles.primaryFullBtn}
          onPress={requestPermission}
        >
          <Text style={styles.primaryText}>
            Allow Camera
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={{
        paddingBottom: 34,
      }}
    >
      <Text style={styles.title}>
        Bulk QR Dispatch
      </Text>

      <Text style={styles.sub}>
        Scan multiple items, move FG-required items, then create one bulk dispatch challan.
      </Text>

      <StatusNotice
        notice={notice}
        onClose={clearNotice}
      />

      <CompactStats
        scanned={rows.length}
        ready={readyCount}
        needFg={pendingFgCount}
        blocked={blockedCount}
        drivers={drivers.length}
        vehicles={vehicles.length}
      />

      <View style={styles.cameraWrap}>
        <CameraView
          style={styles.camera}
          facing="back"
          barcodeScannerSettings={{
            barcodeTypes: ["qr"],
          }}
          onBarcodeScanned={
            scannerActive
              ? handleBarcodeScanned
              : undefined
          }
        />

        <View style={styles.scanFrame} />
      </View>

      <View style={styles.scanActions}>
        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() =>
            setScannerActive(true)
          }
        >
          <Text style={styles.secondaryText}>
            Keep Scanning
          </Text>
        </TouchableOpacity>

        {rows.length > 0 ? (
          <TouchableOpacity
            style={styles.dangerBtn}
            onPress={clearAll}
          >
            <Text style={styles.dangerText}>
              Clear Cart
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator />

          <Text style={styles.loadingText}>
            Adding item...
          </Text>
        </View>
      ) : null}

      {rows.length > 0 ? (
        <>
          <View style={styles.searchBox}>
            <Text style={styles.searchIcon}>
              🔍
            </Text>

            <TextInput
              value={cartSearch}
              onChangeText={setCartSearch}
              placeholder="Search scanned item, client, SKU, PD..."
              placeholderTextColor="#64748b"
              style={styles.searchInput}
              autoCapitalize="none"
            />

            {cartSearch ? (
              <TouchableOpacity
                onPress={() =>
                  setCartSearch("")
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
            search={cartSearch}
            itemNameFilter={itemNameFilter}
            statusFilter={statusFilter}
            plantFilter={plantFilter}
            locationFilter={locationFilter}
            hasAnyFilter={hasAnyFilter}
            onClear={clearFilters}
          />
        </>
      ) : null}

      {pendingFgCount > 0 ? (
        <View style={styles.bulkFgPanel}>
          <View style={styles.bulkFgTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.bulkFgTitle}>
                Bulk Move To FG
              </Text>

              <Text style={styles.bulkFgSub}>
                {pendingFgCount} item{pendingFgCount > 1 ? "s" : ""} need FG movement. Select one bulk zone, or override zone item-wise below.
              </Text>
            </View>

            <View style={styles.bulkFgCountBadge}>
              <Text style={styles.bulkFgCountText}>
                {pendingFgCount}
              </Text>
            </View>
          </View>

          {bulkFgOptions.length > 0 ? (
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>
                Bulk FG Zone
              </Text>

              <View style={styles.zoneRow}>
                {bulkFgOptions.map((zone) => (
                  <TouchableOpacity
                    key={zone}
                    style={[
                      styles.zoneChip,
                      bulkFgZoneCode === zone
                        ? styles.zoneChipActive
                        : null,
                    ]}
                    onPress={() =>
                      applyBulkFgZone(zone)
                    }
                  >
                    <Text
                      style={[
                        styles.zoneChipText,
                        bulkFgZoneCode === zone
                          ? styles.zoneChipTextActive
                          : null,
                      ]}
                    >
                      {zone}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {pendingFgMissingZoneCount > 0 ? (
                <Text style={styles.bulkFgWarning}>
                  {pendingFgMissingZoneCount} item{pendingFgMissingZoneCount > 1 ? "s" : ""} still need zone selection.
                </Text>
              ) : null}
            </View>
          ) : (
            <View style={styles.bulkFgInfo}>
              <Text style={styles.bulkFgInfoText}>
                No zone selection required for these plants. Items will move to their base FG area.
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.bulkMoveBtn,
              pendingFgMissingZoneCount > 0
                ? styles.disabledBtn
                : null,
            ]}
            onPress={submitBulkMoveToFg}
            disabled={
              bulkMovingFg ||
              pendingFgMissingZoneCount > 0
            }
          >
            {bulkMovingFg ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryText}>
                Move All Required Items To FG
              </Text>
            )}
          </TouchableOpacity>
        </View>
      ) : null}

      {filteredRows.length === 0 &&
        rows.length > 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>
            No scanned items match current filters.
          </Text>
        </View>
      ) : null}

      {filteredRows.map(({ row, index }) => (
        <BulkItemCard
          key={
            getZohoItemId(row.item) ||
            row.scanText ||
            String(index)
          }
          row={row}
          index={index}
          movingId={movingId}
          onRemove={() =>
            removeRow(index)
          }
          onRefresh={() =>
            refreshRow(index)
          }
          onMoveToFg={() =>
            submitMoveToFg(row, index)
          }
          onChangeZone={(zone) =>
            updateRowFgZone(
              index,
              zone
            )
          }
        />
      ))}

      {rows.length > 0 ? (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>
            Bulk Dispatch Challan Details
          </Text>

          <Text style={styles.panelSub}>
            Select existing driver and vehicle,
            create new records, or leave either
            field empty for this bulk challan.
            Challan date and time remain mandatory.
          </Text>

          {!canBulkDispatch ? (
            <View style={styles.warningBox}>
              <Text style={styles.warningText}>
                {pendingFgCount > 0
                  ? "Move all required items to FG before dispatch."
                  : "Some items are not ready for dispatch."}
              </Text>
            </View>
          ) : null}

          <DriverVehicleFields
            drivers={drivers}
            vehicles={vehicles}
            driverId={form.driverId}
            vehicleId={form.vehicleId}
            onDriverChange={(value) =>
              update("driverId", value)
            }
            onVehicleChange={(value) =>
              update("vehicleId", value)
            }
            onCreated={addCreatedMaster}
          />

          <TripStartPicker
            value={form.tripStart}
            onChange={(value) =>
              update("tripStart", value)
            }
          />

          <Field label="Helpers / Loaders (Optional)">
            <TextInput
              value={form.helperLoaderCount}
              onChangeText={(value) =>
                update(
                  "helperLoaderCount",
                  String(value || "")
                    .replace(/\D/g, "")
                    .slice(0, 3)
                )
              }
              placeholder="Enter total helpers / loaders"
              placeholderTextColor="#64748b"
              keyboardType="number-pad"
              maxLength={3}
              editable={!dispatching}
              style={styles.input}
            />

            <Text style={styles.fieldHint}>
              Enter a whole number from 0 to 999. Blank or 0 means not specified.
            </Text>
          </Field>

          <Field label="Remarks">
            <TextInput
              value={form.remarks}
              onChangeText={(v) =>
                update("remarks", v)
              }
              placeholder="Optional bulk dispatch remarks"
              placeholderTextColor="#64748b"
              style={[
                styles.input,
                styles.textarea,
              ]}
              multiline
            />
          </Field>

          <TouchableOpacity
            style={[
              styles.dispatchBtn,
              !canBulkDispatch
                ? styles.disabledBtn
                : null,
            ]}
            onPress={submitBulkDispatch}
            disabled={
              dispatching ||
              !canBulkDispatch
            }
          >
            {dispatching ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryText}>
                Create Bulk Dispatch
              </Text>
            )}
          </TouchableOpacity>
        </View>
      ) : null}

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
    </ScrollView>
  );
}

function StatusNotice({
  notice,
  onClose,
}) {
  if (!notice) {
    return null;
  }

  const isSuccess =
    notice.type === "success";

  const isWarning =
    notice.type === "warning";

  return (
    <View
      style={[
        styles.noticeBox,
        isSuccess
          ? styles.noticeSuccess
          : isWarning
            ? styles.noticeWarning
            : styles.noticeError,
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text
          style={[
            styles.noticeTitle,
            isSuccess
              ? styles.noticeSuccessText
              : isWarning
                ? styles.noticeWarningText
                : styles.noticeErrorText,
          ]}
        >
          {notice.title}
        </Text>

        <Text style={styles.noticeMessage}>
          {notice.message}
        </Text>
      </View>

      <TouchableOpacity
        style={styles.noticeClose}
        onPress={onClose}
      >
        <Text style={styles.noticeCloseText}>
          ×
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function CompactStats({
  scanned,
  ready,
  needFg,
  blocked,
  drivers,
  vehicles,
}) {
  return (
    <View style={styles.statsGrid}>
      <MiniStat
        label="Scanned"
        value={scanned}
        active={scanned > 0}
      />

      <MiniStat
        label="Ready"
        value={ready}
        active={ready > 0}
      />

      <MiniStat
        label="Need FG"
        value={needFg}
        warning={needFg > 0}
      />

      <MiniStat
        label="Blocked"
        value={blocked}
        danger={blocked > 0}
      />

      <MiniStat
        label="Drivers"
        value={drivers}
      />

      <MiniStat
        label="Vehicles"
        value={vehicles}
      />
    </View>
  );
}

function MiniStat({
  label,
  value,
  active,
  warning,
  danger,
}) {
  return (
    <View
      style={[
        styles.miniStat,
        active
          ? styles.miniStatActive
          : warning
            ? styles.miniStatWarning
            : danger
              ? styles.miniStatDanger
              : null,
      ]}
    >
      <Text
        style={styles.miniStatValue}
        numberOfLines={1}
      >
        {value}
      </Text>

      <Text style={styles.miniStatLabel}>
        {label}
      </Text>
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
                Bulk Cart Filters
              </Text>

              <Text style={styles.filterSheetSub}>
                Filter scanned cart items by name, status, plant and location.
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

function BulkItemCard({
  row,
  index,
  movingId,
  onRemove,
  onRefresh,
  onMoveToFg,
  onChangeZone,
}) {
  const item =
    row.item || {};

  const readiness =
    getRowReadiness(item);

  const itemNeedsFg =
    needsFgMove(item);

  const fgOptions =
    getFgOptions(item);

  const id =
    getZohoItemId(item);

  const isMoving =
    movingId === id ||
    movingId === String(index);

  return (
    <View style={styles.itemCard}>
      <View style={styles.itemTop}>
        <View style={styles.itemNo}>
          <Text style={styles.itemNoText}>
            {index + 1}
          </Text>
        </View>

        <View style={{ flex: 1 }}>
          <Text
            style={styles.itemName}
            numberOfLines={2}
          >
            {clean(getItemName(item))}
          </Text>

          <Text style={styles.itemSub}>
            SKU: {clean(item.sku)}
          </Text>
        </View>

        <View
          style={[
            styles.statusBadge,
            readiness.tone === "success"
              ? styles.readyBadge
              : readiness.tone === "warning"
                ? styles.warnBadge
                : styles.blockBadge,
          ]}
        >
          <Text
            style={[
              styles.statusText,
              readiness.tone === "success"
                ? styles.readyText
                : readiness.tone === "warning"
                  ? styles.warnText
                  : styles.blockText,
            ]}
          >
            {readiness.label}
          </Text>
        </View>
      </View>

      <View style={styles.readinessBox}>
        <Text style={styles.readinessTitle}>
          {formatStatus(item.status)}
        </Text>

        <Text style={styles.readinessText}>
          {readiness.message}
        </Text>
      </View>

      <View style={styles.grid}>
        <Info
          label="PD No"
          value={clean(item.pdNo)}
        />

        <Info
          label="DWG No"
          value={clean(item.drawingNo)}
        />

        <Info
          label="Client"
          value={clean(item.clientName)}
        />

        <Info
          label="Plant"
          value={clean(item.plantCode)}
        />

        <Info
          label="Location"
          value={clean(
            getCurrentLocation(item)
          )}
        />

        <Info
          label="FG Area"
          value={clean(item.fgAreaCode)}
        />
      </View>

      {itemNeedsFg ? (
        <View style={styles.fgPanel}>
          <Text style={styles.fgTitle}>
            Move to FG Required
          </Text>

          {fgOptions.length > 0 ? (
            <View style={styles.zoneRow}>
              {fgOptions.map((zone) => (
                <TouchableOpacity
                  key={zone}
                  style={[
                    styles.zoneChip,
                    row.fgZoneCode === zone
                      ? styles.zoneChipActive
                      : null,
                  ]}
                  onPress={() =>
                    onChangeZone(zone)
                  }
                >
                  <Text
                    style={[
                      styles.zoneChipText,
                      row.fgZoneCode === zone
                        ? styles.zoneChipTextActive
                        : null,
                    ]}
                  >
                    {zone}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}

          <TouchableOpacity
            style={styles.moveBtn}
            onPress={onMoveToFg}
            disabled={isMoving}
          >
            {isMoving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryText}>
                Move to FG
              </Text>
            )}
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.itemActions}>
        <TouchableOpacity
          style={styles.smallSecondaryBtn}
          onPress={onRefresh}
          disabled={isMoving}
        >
          <Text style={styles.smallSecondaryText}>
            Refresh
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.smallDangerBtn}
          onPress={onRemove}
          disabled={isMoving}
        >
          <Text style={styles.smallDangerText}>
            Remove
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function Field({
  label,
  children,
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>
        {label}
      </Text>

      {children}
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
    padding: 20,
  },

  permissionTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 8,
  },

  permissionText: {
    color: "#94a3b8",
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 18,
    lineHeight: 20,
  },

  title: {
    color: "#fff",
    fontSize: 25,
    fontWeight: "900",
    marginTop: 4,
  },

  sub: {
    color: "#94a3b8",
    marginTop: 5,
    marginBottom: 12,
    fontWeight: "700",
    lineHeight: 18,
    fontSize: 12,
  },

  noticeBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
  },

  noticeSuccess: {
    backgroundColor: "rgba(16,185,129,.10)",
    borderColor: "rgba(16,185,129,.24)",
  },

  noticeWarning: {
    backgroundColor: "rgba(245,158,11,.10)",
    borderColor: "rgba(245,158,11,.25)",
  },

  noticeError: {
    backgroundColor: "rgba(239,68,68,.10)",
    borderColor: "rgba(239,68,68,.25)",
  },

  noticeTitle: {
    fontWeight: "900",
    fontSize: 13,
    marginBottom: 3,
  },

  noticeSuccessText: {
    color: "#6ee7b7",
  },

  noticeWarningText: {
    color: "#facc15",
  },

  noticeErrorText: {
    color: "#fca5a5",
  },

  noticeMessage: {
    color: "#cbd5e1",
    fontWeight: "700",
    fontSize: 12,
    lineHeight: 17,
  },

  noticeClose: {
    width: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,.07)",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 10,
  },

  noticeCloseText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "900",
    lineHeight: 20,
  },

  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
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

  miniStatWarning: {
    borderColor: "rgba(245,158,11,.30)",
    backgroundColor: "rgba(245,158,11,.08)",
  },

  miniStatDanger: {
    borderColor: "rgba(239,68,68,.30)",
    backgroundColor: "rgba(239,68,68,.08)",
  },

  miniStatValue: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 14,
  },

  miniStatLabel: {
    color: "#94a3b8",
    fontWeight: "800",
    fontSize: 10,
    marginTop: 2,
  },

  cameraWrap: {
    height: 290,
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.10)",
    marginBottom: 12,
  },

  camera: {
    flex: 1,
  },

  scanFrame: {
    position: "absolute",
    left: 46,
    right: 46,
    top: 62,
    bottom: 62,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: "rgba(96,165,250,.95)",
  },

  scanActions: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },

  secondaryBtn: {
    flex: 1,
    height: 44,
    borderRadius: 13,
    backgroundColor: "rgba(59,130,246,.10)",
    borderWidth: 1,
    borderColor: "rgba(59,130,246,.25)",
    alignItems: "center",
    justifyContent: "center",
  },

  secondaryText: {
    color: "#93c5fd",
    fontWeight: "900",
  },

  dangerBtn: {
    flex: 1,
    height: 44,
    borderRadius: 13,
    backgroundColor: "rgba(239,68,68,.12)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,.28)",
    alignItems: "center",
    justifyContent: "center",
  },

  dangerText: {
    color: "#fca5a5",
    fontWeight: "900",
  },

  loadingBox: {
    backgroundColor: "#0f172a",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.08)",
  },

  loadingText: {
    color: "#94a3b8",
    marginTop: 10,
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

  emptyBox: {
    padding: 18,
    borderRadius: 16,
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.08)",
    alignItems: "center",
    marginBottom: 14,
  },

  emptyText: {
    color: "#94a3b8",
    fontWeight: "700",
    textAlign: "center",
  },

  bulkFgPanel: {
    backgroundColor: "#0f172a",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(245,158,11,.24)",
    marginBottom: 14,
  },

  bulkFgTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
  },

  bulkFgTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 5,
  },

  bulkFgSub: {
    color: "#94a3b8",
    fontWeight: "700",
    lineHeight: 19,
    fontSize: 12,
  },

  bulkFgCountBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(245,158,11,.16)",
    borderWidth: 1,
    borderColor: "rgba(245,158,11,.28)",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },

  bulkFgCountText: {
    color: "#facc15",
    fontWeight: "900",
    fontSize: 16,
  },

  bulkFgWarning: {
    color: "#facc15",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 8,
  },

  bulkFgInfo: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: "rgba(16,185,129,.08)",
    borderWidth: 1,
    borderColor: "rgba(16,185,129,.20)",
    marginBottom: 12,
  },

  bulkFgInfoText: {
    color: "#6ee7b7",
    fontWeight: "800",
    lineHeight: 18,
    fontSize: 12,
  },

  bulkMoveBtn: {
    height: 50,
    borderRadius: 15,
    backgroundColor: "#f59e0b",
    alignItems: "center",
    justifyContent: "center",
  },

  itemCard: {
    backgroundColor: "#0f172a",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.08)",
    marginBottom: 14,
  },

  itemTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 14,
  },

  itemNo: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(59,130,246,.16)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },

  itemNoText: {
    color: "#93c5fd",
    fontWeight: "900",
  },

  itemName: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "900",
  },

  itemSub: {
    color: "#94a3b8",
    fontWeight: "700",
    marginTop: 5,
    fontSize: 12,
  },

  statusBadge: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 999,
    marginLeft: 8,
    maxWidth: 120,
  },

  readyBadge: {
    backgroundColor: "rgba(16,185,129,.14)",
    borderWidth: 1,
    borderColor: "rgba(16,185,129,.24)",
  },

  warnBadge: {
    backgroundColor: "rgba(245,158,11,.14)",
    borderWidth: 1,
    borderColor: "rgba(245,158,11,.24)",
  },

  blockBadge: {
    backgroundColor: "rgba(239,68,68,.14)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,.24)",
  },

  statusText: {
    fontSize: 10,
    fontWeight: "900",
  },

  readyText: {
    color: "#6ee7b7",
  },

  warnText: {
    color: "#facc15",
  },

  blockText: {
    color: "#fca5a5",
  },

  readinessBox: {
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,.035)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.07)",
    padding: 12,
    marginBottom: 12,
  },

  readinessTitle: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 13,
    marginBottom: 4,
  },

  readinessText: {
    color: "#94a3b8",
    fontWeight: "700",
    fontSize: 12,
    lineHeight: 17,
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

  fgPanel: {
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "rgba(245,158,11,.08)",
    borderWidth: 1,
    borderColor: "rgba(245,158,11,.20)",
  },

  fgTitle: {
    color: "#facc15",
    fontWeight: "900",
    marginBottom: 10,
  },

  zoneRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },

  zoneChip: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.10)",
  },

  zoneChipActive: {
    backgroundColor: "rgba(59,130,246,.18)",
    borderColor: "rgba(59,130,246,.35)",
  },

  zoneChipText: {
    color: "#cbd5e1",
    fontWeight: "900",
    fontSize: 12,
  },

  zoneChipTextActive: {
    color: "#93c5fd",
  },

  moveBtn: {
    height: 44,
    borderRadius: 13,
    backgroundColor: "#f59e0b",
    alignItems: "center",
    justifyContent: "center",
  },

  itemActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },

  smallSecondaryBtn: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(59,130,246,.10)",
    borderWidth: 1,
    borderColor: "rgba(59,130,246,.25)",
    alignItems: "center",
    justifyContent: "center",
  },

  smallSecondaryText: {
    color: "#93c5fd",
    fontWeight: "900",
    fontSize: 12,
  },

  smallDangerBtn: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(239,68,68,.12)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,.28)",
    alignItems: "center",
    justifyContent: "center",
  },

  smallDangerText: {
    color: "#fca5a5",
    fontWeight: "900",
    fontSize: 12,
  },

  panel: {
    backgroundColor: "#0f172a",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.08)",
    marginBottom: 14,
  },

  panelTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 6,
  },

  panelSub: {
    color: "#94a3b8",
    fontWeight: "700",
    lineHeight: 19,
    marginBottom: 12,
    fontSize: 12,
  },

  warningBox: {
    backgroundColor: "rgba(245,158,11,.08)",
    borderWidth: 1,
    borderColor: "rgba(245,158,11,.20)",
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
  },

  warningText: {
    color: "#facc15",
    fontWeight: "800",
    lineHeight: 18,
    fontSize: 12,
  },

  field: {
    marginBottom: 14,
  },

  fieldLabel: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 8,
  },

  input: {
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.10)",
    backgroundColor: "rgba(255,255,255,.05)",
    color: "#fff",
    paddingHorizontal: 14,
    fontWeight: "700",
  },

  fieldHint: {
    color: "#64748b",
    fontSize: 10,
    fontWeight: "700",
    lineHeight: 15,
    marginTop: 7,
  },

  textarea: {
    minHeight: 86,
    paddingTop: 12,
    textAlignVertical: "top",
  },

  selectBox: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  optionChip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.10)",
  },

  optionChipActive: {
    backgroundColor: "rgba(16,185,129,.14)",
    borderColor: "rgba(16,185,129,.35)",
  },

  optionText: {
    color: "#cbd5e1",
    fontWeight: "900",
    fontSize: 12,
  },

  optionTextActive: {
    color: "#6ee7b7",
  },

  selectionHint: {
    color: "#6ee7b7",
    fontWeight: "800",
    fontSize: 11,
    marginTop: 8,
  },

  dispatchBtn: {
    height: 52,
    borderRadius: 15,
    backgroundColor: "#10b981",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },

  disabledBtn: {
    opacity: 0.45,
  },

  primaryFullBtn: {
    height: 50,
    borderRadius: 15,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },

  primaryText: {
    color: "#fff",
    fontWeight: "900",
  },
};
