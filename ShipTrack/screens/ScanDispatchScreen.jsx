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

import TripStartPicker from "../components/TripStartPicker";

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

function formatStatus(value) {
  const text =
    String(value || "").trim();

  if (!text) {
    return "—";
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

function getResolvedItem(data) {
  return (
    data?.item ||
    data?.dispatchedItem ||
    data?.packetItem ||
    data ||
    {}
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

  const [notice, setNotice] =
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

  const item =
    useMemo(
      () => getResolvedItem(resolved),
      [resolved]
    );

  const status =
    normalizeStatus(item?.status);

  const fgOptions =
    getFgOptions(item);

  const needsFgMove =
    Boolean(resolved) &&
    status === "READY" &&
    !isLegacyLocationMissing(item) &&
    isPkdLocation(item);

  const canDispatch =
    Boolean(resolved) &&
    (
      status === "READY_TO_DISPATCH" ||
      (
        status === "READY" &&
        (
          isLegacyLocationMissing(item) ||
          isFgLocation(item)
        )
      )
    );

  const readiness =
    useMemo(() => {
      if (!resolved) {
        return {
          label: "Waiting",
          tone: "idle",
          message: "Scan a dispatch QR to begin.",
        };
      }

      if (needsFgMove) {
        return {
          label: "Need FG",
          tone: "warning",
          message: "Move this item to FG before dispatch.",
        };
      }

      if (canDispatch) {
        return {
          label: "Ready",
          tone: "success",
          message: "This item is ready for dispatch challan.",
        };
      }

      return {
        label: "Blocked",
        tone: "danger",
        message: `Current status is ${formatStatus(status)}. This item cannot be dispatched now.`,
      };
    }, [
      resolved,
      needsFgMove,
      canDispatch,
      status,
    ]);

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

  const update = (
    key,
    value
  ) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleBarcodeScanned =
    async ({
      data,
    }) => {
      if (!scannerActive || loading) {
        return;
      }

      const raw =
        String(data || "").trim();

      if (!raw) {
        return;
      }

      setScannerActive(false);
      setScanText(raw);

      await resolveQr(raw);
    };

  const resolveQr =
    async (
      raw,
      options = {}
    ) => {
      const silent =
        Boolean(options.silent);

      try {
        setLoading(true);

        const data =
          await resolveScan(raw);

        setResolved(data);

        const foundItem =
          getResolvedItem(data);

        const zoneOptions =
          getFgOptions(foundItem);

        if (zoneOptions.length === 1) {
          update("fgZoneCode", zoneOptions[0]);
        }

        if (!silent) {
          showNotice(
            "success",
            "QR resolved",
            "Item details loaded successfully."
          );
        }
      } catch (e) {
        setResolved(null);

        showNotice(
          "error",
          "Scan failed",
          getBackendMessage(
            e,
            "Unable to resolve QR"
          )
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
    setNotice(null);

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
      showNotice(
        "error",
        "Missing item",
        "Zoho item id not found."
      );
      return;
    }

    if (
      fgOptions.length > 0 &&
      !form.fgZoneCode
    ) {
      showNotice(
        "warning",
        "FG Zone required",
        "Please select FG zone before moving this item."
      );
      return;
    }

    try {
      setMovingFg(true);

      await moveItemToFg(
        zohoItemId,
        form.fgZoneCode
      );

      if (scanText) {
        await resolveQr(
          scanText,
          {
            silent: true,
          }
        );
      }

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
      setMovingFg(false);
    }
  };

  const submitDispatch = async () => {
    if (!scanText) {
      showNotice(
        "warning",
        "QR missing",
        "Please scan QR first."
      );
      return;
    }

    if (!canDispatch) {
      showNotice(
        "warning",
        "Not ready",
        needsFgMove
          ? "Move item to FG first."
          : "Item is not ready for dispatch."
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
        await dispatchSingleScan({
          scanText,
          rawScan: scanText,
          driverId: form.driverId,
          vehicleId: form.vehicleId,

          /*
           * Send both fields.
           * dispatchTime fixes PDF/challan date.
           * tripStart keeps old scanner trip logic safe.
           */
          dispatchTime: selectedDispatchTime,
          tripStart: selectedDispatchTime,

          remarks: form.remarks || "",
        });

      Alert.alert(
        "Dispatch created",
        result?.challanNo
          ? `Dispatch created. Challan: ${result.challanNo}`
          : "Dispatch challan generated successfully.",
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
      showNotice(
        "error",
        "Dispatch failed",
        getBackendMessage(
          e,
          "Unable to dispatch item"
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
        Single QR Dispatch
      </Text>

      <Text style={styles.sub}>
        Scan one item, move to FG if required, then create dispatch challan.
      </Text>

      <StatusNotice
        notice={notice}
        onClose={clearNotice}
      />

      <CompactStats
        role={normalizedRole}
        drivers={drivers.length}
        vehicles={vehicles.length}
        qrReady={Boolean(scanText)}
        readiness={readiness}
      />

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
              Refresh QR
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
                    getItemName(item)
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
                {formatStatus(status)}
              </Text>

              <Text style={styles.readinessText}>
                {readiness.message}
              </Text>
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
            <View style={styles.panelWarning}>
              <Text style={styles.panelTitle}>
                Move to FG Required
              </Text>

              <Text style={styles.panelSub}>
                This item is still in packing / PKD location. Move it to FG before dispatch.
              </Text>

              {fgOptions.length > 0 ? (
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>
                    FG Zone
                  </Text>

                  <View style={styles.selectWrap}>
                    {fgOptions.map((zone) => (
                      <TouchableOpacity
                        key={zone}
                        style={[
                          styles.zoneChip,
                          form.fgZoneCode === zone
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
                            form.fgZoneCode === zone
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
                Dispatch Challan Details
              </Text>

              <Text style={styles.panelSub}>
                Select driver, vehicle and challan date/time to dispatch this item.
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

                {selectedDriver ? (
                  <Text style={styles.selectionHint}>
                    Selected: {selectedDriver.name}
                  </Text>
                ) : null}
              </Field>

              <Field label="Vehicle">
                <View style={styles.selectBox}>
                  {vehicles.map((v) => {
                    const vehicleLabel =
                      v.vehicleNumber ||
                      v.registrationNumber ||
                      v.name ||
                      "Vehicle";

                    return (
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
                          {vehicleLabel}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {selectedVehicle ? (
                  <Text style={styles.selectionHint}>
                    Selected:{" "}
                    {selectedVehicle.vehicleNumber ||
                      selectedVehicle.registrationNumber ||
                      selectedVehicle.name ||
                      "Vehicle"}
                  </Text>
                ) : null}
              </Field>

              <TripStartPicker
                value={form.tripStart}
                onChange={(value) =>
                  update("tripStart", value)
                }
              />

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
  role,
  drivers,
  vehicles,
  qrReady,
  readiness,
}) {
  return (
    <View style={styles.statsGrid}>
      <MiniStat
        label="Role"
        value={role || "—"}
      />

      <MiniStat
        label="Drivers"
        value={drivers}
      />

      <MiniStat
        label="Vehicles"
        value={vehicles}
      />

      <MiniStat
        label="QR"
        value={qrReady ? "YES" : "NO"}
        active={qrReady}
      />

      <MiniStat
        label="Status"
        value={readiness.label}
        active={readiness.tone === "success"}
        warning={readiness.tone === "warning"}
      />
    </View>
  );
}

function MiniStat({
  label,
  value,
  active,
  warning,
}) {
  return (
    <View
      style={[
        styles.miniStat,
        active
          ? styles.miniStatActive
          : warning
            ? styles.miniStatWarning
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
    top: 64,
    bottom: 64,
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
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.08)",
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
    fontSize: 12,
  },

  statusBadge: {
    paddingHorizontal: 10,
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

  panelWarning: {
    backgroundColor: "#0f172a",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(245,158,11,.24)",
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

  selectionHint: {
    color: "#6ee7b7",
    fontWeight: "800",
    fontSize: 11,
    marginTop: 8,
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