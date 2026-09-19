import React, {
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import {
  useFocusEffect,
} from "@react-navigation/native";

import {
  CameraView,
  useCameraPermissions,
} from "expo-camera";

import * as Location from "expo-location";

import {
  useAuth,
} from "../auth/AuthContext";

import {
  getBackendMessage,
} from "../api/client";

import {
  safeOpenChallanPdf,
} from "../api/challanDownloadApi";

import {
  fetchDriverDeliveryChallans,
  submitDriverChallanDelivery,
} from "../api/siteLifecycleApi";

const clean = (value) =>
  String(value ?? "").trim();

function formatDateTime(value) {
  if (!value) {
    return "—";
  }

  const raw = clean(value);

  try {
    const match =
      raw.match(
        /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/
      );

    const date =
      match
        ? new Date(
            Number(match[1]),
            Number(match[2]) - 1,
            Number(match[3]),
            Number(match[4]),
            Number(match[5]),
            Number(match[6] || 0)
          )
        : new Date(raw);

    if (Number.isNaN(date.getTime())) {
      return raw;
    }

    return new Intl.DateTimeFormat(
      "en-IN",
      {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }
    ).format(date);
  } catch {
    return raw;
  }
}

function clientKey(challan) {
  return clean(challan?.clientName) || "Client";
}

function isEnded(challan) {
  return Boolean(
    challan?.tripEnded ||
    challan?.tripEndedAt
  );
}

export default function DriverDeliveriesScreen() {
  const {
    username,
    logout,
  } = useAuth();

  const cameraRef = useRef(null);

  const [
    cameraPermission,
    requestCameraPermission,
  ] = useCameraPermissions();

  const [
    rows,
    setRows,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    selected,
    setSelected,
  ] = useState(null);

  const [
    cameraOpen,
    setCameraOpen,
  ] = useState(false);

  const [
    capturing,
    setCapturing,
  ] = useState(false);

  const [
    photos,
    setPhotos,
  ] = useState([]);

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  const [
    notice,
    setNotice,
  ] = useState("");

  const [
    optionalOpen,
    setOptionalOpen,
  ] = useState(false);

  const [
    receiverName,
    setReceiverName,
  ] = useState("");

  const [
    receiverPhone,
    setReceiverPhone,
  ] = useState("");

  const [
    remarks,
    setRemarks,
  ] = useState("");

  const load = useCallback(
    async ({
      silent = false,
    } = {}) => {
      try {
        if (!silent) {
          setLoading(true);
        }

        const data =
          await fetchDriverDeliveryChallans();

        setRows(
          Array.isArray(data)
            ? data
            : []
        );
      } catch (error) {
        if (!silent) {
          Alert.alert(
            "Deliveries unavailable",
            getBackendMessage(
              error,
              "Unable to load your assigned challans."
            )
          );
        }
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    []
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;

      void load();

      const timer =
        setInterval(() => {
          if (active) {
            void load({
              silent: true,
            });
          }
        }, 45000);

      return () => {
        active = false;
        clearInterval(timer);
      };
    }, [load])
  );

  const refresh =
    useCallback(async () => {
      try {
        setRefreshing(true);
        await load({
          silent: true,
        });
      } finally {
        setRefreshing(false);
      }
    }, [load]);

  const activeRows =
    useMemo(
      () =>
        rows.filter(
          (row) => !isEnded(row)
        ),
      [rows]
    );

  const completedRows =
    useMemo(
      () =>
        rows.filter(
          (row) => isEnded(row)
        ),
      [rows]
    );

  const groupedActive =
    useMemo(() => {
      const map =
        new Map();

      activeRows.forEach(
        (row) => {
          const key =
            clientKey(row);

          if (!map.has(key)) {
            map.set(
              key,
              []
            );
          }

          map.get(key).push(row);
        }
      );

      return Array.from(
        map.entries()
      );
    }, [activeRows]);

  const openDelivery =
    useCallback((challan) => {
      setSelected(challan);
      setPhotos([]);
      setReceiverName("");
      setReceiverPhone("");
      setRemarks("");
      setOptionalOpen(false);
      setCameraOpen(false);
      setNotice("");
    }, []);

  const closeDelivery =
    useCallback(() => {
      if (submitting) {
        return;
      }

      setSelected(null);
      setPhotos([]);
      setCameraOpen(false);
      setOptionalOpen(false);
    }, [submitting]);

  const openCamera =
    useCallback(async () => {
      if (photos.length >= 4) {
        Alert.alert(
          "Photo limit",
          "A maximum of 4 delivery photos can be added."
        );
        return;
      }

      let granted =
        Boolean(
          cameraPermission?.granted
        );

      if (!granted) {
        const next =
          await requestCameraPermission();

        granted =
          Boolean(next?.granted);
      }

      if (!granted) {
        Alert.alert(
          "Camera required",
          "Allow camera access to capture delivery proof."
        );
        return;
      }

      setCameraOpen(true);
    }, [
      cameraPermission,
      requestCameraPermission,
      photos.length,
    ]);

  const capturePhoto =
    useCallback(async () => {
      if (
        !cameraRef.current ||
        capturing
      ) {
        return;
      }

      try {
        setCapturing(true);

        const picture =
          await cameraRef.current
            .takePictureAsync({
              quality: 0.55,
              skipProcessing: false,
            });

        if (!picture?.uri) {
          throw new Error(
            "Camera did not return a photo."
          );
        }

        setPhotos(
          (current) => [
            ...current,
            {
              uri: picture.uri,
            },
          ].slice(0, 4)
        );

        setCameraOpen(false);
      } catch (error) {
        Alert.alert(
          "Photo failed",
          error?.message ||
            "Unable to capture photo."
        );
      } finally {
        setCapturing(false);
      }
    }, [capturing]);

  const removePhoto =
    useCallback((index) => {
      if (submitting) {
        return;
      }

      setPhotos(
        (current) =>
          current.filter(
            (_, rowIndex) =>
              rowIndex !== index
          )
      );
    }, [submitting]);

  const fetchFreshLocation =
    useCallback(async () => {
      const permission =
        await Location
          .requestForegroundPermissionsAsync();

      if (
        permission?.status !==
        "granted"
      ) {
        throw new Error(
          "Location permission is required to confirm delivery."
        );
      }

      const location =
        await Location
          .getCurrentPositionAsync({
            accuracy:
              Location.Accuracy.High,
          });

      const accuracy =
        Number(
          location?.coords
            ?.accuracy
        );

      if (
        Number.isFinite(
          accuracy
        ) &&
        accuracy > 500
      ) {
        throw new Error(
          `GPS accuracy is too low (±${Math.round(
            accuracy
          )} m). Move to a clearer location and try again.`
        );
      }

      return location;
    }, []);

  const performDelivery =
    useCallback(async () => {
      if (!selected) {
        return;
      }

      if (photos.length < 1) {
        Alert.alert(
          "Photo required",
          "Take one site photo before confirming delivery."
        );
        return;
      }

      try {
        setSubmitting(true);
        setNotice(
          "Getting current location…"
        );

        const location =
          await fetchFreshLocation();

        setNotice(
          "Saving delivery proof…"
        );

        const result =
          await submitDriverChallanDelivery({
            challanNumber:
              selected.challanNumber,
            location,
            receiverName,
            receiverPhone,
            remarks,
            photos,
          });

        setNotice("");

        await load({
          silent: true,
        });

        setSelected(null);
        setPhotos([]);
        setCameraOpen(false);

        Alert.alert(
          "Delivery completed",
          `${result?.challanNumber || selected.challanNumber} delivered. ${Number(result?.totalPackets || selected?.totalPackets || 0)} packet(s) were updated and the trip was ended.`
        );
      } catch (error) {
        setNotice("");

        Alert.alert(
          "Delivery not saved",
          getBackendMessage(
            error,
            "Unable to confirm delivery."
          )
        );
      } finally {
        setSubmitting(false);
      }
    }, [
      selected,
      photos,
      fetchFreshLocation,
      receiverName,
      receiverPhone,
      remarks,
      load,
    ]);

  const confirmDelivery =
    useCallback(() => {
      if (!selected) {
        return;
      }

      Alert.alert(
        "Confirm delivery",
        `Mark all ${Number(
          selected?.totalPackets || 0
        )} packet(s) under challan ${
          selected?.challanNumber || ""
        } as delivered and end this trip?`,
        [
          {
            text: "Cancel",
            style: "cancel",
          },
          {
            text:
              "Delivered & End Trip",
            onPress: () =>
              void performDelivery(),
          },
        ]
      );
    }, [
      selected,
      performDelivery,
    ]);

  const handleLogout =
    useCallback(() => {
      Alert.alert(
        "Logout",
        "Logout from ShipTrack?",
        [
          {
            text: "Cancel",
            style: "cancel",
          },
          {
            text: "Logout",
            style:
              "destructive",
            onPress: () =>
              void logout(),
          },
        ]
      );
    }, [logout]);

  if (
    loading &&
    rows.length === 0
  ) {
    return (
      <View style={styles.center}>
        <ActivityIndicator
          size="large"
        />

        <Text style={styles.centerText}>
          Loading your deliveries…
        </Text>
      </View>
    );
  }

  if (selected) {
    return (
      <View style={styles.page}>
        <ScrollView
          contentContainerStyle={
            styles.deliveryContent
          }
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity
            style={styles.backButton}
            onPress={closeDelivery}
            disabled={submitting}
          >
            <Text style={styles.backText}>
              ← Back
            </Text>
          </TouchableOpacity>

          <Text style={styles.kicker}>
            DELIVERY CONFIRMATION
          </Text>

          <Text style={styles.deliveryTitle}>
            {selected?.clientName ||
              "Client"}
          </Text>

          <Text style={styles.deliverySub}>
            One confirmation updates every
            packet in this challan.
          </Text>

          <View style={styles.heroCard}>
            <InfoLine
              label="Challan"
              value={
                selected?.challanNumber
              }
            />

            <InfoLine
              label="Packets"
              value={`${Number(
                selected?.deliveredPackets ||
                  0
              )}/${Number(
                selected?.totalPackets ||
                  0
              )} delivered`}
            />

            <InfoLine
              label="Vehicle"
              value={
                selected?.vehicleNumber ||
                "—"
              }
            />

            <InfoLine
              label="Started"
              value={formatDateTime(
                selected?.tripStartedAt ||
                  selected?.dispatchedAt
              )}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              1. Take site photo
            </Text>

            <Text style={styles.sectionSub}>
              One clear photo is enough. You
              can add up to 4.
            </Text>

            <View style={styles.photoGrid}>
              {photos.map(
                (photo, index) => (
                  <TouchableOpacity
                    key={`${photo.uri}-${index}`}
                    style={
                      styles.photoWrap
                    }
                    onPress={() =>
                      removePhoto(index)
                    }
                    disabled={
                      submitting
                    }
                  >
                    <Image
                      source={{
                        uri: photo.uri,
                      }}
                      style={
                        styles.photo
                      }
                    />

                    <View
                      style={
                        styles.removeBadge
                      }
                    >
                      <Text
                        style={
                          styles.removeText
                        }
                      >
                        ×
                      </Text>
                    </View>
                  </TouchableOpacity>
                )
              )}

              {photos.length < 4 ? (
                <TouchableOpacity
                  style={
                    styles.addPhoto
                  }
                  onPress={
                    openCamera
                  }
                  disabled={
                    submitting
                  }
                >
                  <Text
                    style={
                      styles.addPhotoIcon
                    }
                  >
                    +
                  </Text>

                  <Text
                    style={
                      styles.addPhotoText
                    }
                  >
                    Take Photo
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          <TouchableOpacity
            style={styles.optionalToggle}
            onPress={() =>
              setOptionalOpen(
                (current) =>
                  !current
              )
            }
            disabled={submitting}
          >
            <Text
              style={
                styles.optionalToggleText
              }
            >
              {optionalOpen
                ? "Hide optional details"
                : "Optional receiver / remarks"}
            </Text>
          </TouchableOpacity>

          {optionalOpen ? (
            <View style={styles.section}>
              <TextInput
                value={receiverName}
                onChangeText={
                  setReceiverName
                }
                placeholder="Receiver name"
                placeholderTextColor="#64748b"
                style={styles.input}
                editable={!submitting}
              />

              <TextInput
                value={receiverPhone}
                onChangeText={
                  setReceiverPhone
                }
                placeholder="Receiver phone"
                placeholderTextColor="#64748b"
                keyboardType="phone-pad"
                style={styles.input}
                editable={!submitting}
              />

              <TextInput
                value={remarks}
                onChangeText={
                  setRemarks
                }
                placeholder="Remarks"
                placeholderTextColor="#64748b"
                multiline
                style={[
                  styles.input,
                  styles.remarksInput,
                ]}
                editable={!submitting}
              />
            </View>
          ) : null}

          {notice ? (
            <View style={styles.notice}>
              <ActivityIndicator
                size="small"
              />

              <Text style={styles.noticeText}>
                {notice}
              </Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[
              styles.deliverButton,
              submitting ||
              photos.length < 1
                ? styles.disabled
                : null,
            ]}
            onPress={confirmDelivery}
            disabled={
              submitting ||
              photos.length < 1
            }
          >
            {submitting ? (
              <ActivityIndicator
                color="#fff"
              />
            ) : (
              <Text
                style={
                  styles.deliverButtonText
                }
              >
                Delivered & End Trip
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.pdfButton}
            onPress={() =>
              safeOpenChallanPdf(
                selected
                  ?.challanNumber
              )
            }
            disabled={submitting}
          >
            <Text
              style={
                styles.pdfButtonText
              }
            >
              Open Challan PDF
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {cameraOpen ? (
          <View style={styles.cameraLayer}>
            <CameraView
              ref={cameraRef}
              style={styles.camera}
              facing="back"
            />

            <View
              style={
                styles.cameraControls
              }
            >
              <TouchableOpacity
                style={
                  styles.cameraCancel
                }
                onPress={() =>
                  setCameraOpen(false)
                }
                disabled={capturing}
              >
                <Text
                  style={
                    styles.cameraCancelText
                  }
                >
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={
                  styles.shutter
                }
                onPress={
                  capturePhoto
                }
                disabled={capturing}
              >
                {capturing ? (
                  <ActivityIndicator />
                ) : (
                  <View
                    style={
                      styles.shutterInner
                    }
                  />
                )}
              </TouchableOpacity>

              <View
                style={{
                  width: 72,
                }}
              />
            </View>
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
          />
        }
        contentContainerStyle={
          styles.content
        }
      >
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>
              SHIPTRACK DRIVER
            </Text>

            <Text style={styles.title}>
              My Deliveries
            </Text>

            <Text style={styles.subTitle}>
              {username || "Driver"} • no
              packet scanning required
            </Text>
          </View>

          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
          >
            <Text style={styles.logoutText}>
              Logout
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.summaryRow}>
          <Summary
            value={activeRows.length}
            label="Pending"
          />

          <Summary
            value={completedRows.length}
            label="Completed"
          />

          <Summary
            value={activeRows.reduce(
              (sum, row) =>
                sum +
                Number(
                  row?.totalPackets ||
                    0
                ),
              0
            )}
            label="Packets"
          />
        </View>

        <View style={styles.helperBox}>
          <Text style={styles.helperTitle}>
            Simple delivery flow
          </Text>

          <Text style={styles.helperText}>
            Open the correct client challan,
            take one site photo, then tap
            “Delivered & End Trip”. ShipTrack
            updates every packet in that
            challan automatically.
          </Text>
        </View>

        {groupedActive.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>
              No pending delivery
            </Text>

            <Text style={styles.emptyText}>
              Pull down to refresh. Newly
              assigned challans will appear
              here automatically while the
              app is open.
            </Text>
          </View>
        ) : (
          groupedActive.map(
            ([
              clientName,
              challans,
            ]) => (
              <View
                key={clientName}
                style={
                  styles.clientSection
                }
              >
                <Text
                  style={
                    styles.clientName
                  }
                >
                  {clientName}
                </Text>

                <Text
                  style={
                    styles.clientCount
                  }
                >
                  {challans.length} challan
                  {challans.length === 1
                    ? ""
                    : "s"}
                </Text>

                {challans.map(
                  (challan) => (
                    <DriverChallanCard
                      key={
                        challan.challanNumber
                      }
                      challan={
                        challan
                      }
                      onDeliver={() =>
                        openDelivery(
                          challan
                        )
                      }
                    />
                  )
                )}
              </View>
            )
          )
        )}

        {completedRows.length > 0 ? (
          <View style={styles.completedSection}>
            <Text
              style={
                styles.completedTitle
              }
            >
              Recently completed
            </Text>

            {completedRows.map(
              (challan) => (
                <View
                  key={`done-${challan.challanNumber}`}
                  style={
                    styles.completedCard
                  }
                >
                  <View
                    style={{
                      flex: 1,
                    }}
                  >
                    <Text
                      style={
                        styles.completedClient
                      }
                    >
                      {challan.clientName ||
                        "Client"}
                    </Text>

                    <Text
                      style={
                        styles.completedMeta
                      }
                    >
                      {challan.challanNumber} •{" "}
                      {Number(
                        challan.totalPackets ||
                          0
                      )} packet(s)
                    </Text>
                  </View>

                  <Text
                    style={
                      styles.doneBadge
                    }
                  >
                    DONE
                  </Text>
                </View>
              )
            )}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function DriverChallanCard({
  challan,
  onDeliver,
}) {
  const total =
    Number(
      challan?.totalPackets || 0
    );

  const delivered =
    Number(
      challan?.deliveredPackets ||
        0
    );

  return (
    <View style={styles.challanCard}>
      <View style={styles.challanHead}>
        <View style={{ flex: 1 }}>
          <Text style={styles.challanNo}>
            {challan?.challanNumber ||
              "—"}
          </Text>

          <Text style={styles.challanMeta}>
            {total} packet
            {total === 1 ? "" : "s"} •{" "}
            {challan?.vehicleNumber ||
              "Vehicle not set"}
          </Text>
        </View>

        <View style={styles.runningBadge}>
          <Text style={styles.runningText}>
            RUNNING
          </Text>
        </View>
      </View>

      <View style={styles.progressBox}>
        <Text style={styles.progressText}>
          {delivered}/{total} already
          delivered
        </Text>

        <Text style={styles.startText}>
          Started{" "}
          {formatDateTime(
            challan?.tripStartedAt ||
              challan?.dispatchedAt
          )}
        </Text>
      </View>

      <TouchableOpacity
        style={styles.primaryCardButton}
        onPress={onDeliver}
      >
        <Text
          style={
            styles.primaryCardButtonText
          }
        >
          Deliver This Challan
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.linkButton}
        onPress={() =>
          safeOpenChallanPdf(
            challan?.challanNumber
          )
        }
      >
        <Text style={styles.linkText}>
          Open Challan PDF
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function Summary({
  value,
  label,
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

function InfoLine({
  label,
  value,
}) {
  return (
    <View style={styles.infoLine}>
      <Text style={styles.infoLabel}>
        {label}
      </Text>

      <Text style={styles.infoValue}>
        {clean(value) || "—"}
      </Text>
    </View>
  );
}

const styles = {
  page: {
    flex: 1,
    backgroundColor: "#020617",
  },

  center: {
    flex: 1,
    backgroundColor: "#020617",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },

  centerText: {
    color: "#cbd5e1",
    marginTop: 12,
    fontWeight: "700",
  },

  content: {
    padding: 18,
    paddingBottom: 42,
  },

  deliveryContent: {
    padding: 18,
    paddingBottom: 42,
  },

  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 20,
  },

  kicker: {
    color: "#60a5fa",
    fontSize: 11,
    letterSpacing: 1.4,
    fontWeight: "900",
    marginBottom: 6,
  },

  title: {
    color: "#fff",
    fontSize: 30,
    fontWeight: "900",
  },

  subTitle: {
    color: "#94a3b8",
    fontSize: 13,
    marginTop: 6,
  },

  logoutButton: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.12)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },

  logoutText: {
    color: "#cbd5e1",
    fontWeight: "800",
    fontSize: 12,
  },

  summaryRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },

  summaryCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.10)",
    backgroundColor: "rgba(255,255,255,.045)",
    padding: 14,
  },

  summaryValue: {
    color: "#fff",
    fontSize: 23,
    fontWeight: "900",
  },

  summaryLabel: {
    color: "#94a3b8",
    marginTop: 4,
    fontSize: 11,
    fontWeight: "800",
  },

  helperBox: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(59,130,246,.28)",
    backgroundColor: "rgba(37,99,235,.10)",
    padding: 14,
    marginBottom: 22,
  },

  helperTitle: {
    color: "#bfdbfe",
    fontWeight: "900",
    marginBottom: 5,
  },

  helperText: {
    color: "#93c5fd",
    lineHeight: 19,
    fontSize: 13,
  },

  emptyCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.10)",
    padding: 22,
    alignItems: "center",
  },

  emptyTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "900",
  },

  emptyText: {
    color: "#94a3b8",
    textAlign: "center",
    lineHeight: 20,
    marginTop: 7,
  },

  clientSection: {
    marginBottom: 22,
  },

  clientName: {
    color: "#fff",
    fontSize: 19,
    fontWeight: "900",
  },

  clientCount: {
    color: "#64748b",
    marginTop: 3,
    marginBottom: 10,
    fontWeight: "700",
    fontSize: 12,
  },

  challanCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.10)",
    backgroundColor: "#0f172a",
    padding: 16,
    marginBottom: 12,
  },

  challanHead: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },

  challanNo: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "900",
  },

  challanMeta: {
    color: "#94a3b8",
    marginTop: 5,
    fontSize: 12,
    fontWeight: "700",
  },

  runningBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(245,158,11,.35)",
    backgroundColor: "rgba(245,158,11,.12)",
    paddingHorizontal: 9,
    paddingVertical: 5,
  },

  runningText: {
    color: "#fbbf24",
    fontSize: 10,
    fontWeight: "900",
  },

  progressBox: {
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,.04)",
    padding: 11,
    marginTop: 13,
  },

  progressText: {
    color: "#e2e8f0",
    fontWeight: "800",
    fontSize: 12,
  },

  startText: {
    color: "#64748b",
    marginTop: 4,
    fontSize: 11,
  },

  primaryCardButton: {
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
  },

  primaryCardButtonText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 15,
  },

  linkButton: {
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
  },

  linkText: {
    color: "#93c5fd",
    fontWeight: "800",
    fontSize: 12,
  },

  completedSection: {
    marginTop: 8,
  },

  completedTitle: {
    color: "#cbd5e1",
    fontWeight: "900",
    fontSize: 14,
    marginBottom: 10,
  },

  completedCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(16,185,129,.18)",
    backgroundColor: "rgba(16,185,129,.06)",
    padding: 13,
    marginBottom: 8,
  },

  completedClient: {
    color: "#e2e8f0",
    fontWeight: "800",
  },

  completedMeta: {
    color: "#64748b",
    marginTop: 4,
    fontSize: 11,
  },

  doneBadge: {
    color: "#6ee7b7",
    fontWeight: "900",
    fontSize: 10,
  },

  backButton: {
    alignSelf: "flex-start",
    paddingVertical: 8,
    marginBottom: 8,
  },

  backText: {
    color: "#93c5fd",
    fontWeight: "900",
  },

  deliveryTitle: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "900",
  },

  deliverySub: {
    color: "#94a3b8",
    marginTop: 6,
    lineHeight: 19,
  },

  heroCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.10)",
    backgroundColor: "#0f172a",
    padding: 15,
    marginTop: 18,
  },

  infoLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,.05)",
  },

  infoLabel: {
    width: 76,
    color: "#64748b",
    fontSize: 11,
    fontWeight: "800",
  },

  infoValue: {
    flex: 1,
    color: "#e2e8f0",
    fontWeight: "800",
  },

  section: {
    marginTop: 22,
  },

  sectionTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "900",
  },

  sectionSub: {
    color: "#64748b",
    marginTop: 5,
    fontSize: 12,
  },

  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 12,
  },

  photoWrap: {
    width: 96,
    height: 96,
    borderRadius: 14,
    overflow: "hidden",
    position: "relative",
  },

  photo: {
    width: "100%",
    height: "100%",
  },

  removeBadge: {
    position: "absolute",
    right: 6,
    top: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(2,6,23,.82)",
    alignItems: "center",
    justifyContent: "center",
  },

  removeText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 16,
    lineHeight: 18,
  },

  addPhoto: {
    width: 96,
    height: 96,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(96,165,250,.45)",
    backgroundColor: "rgba(37,99,235,.08)",
    alignItems: "center",
    justifyContent: "center",
  },

  addPhotoIcon: {
    color: "#93c5fd",
    fontSize: 28,
    lineHeight: 30,
  },

  addPhotoText: {
    color: "#93c5fd",
    fontSize: 11,
    fontWeight: "800",
    marginTop: 4,
  },

  optionalToggle: {
    marginTop: 20,
    paddingVertical: 11,
  },

  optionalToggleText: {
    color: "#93c5fd",
    fontWeight: "800",
    fontSize: 12,
  },

  input: {
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.10)",
    backgroundColor: "rgba(255,255,255,.045)",
    color: "#fff",
    paddingHorizontal: 14,
    marginBottom: 10,
  },

  remarksInput: {
    minHeight: 86,
    paddingTop: 13,
    textAlignVertical: "top",
  },

  notice: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    marginTop: 18,
    borderRadius: 12,
    padding: 12,
    backgroundColor: "rgba(59,130,246,.10)",
  },

  noticeText: {
    color: "#bfdbfe",
    fontWeight: "700",
  },

  deliverButton: {
    minHeight: 56,
    borderRadius: 16,
    backgroundColor: "#16a34a",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 22,
  },

  deliverButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "900",
  },

  disabled: {
    opacity: 0.48,
  },

  pdfButton: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.10)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },

  pdfButtonText: {
    color: "#cbd5e1",
    fontWeight: "800",
  },

  cameraLayer: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "#000",
  },

  camera: {
    flex: 1,
  },

  cameraControls: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  cameraCancel: {
    width: 72,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: "rgba(2,6,23,.72)",
    alignItems: "center",
    justifyContent: "center",
  },

  cameraCancelText: {
    color: "#fff",
    fontWeight: "900",
  },

  shutter: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 4,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },

  shutterInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#fff",
  },
};
