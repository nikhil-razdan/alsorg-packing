import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  TextInput,
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

function clean(value) {
  return value === null ||
    value === undefined ||
    value === ""
    ? "—"
    : String(value);
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

function getCurrentLocation(item) {
  return (
    item?.currentLocationCode ||
    item?.location ||
    item?.currentLocation ||
    ""
  );
}

function isLegacyLocationMissing(item) {
  return (
    !item?.plantCode ||
    !item?.currentLocationCode ||
    !item?.fgAreaCode
  );
}

function isPkdLocation(item) {
  const loc = getCurrentLocation(item);

  return String(loc || "")
    .toUpperCase()
    .startsWith("PKD");
}

function isFgLocation(item) {
  const loc = getCurrentLocation(item);
  const fg = item?.fgAreaCode;

  if (!loc || !fg) return false;

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
          : zone?.zoneCode || zone?.code || zone?.name || ""
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

export default function BulkScanScreen({
  navigation,
}) {
  const {
    role,
  } = useAuth();

  const normalizedRole =
    String(role || "")
      .trim()
      .toUpperCase();

  const isDispatch =
    normalizedRole === "DISPATCH";

  const [permission, requestPermission] =
    useCameraPermissions();

  const [scannerActive, setScannerActive] =
    useState(true);

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

  const [form, setForm] =
    useState({
      driverId: "",
      vehicleId: "",
      tripStart: getNowDateTimeLocal(),
      remarks: "",
    });

  useEffect(() => {
    if (isDispatch) {
      loadMasters();
    }
  }, [isDispatch]);

  const loadMasters = async () => {
    try {
      const [driverData, vehicleData] =
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
      Alert.alert(
        "Masters failed",
        e?.message ||
        "Unable to load drivers/vehicles"
      );
    }
  };

  const update = (key, value) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
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

  const addScan = async (raw) => {
    const cleanScan =
      String(raw || "").trim();

    if (!cleanScan) return;

    const duplicate =
      rows.some(
        (r) => r.scanText === cleanScan
      );

    if (duplicate) {
      Alert.alert(
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
        Alert.alert(
          "Duplicate item",
          "This item is already added."
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

      Alert.alert(
        "Item added",
        `${clean(
          item.itemName ||
          item.name
        )} added to bulk cart.`
      );
    } catch (e) {
      Alert.alert(
        "Scan failed",
        e?.response?.data?.message ||
        e?.response?.data ||
        e?.message ||
        "Unable to resolve QR"
      );
    } finally {
      setLoading(false);
      setScannerActive(true);
    }
  };

  const handleBarcodeScanned = async ({
    data,
  }) => {
    if (!scannerActive || loading) return;

    setScannerActive(false);

    await addScan(data);
  };

  const removeRow = (index) => {
    setRows((prev) =>
      prev.filter((_, i) => i !== index)
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
          onPress: () => setRows([]),
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

  const refreshRow = async (index) => {
    const row = rows[index];

    if (!row?.scanText) return;

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

          const options =
            getFgOptions(refreshedItem);

          let nextZone =
            r.fgZoneCode || "";

          if (
            options.length > 0 &&
            nextZone &&
            !options.includes(nextZone)
          ) {
            nextZone = "";
          }

          if (options.length === 0) {
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
    } catch (e) {
      Alert.alert(
        "Refresh failed",
        e?.response?.data?.message ||
        e?.response?.data ||
        e?.message ||
        "Unable to refresh item"
      );
    } finally {
      setMovingId("");
    }
  };

  const submitMoveToFg = async (
    row,
    index
  ) => {
    const item = row.item;
    const zohoItemId =
      getZohoItemId(item);

    if (!zohoItemId) {
      Alert.alert(
        "Missing item",
        "Zoho item id not found."
      );
      return;
    }

    const fgOptions =
      getFgOptions(item);

    if (
      fgOptions.length > 0 &&
      !row.fgZoneCode
    ) {
      Alert.alert(
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

      await refreshRow(index);

      Alert.alert(
        "Moved to FG",
        "Item moved to FG successfully."
      );
    } catch (e) {
      const statusCode =
        e?.response?.status;

      const message =
        statusCode === 403
          ? "Only DISPATCH user can move item to FG."
          : e?.response?.data?.message ||
          e?.response?.data ||
          e?.message ||
          "Unable to move item to FG";

      Alert.alert(
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
      Alert.alert(
        "No FG movement needed",
        "There are no scanned items that need FG movement."
      );
      return;
    }

    if (pendingFgMissingZoneCount > 0) {
      Alert.alert(
        "FG Zone required",
        "Select a bulk FG zone or select zone individually for the highlighted items."
      );
      return;
    }

    Alert.alert(
      "Bulk Move To FG",
      `Move ${pendingFgRows.length} item${pendingFgRows.length > 1 ? "s" : ""
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
      Alert.alert(
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
      Alert.alert(
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

      Alert.alert(
        "Bulk FG completed",
        "All required items moved to FG successfully."
      );
    } catch (e) {
      Alert.alert(
        "Bulk move failed",
        e?.response?.data?.message ||
        e?.response?.data ||
        e?.message ||
        "Unable to move all items to FG"
      );
    } finally {
      setBulkMovingFg(false);
      setMovingId("");
    }
  };

  const submitBulkDispatch = async () => {
    if (!canBulkDispatch) {
      Alert.alert(
        "Not ready",
        pendingFgCount > 0
          ? "Move all required items to FG first."
          : "Some items are not ready for dispatch."
      );
      return;
    }

    if (!form.driverId) {
      Alert.alert(
        "Driver required",
        "Please select driver."
      );
      return;
    }

    if (!form.vehicleId) {
      Alert.alert(
        "Vehicle required",
        "Please select vehicle."
      );
      return;
    }

    try {
      setDispatching(true);

      const result =
        await dispatchBulkScans({
          scanTexts: rows.map(
            (r) => r.scanText
          ),
          driverId: form.driverId,
          vehicleId: form.vehicleId,
          tripStart:
            toBackendDateTime(
              form.tripStart
            ),
          remarks: form.remarks || "",
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
              setForm((prev) => ({
                ...prev,
                remarks: "",
                tripStart: getNowDateTimeLocal(),
              }));
            },
          },
        ]
      );
    } catch (e) {
      Alert.alert(
        "Bulk dispatch failed",
        e?.response?.data?.message ||
        e?.response?.data ||
        e?.message ||
        "Unable to create bulk dispatch"
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
            Go to Trips / Delivery
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
        Scan multiple items, move FG-required items, then create one bulk dispatch trip.
      </Text>

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
              Clear
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

      <View style={styles.summaryCard}>
        <Summary
          label="Scanned"
          value={String(rows.length)}
        />

        <Summary
          label="Ready"
          value={String(readyCount)}
        />

        <Summary
          label="Need FG"
          value={String(pendingFgCount)}
        />
      </View>

      {pendingFgCount > 0 ? (
        <View style={styles.bulkFgPanel}>
          <View style={styles.bulkFgTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.bulkFgTitle}>
                Bulk Move To FG
              </Text>

              <Text style={styles.bulkFgSub}>
                {pendingFgCount} item
                {pendingFgCount > 1 ? "s" : ""} need FG movement. Select one bulk zone, or override zone item-wise below.
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
                  {pendingFgMissingZoneCount} item
                  {pendingFgMissingZoneCount > 1 ? "s" : ""} still need zone selection.
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

      {rows.map((row, index) => (
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
            Bulk Dispatch Trip Details
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

          <Field label="Driver">
            <View style={styles.selectBox}>
              {drivers.map((d) => (
                <TouchableOpacity
                  key={d.id}
                  style={[
                    styles.optionChip,
                    form.driverId === d.id
                      ? styles.optionChipActive
                      : null,
                  ]}
                  onPress={() =>
                    update(
                      "driverId",
                      d.id
                    )
                  }
                >
                  <Text
                    style={[
                      styles.optionText,
                      form.driverId === d.id
                        ? styles.optionTextActive
                        : null,
                    ]}
                  >
                    {d.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Field>

          <Field label="Vehicle">
            <View style={styles.selectBox}>
              {vehicles.map((v) => (
                <TouchableOpacity
                  key={v.id}
                  style={[
                    styles.optionChip,
                    form.vehicleId === v.id
                      ? styles.optionChipActive
                      : null,
                  ]}
                  onPress={() =>
                    update(
                      "vehicleId",
                      v.id
                    )
                  }
                >
                  <Text
                    style={[
                      styles.optionText,
                      form.vehicleId === v.id
                        ? styles.optionTextActive
                        : null,
                    ]}
                  >
                    {v.vehicleNumber ||
                      v.registrationNumber ||
                      v.name ||
                      "Vehicle"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Field>

          <Field label="Trip Start Time">
            <TextInput
              value={form.tripStart}
              onChangeText={(v) =>
                update("tripStart", v)
              }
              placeholder="YYYY-MM-DDTHH:mm"
              placeholderTextColor="#64748b"
              style={styles.input}
            />
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
    </ScrollView>
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
  const item = row.item || {};
  const status =
    normalizeStatus(item.status);
  const itemNeedsFg =
    needsFgMove(item);
  const itemReady =
    canDispatchItem(item);
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
            {clean(item.itemName)}
          </Text>

          <Text style={styles.itemSub}>
            SKU: {clean(item.sku)}
          </Text>
        </View>

        <View
          style={[
            styles.statusBadge,
            itemReady
              ? styles.readyBadge
              : styles.warnBadge,
          ]}
        >
          <Text
            style={[
              styles.statusText,
              itemReady
                ? styles.readyText
                : styles.warnText,
            ]}
          >
            {itemNeedsFg
              ? "NEED FG"
              : clean(status)}
          </Text>
        </View>
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
          label="Location"
          value={clean(
            getCurrentLocation(item)
          )}
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
        >
          <Text style={styles.smallSecondaryText}>
            Refresh
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.smallDangerBtn}
          onPress={onRemove}
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

function Summary({
  label,
  value,
}) {
  return (
    <View style={styles.summaryItem}>
      <Text style={styles.summaryValue}>
        {value}
      </Text>

      <Text style={styles.summaryLabel}>
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
    fontSize: 26,
    fontWeight: "900",
    marginTop: 4,
  },

  sub: {
    color: "#94a3b8",
    marginTop: 6,
    marginBottom: 16,
    fontWeight: "700",
    lineHeight: 20,
  },

  cameraWrap: {
    height: 300,
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
    top: 65,
    bottom: 65,
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
  },

  loadingText: {
    color: "#94a3b8",
    marginTop: 10,
    fontWeight: "700",
  },

  summaryCard: {
    flexDirection: "row",
    backgroundColor: "#0f172a",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.08)",
    marginBottom: 14,
    padding: 12,
  },

  summaryItem: {
    flex: 1,
    alignItems: "center",
  },

  summaryValue: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "900",
  },

  summaryLabel: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "800",
    marginTop: 3,
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
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },

  readyBadge: {
    backgroundColor: "rgba(16,185,129,.14)",
  },

  warnBadge: {
    backgroundColor: "rgba(245,158,11,.14)",
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
    marginBottom: 12,
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
  },

  bulkMoveBtn: {
    height: 50,
    borderRadius: 15,
    backgroundColor: "#f59e0b",
    alignItems: "center",
    justifyContent: "center",
  },
};