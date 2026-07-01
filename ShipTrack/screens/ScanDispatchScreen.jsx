import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useAuth,
} from "../auth/AuthContext";

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
  dispatchSingleScan,
  moveItemToFg,
  resolveScan,
} from "../api/dispatchApi";

import {
  fetchDrivers,
  fetchVehicles,
} from "../api/logisticsApi";

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

function getResolvedItem(data) {
  return (
    data?.item ||
    data?.dispatchedItem ||
    data?.packetItem ||
    data ||
    {}
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

export default function ScanDispatchScreen({
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

  const [scanText, setScanText] =
    useState("");

  const [resolved, setResolved] =
    useState(null);

  const [loading, setLoading] =
    useState(false);

  const [movingFg, setMovingFg] =
    useState(false);

  const [dispatching, setDispatching] =
    useState(false);

  const [drivers, setDrivers] =
    useState([]);

  const [vehicles, setVehicles] =
    useState([]);

  const [form, setForm] =
    useState({
      driverId: "",
      vehicleId: "",
      tripStart: getNowDateTimeLocal(),
      remarks: "",
      fgZoneCode: "",
    });

  useEffect(() => {
    loadMasters();
  }, []);

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

  const item = useMemo(
    () => getResolvedItem(resolved),
    [resolved]
  );

  const status =
    normalizeStatus(item?.status);

  const fgOptions =
    getFgOptions(item);

  const needsFgMove =
    resolved &&
    status === "READY" &&
    !isLegacyLocationMissing(item) &&
    isPkdLocation(item);

  const canDispatch =
    resolved &&
    status === "READY" &&
    (
      isLegacyLocationMissing(item) ||
      isFgLocation(item)
    );

  const update = (key, value) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleBarcodeScanned = async ({
    data,
  }) => {
    if (!scannerActive || loading) return;

    const raw = String(data || "").trim();

    if (!raw) return;

    setScannerActive(false);
    setScanText(raw);

    await resolveQr(raw);
  };

  const resolveQr = async (raw) => {
    try {
      setLoading(true);

      const data =
        await resolveScan(raw);

      setResolved(data);

      const foundItem =
        getResolvedItem(data);

      const options =
        getFgOptions(foundItem);

      if (options.length === 1) {
        update("fgZoneCode", options[0]);
      }

      Alert.alert(
        "QR scanned",
        "Item resolved successfully."
      );
    } catch (e) {
      setResolved(null);

      Alert.alert(
        "Scan failed",
        e?.response?.data?.message ||
        e?.response?.data ||
        e?.message ||
        "Unable to resolve QR"
      );

      setScannerActive(true);
    } finally {
      setLoading(false);
    }
  };

  const resetScan = () => {
    setScannerActive(true);
    setScanText("");
    setResolved(null);
    setForm((prev) => ({
      ...prev,
      fgZoneCode: "",
      remarks: "",
      tripStart: getNowDateTimeLocal(),
    }));
  };

  const submitMoveToFg = async () => {
    const zohoItemId =
      getZohoItemId(item);

    if (!zohoItemId) {
      Alert.alert(
        "Missing item",
        "Zoho item id not found."
      );
      return;
    }

    if (
      fgOptions.length > 0 &&
      !form.fgZoneCode
    ) {
      Alert.alert(
        "FG Zone required",
        "Please select FG zone."
      );
      return;
    }

    try {
      setMovingFg(true);

      await moveItemToFg(
        zohoItemId,
        form.fgZoneCode
      );

      Alert.alert(
        "Moved to FG",
        "Item moved to FG successfully. Please scan/refresh item again.",
        [
          {
            text: "Refresh",
            onPress: () =>
              resolveQr(scanText),
          },
        ]
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
      setMovingFg(false);
    }
  };

  const submitDispatch = async () => {
    if (!scanText) {
      Alert.alert(
        "QR missing",
        "Please scan QR first."
      );
      return;
    }

    if (!canDispatch) {
      Alert.alert(
        "Not ready",
        needsFgMove
          ? "Move item to FG first."
          : "Item is not ready for dispatch."
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
        await dispatchSingleScan({
          scanText,
          rawScan: scanText,
          driverId: form.driverId,
          vehicleId: form.vehicleId,
          tripStart:
            toBackendDateTime(
              form.tripStart
            ),
          remarks: form.remarks || "",
        });

      Alert.alert(
        "Dispatch created",
        result?.challanNo
          ? `Dispatch created. Challan: ${result.challanNo}`
          : "Dispatch Challan generated successfully.",
        [
          {
            text: "View Challans",
            onPress: () =>
              navigation.navigate("Trips"),
          },
          {
            text: "Scan Next",
            onPress: resetScan,
          },
        ]
      );
    } catch (e) {
      Alert.alert(
        "Dispatch failed",
        e?.response?.data?.message ||
        e?.response?.data ||
        e?.message ||
        "Unable to dispatch item"
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
          QR Dispatch, Move to FG, and Dispatch Item are allowed only for DISPATCH users.
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
        Single QR Dispatch
      </Text>

      <Text style={styles.sub}>
        Scan one item, move to FG if required, then dispatch with driver and vehicle.
      </Text>

      <View style={styles.cameraWrap}>
        {scannerActive ? (
          <CameraView
            style={styles.camera}
            facing="back"
            barcodeScannerSettings={{
              barcodeTypes: ["qr"],
            }}
            onBarcodeScanned={
              handleBarcodeScanned
            }
          />
        ) : (
          <View style={styles.scanPaused}>
            <Text style={styles.scanPausedText}>
              QR captured
            </Text>

            <Text
              style={styles.scanText}
              numberOfLines={3}
            >
              {scanText}
            </Text>
          </View>
        )}

        <View style={styles.scanFrame} />
      </View>

      <View style={styles.scanActions}>
        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={resetScan}
        >
          <Text style={styles.secondaryText}>
            Scan Again
          </Text>
        </TouchableOpacity>

        {scanText ? (
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() =>
              resolveQr(scanText)
            }
            disabled={loading}
          >
            <Text style={styles.secondaryText}>
              Refresh
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator />

          <Text style={styles.loadingText}>
            Resolving QR...
          </Text>
        </View>
      ) : null}

      {resolved ? (
        <>
          <View style={styles.itemCard}>
            <View style={styles.itemTop}>
              <View style={{ flex: 1 }}>
                <Text
                  style={styles.itemName}
                  numberOfLines={2}
                >
                  {clean(
                    item?.itemName ||
                    item?.name
                  )}
                </Text>

                <Text style={styles.itemSub}>
                  SKU:{" "}
                  {clean(
                    item?.sku ||
                    item?.codeSku
                  )}
                </Text>
              </View>

              <View
                style={[
                  styles.statusBadge,
                  canDispatch
                    ? styles.readyBadge
                    : styles.warnBadge,
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    canDispatch
                      ? styles.readyText
                      : styles.warnText,
                  ]}
                >
                  {clean(status)}
                </Text>
              </View>
            </View>

            <View style={styles.grid}>
              <Info
                label="PD No"
                value={clean(item?.pdNo)}
              />

              <Info
                label="DWG No"
                value={clean(item?.drawingNo)}
              />

              <Info
                label="Client"
                value={clean(item?.clientName)}
              />

              <Info
                label="Plant"
                value={clean(item?.plantCode)}
              />

              <Info
                label="Current Location"
                value={clean(
                  getCurrentLocation(item)
                )}
              />

              <Info
                label="FG Area"
                value={clean(item?.fgAreaCode)}
              />
            </View>

            <View style={styles.longBox}>
              <Text style={styles.longLabel}>
                Description
              </Text>

              <Text style={styles.longValue}>
                {clean(item?.description)}
              </Text>
            </View>
          </View>

          {needsFgMove ? (
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>
                Move to FG Required
              </Text>

              <Text style={styles.panelSub}>
                This item is still in packing/PKD location. Move it to FG before dispatch.
              </Text>

              {fgOptions.length > 0 ? (
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>
                    FG Zone
                  </Text>

                  <View
                    style={
                      styles.selectWrap
                    }
                  >
                    {fgOptions.map((zone) => (
                      <TouchableOpacity
                        key={zone}
                        style={[
                          styles.zoneChip,
                          form.fgZoneCode ===
                            zone
                            ? styles.zoneChipActive
                            : null,
                        ]}
                        onPress={() =>
                          update(
                            "fgZoneCode",
                            zone
                          )
                        }
                      >
                        <Text
                          style={[
                            styles.zoneChipText,
                            form.fgZoneCode ===
                              zone
                              ? styles.zoneChipTextActive
                              : null,
                          ]}
                        >
                          {zone}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ) : null}

              <TouchableOpacity
                style={styles.moveBtn}
                onPress={submitMoveToFg}
                disabled={movingFg}
              >
                {movingFg ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryText}>
                    Move Item to FG
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          ) : null}

          {canDispatch ? (
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>
                Dispatch Trip Details
              </Text>

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
                  placeholder="Optional dispatch remarks"
                  placeholderTextColor="#64748b"
                  style={[
                    styles.input,
                    styles.textarea,
                  ]}
                  multiline
                />
              </Field>

              <TouchableOpacity
                style={styles.dispatchBtn}
                onPress={submitDispatch}
                disabled={dispatching}
              >
                {dispatching ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryText}>
                    Dispatch Item
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          ) : null}
        </>
      ) : null}
    </ScrollView>
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
    height: 320,
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

  scanPaused: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
  },

  scanPausedText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 8,
  },

  scanText: {
    color: "#93c5fd",
    textAlign: "center",
    fontWeight: "800",
    lineHeight: 20,
  },

  scanFrame: {
    position: "absolute",
    left: 46,
    right: 46,
    top: 70,
    bottom: 70,
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

  itemName: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "900",
  },

  itemSub: {
    color: "#94a3b8",
    fontWeight: "700",
    marginTop: 5,
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

  longBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,.035)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.06)",
  },

  longLabel: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "900",
    marginBottom: 5,
  },

  longValue: {
    color: "#e5e7eb",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
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

  selectWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  zoneChip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
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

  moveBtn: {
    height: 50,
    borderRadius: 15,
    backgroundColor: "#f59e0b",
    alignItems: "center",
    justifyContent: "center",
  },

  dispatchBtn: {
    height: 52,
    borderRadius: 15,
    backgroundColor: "#10b981",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
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