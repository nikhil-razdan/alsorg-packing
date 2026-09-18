import React, { useEffect, useMemo, useRef, useState } from "react";

import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { CameraView, useCameraPermissions } from "expo-camera";
import * as Location from "expo-location";

import { useAuth } from "../auth/AuthContext";
import { buildStickerScanText } from "../api/dispatchApi";
import { getBackendMessage } from "../api/client";
import {
  resolveSitePacket,
  submitSiteDelivery,
  submitSiteOpening,
} from "../api/siteLifecycleApi";

const clean = (value) => String(value ?? "").trim();
const normalize = (value) => clean(value).toUpperCase();
const pretty = (value) => clean(value || "AWAITING_DELIVERY").replace(/_/g, " ");

function formatDateTime(value) {
  if (!value) return "—";

  const raw = String(value).trim();

  try {
    const match = raw.match(
      /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/
    );

    const date = match
      ? new Date(
          Number(match[1]),
          Number(match[2]) - 1,
          Number(match[3]),
          Number(match[4]),
          Number(match[5]),
          Number(match[6] || 0)
        )
      : new Date(raw);

    if (Number.isNaN(date.getTime())) return raw;

    return new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(date);
  } catch {
    return raw;
  }
}

function packetIdentity(data, scanText) {
  return normalize(
    data?.packetItemId ||
      data?.stickerNumber ||
      data?.packetNumber ||
      scanText
  );
}

function packetLabel(row) {
  const data = row?.data || {};

  return (
    clean(data?.packetNumber) ||
    clean(data?.stickerNumber) ||
    clean(data?.sku) ||
    clean(row?.scanText) ||
    "Packet"
  );
}

export default function SiteLifecycleScreen({
  route,
  navigation,
  initialMode,
}) {
  const { hasRole, username, logout } = useAuth();

  const canDelivery = hasRole("DRIVER") || hasRole("ADMIN");
  const canOpening =
    hasRole("ONSITE") || hasRole("LOGISTICS") || hasRole("ADMIN");

  const requestedMode = normalize(route?.params?.mode || initialMode);

  const defaultMode =
    requestedMode === "OPENING" && canOpening
      ? "OPENING"
      : requestedMode === "DELIVERY" && canDelivery
        ? "DELIVERY"
        : canDelivery
          ? "DELIVERY"
          : "OPENING";

  const [mode, setMode] = useState(defaultMode);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);
  const scanGuardRef = useRef({ value: "", at: 0 });

  const [cameraPurpose, setCameraPurpose] = useState("SCAN");
  const [scannerEnabled, setScannerEnabled] = useState(true);
  const [scanText, setScanText] = useState("");
  const [manualSticker, setManualSticker] = useState("");
  const [resolved, setResolved] = useState(null);

  /*
   * DELIVERY is always a continuous scan session.
   * There is deliberately no Single/Bulk selector and no challan lock/count.
   * Every accepted QR has already been authorized by the backend against the
   * logged-in DRIVER's assigned Driver master.
   */
  const [deliveryRows, setDeliveryRows] = useState([]);
  const [deliveryProofReady, setDeliveryProofReady] = useState(false);
  const [scanNotice, setScanNotice] = useState("");
  const [scanNoticeError, setScanNoticeError] = useState(false);
  const [deliveryProgress, setDeliveryProgress] = useState("");

  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [receiverName, setReceiverName] = useState("");
  const [receiverPhone, setReceiverPhone] = useState("");
  const [remarks, setRemarks] = useState("");
  const [lastResult, setLastResult] = useState(null);

  useEffect(() => {
    setMode(defaultMode);
  }, [defaultMode]);

  const isDelivery = mode === "DELIVERY";
  const maxPhotos = isDelivery ? 4 : 2;
  const photoRequired = isDelivery;
  const siteStatus = normalize(resolved?.siteStatus || "AWAITING_DELIVERY");

  const modeTitle = isDelivery
    ? "Driver Delivery Proof"
    : "On-site Packet Opening";

  const modeSub = isDelivery
    ? "Keep scanning every packet assigned to you. When you are done, add one site photo + fresh GPS and confirm the complete scanned set."
    : "Scan a delivered packet when it is physically opened and record the opening time/GPS.";

  const statusTone = useMemo(() => {
    if (siteStatus === "OPENED_ON_SITE") return styles.goodBadge;
    if (siteStatus === "DELIVERED") return styles.deliveredBadge;
    return styles.waitBadge;
  }, [siteStatus]);

  const ensureCameraPermission = async () => {
    if (permission?.granted) return true;

    const next = await requestPermission();
    return Boolean(next?.granted);
  };

  const resetSession = () => {
    setResolved(null);
    setScanText("");
    setManualSticker("");

    setDeliveryRows([]);
    setDeliveryProofReady(false);
    setScanNotice("");
    setScanNoticeError(false);
    setDeliveryProgress("");

    setPhotos([]);
    setReceiverName("");
    setReceiverPhone("");
    setRemarks("");

    setCameraPurpose("SCAN");
    setScannerEnabled(true);
    scanGuardRef.current = { value: "", at: 0 };
  };

  const switchMode = (nextMode) => {
    if (nextMode === mode) return;

    resetSession();
    setLastResult(null);
    setMode(nextMode);
  };

  const addDeliveryPacket = (raw, data) => {
    const identity = packetIdentity(data, raw);

    if (!identity) {
      setScanNotice("This QR resolved without a physical packet identity. Scan the current packet sticker again.");
      setScanNoticeError(true);
      setScannerEnabled(true);
      return false;
    }

    const duplicate = deliveryRows.some(
      (row) => packetIdentity(row.data, row.scanText) === identity
    );

    if (duplicate) {
      setScanNotice(`${packetLabel({ scanText: raw, data })} is already scanned.`);
      setScanNoticeError(false);
      setManualSticker("");
      setScannerEnabled(true);
      return false;
    }

    const nextRows = [
      ...deliveryRows,
      {
        scanText: raw,
        data,
      },
    ];

    setDeliveryRows(nextRows);
    setManualSticker("");
    setResolved(null);
    setScanText("");
    setDeliveryProofReady(false);
    setScanNotice(
      `${packetLabel({ scanText: raw, data })} accepted • ${nextRows.length} packet${nextRows.length === 1 ? "" : "s"} scanned`
    );
    setScanNoticeError(false);
    setScannerEnabled(true);

    return true;
  };

  const resolvePacket = async (value) => {
    const raw = clean(value);
    if (!raw) return false;

    try {
      setLoading(true);

      const data = await resolveSitePacket(raw, mode);

      if (isDelivery) {
        return addDeliveryPacket(raw, data);
      }

      setResolved(data);
      setScanText(raw);
      setScannerEnabled(false);
      setCameraPurpose("SCAN");
      setPhotos([]);
      return true;
    } catch (error) {
      const message = getBackendMessage(error, "Unable to resolve packet");

      if (isDelivery) {
        /*
         * Do not interrupt a high-volume scan run with modal alerts. A wrong,
         * unassigned or differently-assigned packet is rejected by the backend,
         * shown inline, and the camera is immediately re-armed.
         */
        setScanNotice(message);
        setScanNoticeError(true);
        setScannerEnabled(true);
      } else {
        Alert.alert("Packet not accepted", message);
        setScannerEnabled(true);
      }

      return false;
    } finally {
      setLoading(false);
    }
  };

  const onBarcodeScanned = async ({ data }) => {
    if (!scannerEnabled || loading || cameraPurpose !== "SCAN") return;

    const raw = clean(data);
    if (!raw) return;

    const now = Date.now();
    const last = scanGuardRef.current;

    if (
      normalize(last?.value) === normalize(raw) &&
      now - Number(last?.at || 0) < 1400
    ) {
      return;
    }

    scanGuardRef.current = {
      value: raw,
      at: now,
    };

    setScannerEnabled(false);
    const ok = await resolvePacket(raw);

    if (!ok && isDelivery) {
      setScannerEnabled(true);
    }
  };

  const submitManual = async () => {
    try {
      const value = buildStickerScanText(manualSticker);
      await resolvePacket(value);
    } catch (error) {
      if (isDelivery) {
        setScanNotice(error?.message || "Enter Sticker Number");
        setScanNoticeError(true);
      } else {
        Alert.alert("Sticker Number", error?.message || "Enter Sticker Number");
      }
    }
  };

  const removeDeliveryPacket = (index) => {
    if (deliveryProofReady || submitting) return;

    setDeliveryRows((current) =>
      current.filter((_, rowIndex) => rowIndex !== index)
    );
  };

  const clearDeliveryScans = () => {
    setDeliveryRows([]);
    setDeliveryProofReady(false);
    setResolved(null);
    setScanText("");
    setManualSticker("");
    setScanNotice("");
    setScanNoticeError(false);
    setDeliveryProgress("");
    setPhotos([]);
    setReceiverName("");
    setReceiverPhone("");
    setRemarks("");
    setCameraPurpose("SCAN");
    setScannerEnabled(true);
    scanGuardRef.current = { value: "", at: 0 };
  };

  const continueToDeliveryProof = () => {
    if (deliveryRows.length < 1) {
      Alert.alert("Scan required", "Scan at least one assigned packet first.");
      return;
    }

    setDeliveryProofReady(true);
    setScannerEnabled(false);
    setCameraPurpose("SCAN");
    setScanNotice("");
    setScanNoticeError(false);
  };

  const returnToDeliveryScanning = () => {
    if (submitting) return;

    setDeliveryProofReady(false);
    setCameraPurpose("SCAN");
    setScannerEnabled(true);
    setDeliveryProgress("");
    scanGuardRef.current = { value: "", at: 0 };
  };

  const startPhoto = async () => {
    if (isDelivery) {
      if (!deliveryProofReady || deliveryRows.length < 1) {
        Alert.alert("Finish scanning first", "Scan the packets, then continue to the proof step.");
        return;
      }
    } else if (!resolved) {
      Alert.alert("Scan first", "Scan the packet before taking evidence photos.");
      return;
    }

    if (photos.length >= maxPhotos) {
      Alert.alert(
        "Photo limit",
        `Maximum ${maxPhotos} photo${maxPhotos === 1 ? "" : "s"} allowed.`
      );
      return;
    }

    const allowed = await ensureCameraPermission();

    if (!allowed) {
      Alert.alert(
        "Camera required",
        "Camera permission is required to capture site evidence."
      );
      return;
    }

    setCameraPurpose("PHOTO");
  };

  const capturePhoto = async () => {
    if (!cameraRef.current || capturing) return;

    try {
      setCapturing(true);

      const picture = await cameraRef.current.takePictureAsync({
        quality: 0.45,
        skipProcessing: false,
      });

      if (picture?.uri) {
        setPhotos((current) =>
          [...current, { uri: picture.uri }].slice(0, maxPhotos)
        );
      }

      setCameraPurpose("SCAN");
    } catch (error) {
      Alert.alert("Photo failed", error?.message || "Unable to capture photo");
    } finally {
      setCapturing(false);
    }
  };

  const removePhoto = (index) => {
    setPhotos((current) =>
      current.filter((_, photoIndex) => photoIndex !== index)
    );
  };

  const captureFreshLocation = async () => {
    const permissionResult = await Location.requestForegroundPermissionsAsync();

    if (permissionResult?.status !== "granted") {
      throw new Error(
        "Foreground location permission is required to record site proof."
      );
    }

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    const accuracy = Number(location?.coords?.accuracy);

    if (!Number.isFinite(accuracy) || accuracy <= 0 || accuracy > 500) {
      throw new Error(
        Number.isFinite(accuracy)
          ? `GPS accuracy is ±${Math.round(accuracy)} m. Move to a clearer location and try again.`
          : "A reliable GPS fix could not be obtained."
      );
    }

    return location;
  };

  const preflightDeliveryRows = async () => {
    const verifiedRows = [];
    const seen = new Set();

    for (let index = 0; index < deliveryRows.length; index += 1) {
      const row = deliveryRows[index];
      setDeliveryProgress(
        `Verifying ${index + 1}/${deliveryRows.length}…`
      );

      const data = await resolveSitePacket(row.scanText, "DELIVERY");
      const identity = packetIdentity(data, row.scanText);

      if (!identity) {
        throw new Error(`Packet ${index + 1} no longer has a valid physical packet identity.`);
      }

      if (seen.has(identity)) {
        throw new Error("The scanned set contains the same physical packet more than once.");
      }

      seen.add(identity);
      verifiedRows.push({
        scanText: row.scanText,
        data,
      });
    }

    return verifiedRows;
  };

  const confirmDeliverySet = async () => {
    if (!deliveryProofReady || deliveryRows.length < 1) {
      Alert.alert("Scans required", "Scan at least one assigned packet first.");
      return;
    }

    if (photoRequired && photos.length < 1) {
      Alert.alert(
        "Delivery photo required",
        "Take at least one current site photo for the scanned packet set."
      );
      return;
    }

    let completedCount = 0;

    try {
      setSubmitting(true);
      setDeliveryProgress("Re-verifying scanned packets…");

      /*
       * Nothing is saved until every QR resolves successfully again. This catches
       * a reassignment/status change before proof submission begins.
       */
      const verifiedRows = await preflightDeliveryRows();

      setDeliveryProgress("Capturing fresh GPS…");
      const location = await captureFreshLocation();

      let lastSaved = null;

      for (let index = 0; index < verifiedRows.length; index += 1) {
        const row = verifiedRows[index];

        setDeliveryProgress(
          `Saving proof ${index + 1}/${verifiedRows.length}…`
        );

        lastSaved = await submitSiteDelivery({
          scanText: row.scanText,
          location,
          receiverName,
          receiverPhone,
          remarks,
          photos,
        });

        completedCount = index + 1;
      }

      setLastResult({
        ...(lastSaved || {}),
        itemName: `${verifiedRows.length} packet${verifiedRows.length === 1 ? "" : "s"}`,
        siteStatus: "DELIVERED",
        deliveredAt: lastSaved?.deliveredAt || new Date().toISOString(),
      });

      clearDeliveryScans();
    } catch (error) {
      /*
       * Existing /deliver is idempotent. If a network/server failure happens after
       * some packets were already acknowledged, keep only the unsaved tail in the
       * current session so the driver can retry without re-scanning everything.
       */
      if (completedCount > 0) {
        const remaining = deliveryRows.slice(completedCount);
        setDeliveryRows(remaining);
        setDeliveryProofReady(remaining.length > 0);
      }

      Alert.alert(
        "Delivery proof failed",
        getBackendMessage(
          error,
          completedCount > 0
            ? `${completedCount} packet${completedCount === 1 ? "" : "s"} saved before the error. The remaining scans are still on screen.`
            : "Unable to save delivery proof"
        )
      );
    } finally {
      setDeliveryProgress("");
      setSubmitting(false);
    }
  };

  const confirmOpening = async () => {
    if (!resolved || !scanText) {
      Alert.alert("Scan required", "Scan the exact packet before confirming.");
      return;
    }

    try {
      setSubmitting(true);
      const location = await captureFreshLocation();

      const result = await submitSiteOpening({
        scanText,
        location,
        remarks,
        photos,
      });

      setLastResult(result);

      setResolved(null);
      setScanText("");
      setManualSticker("");
      setPhotos([]);
      setRemarks("");
      setCameraPurpose("SCAN");
      setScannerEnabled(true);
      scanGuardRef.current = { value: "", at: 0 };
    } catch (error) {
      Alert.alert(
        "Site proof failed",
        getBackendMessage(error, "Unable to save site proof")
      );
    } finally {
      setSubmitting(false);
    }
  };

  const canSwitchMode = canDelivery && canOpening;
  const recentDeliveryRows = deliveryRows.slice(-20).reverse();
  const hiddenDeliveryCount = Math.max(0, deliveryRows.length - recentDeliveryRows.length);

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.hero}>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>SHIPTRACK • PHYSICAL PROOF</Text>
          <Text style={styles.title}>{modeTitle}</Text>
          <Text style={styles.sub}>{modeSub}</Text>
          <Text style={styles.identity}>{username || "User"}</Text>
        </View>

        <TouchableOpacity style={styles.logout} onPress={logout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {canSwitchMode ? (
        <View style={styles.modeRow}>
          <ModeButton
            active={mode === "DELIVERY"}
            label="Driver Delivery"
            onPress={() => switchMode("DELIVERY")}
          />
          <ModeButton
            active={mode === "OPENING"}
            label="On-site Opening"
            onPress={() => switchMode("OPENING")}
          />
        </View>
      ) : null}

      {lastResult ? (
        <View style={styles.successCard}>
          <Text style={styles.successTitle}>Last proof saved</Text>
          <Text style={styles.successText}>
            {lastResult.itemName || "Packet"} • {pretty(lastResult.siteStatus)}
          </Text>
          <Text style={styles.successText}>
            {formatDateTime(lastResult.openedAt || lastResult.deliveredAt)}
          </Text>
        </View>
      ) : null}

      {isDelivery ? (
        <>
          <View style={styles.card}>
            <View style={styles.sectionHead}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>1. Scan assigned packets</Text>
                <Text style={styles.cardSub}>
                  Keep the camera open and scan continuously. There is no challan lock and no packet-count requirement. The backend accepts only packets assigned to your Driver account.
                </Text>
              </View>

              <View style={styles.countBadge}>
                <Text style={styles.countValue}>{deliveryRows.length}</Text>
                <Text style={styles.countLabel}>SCANNED</Text>
              </View>
            </View>

            {!deliveryProofReady ? (
              <>
                <View style={styles.manualRow}>
                  <TextInput
                    value={manualSticker}
                    onChangeText={setManualSticker}
                    placeholder="Sticker Number"
                    placeholderTextColor="#64748b"
                    autoCapitalize="characters"
                    style={styles.input}
                  />
                  <TouchableOpacity
                    style={styles.secondaryBtn}
                    onPress={submitManual}
                    disabled={loading}
                  >
                    <Text style={styles.secondaryText}>Add</Text>
                  </TouchableOpacity>
                </View>

                {!permission?.granted ? (
                  <TouchableOpacity
                    style={styles.cameraPermissionBtn}
                    onPress={ensureCameraPermission}
                  >
                    <Text style={styles.cameraPermissionText}>
                      Enable Camera for QR / Photos
                    </Text>
                  </TouchableOpacity>
                ) : null}

                {permission?.granted && cameraPurpose === "SCAN" ? (
                  <View style={styles.cameraBox}>
                    <CameraView
                      ref={cameraRef}
                      style={styles.camera}
                      facing="back"
                      barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                      onBarcodeScanned={
                        scannerEnabled ? onBarcodeScanned : undefined
                      }
                    />
                    <View style={styles.scanOverlay}>
                      <Text style={styles.scanOverlayText}>
                        {loading
                          ? "Checking packet…"
                          : deliveryRows.length > 0
                            ? `${deliveryRows.length} scanned • keep scanning`
                            : "Point camera at assigned packet QR"}
                      </Text>
                    </View>
                  </View>
                ) : null}

                {loading ? (
                  <ActivityIndicator
                    style={{ marginTop: 14 }}
                    color="#60a5fa"
                  />
                ) : null}

                {scanNotice ? (
                  <View
                    style={[
                      styles.scanNotice,
                      scanNoticeError ? styles.scanNoticeError : styles.scanNoticeGood,
                    ]}
                  >
                    <Text
                      style={[
                        styles.scanNoticeText,
                        scanNoticeError
                          ? styles.scanNoticeErrorText
                          : styles.scanNoticeGoodText,
                      ]}
                    >
                      {scanNotice}
                    </Text>
                  </View>
                ) : null}
              </>
            ) : (
              <View style={styles.proofLockedCard}>
                <Text style={styles.proofLockedTitle}>Scanning paused</Text>
                <Text style={styles.proofLockedText}>
                  {deliveryRows.length} packet{deliveryRows.length === 1 ? "" : "s"} will receive the same delivery photo, fresh GPS and confirmation proof.
                </Text>
                <TouchableOpacity
                  style={styles.secondaryWideBtn}
                  onPress={returnToDeliveryScanning}
                  disabled={submitting}
                >
                  <Text style={styles.secondaryText}>Back to scanning</Text>
                </TouchableOpacity>
              </View>
            )}

            {deliveryRows.length > 0 ? (
              <View style={styles.scannedList}>
                <View style={styles.scannedListHead}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.scannedListTitle}>Scanned packets</Text>
                    <Text style={styles.scannedListSub}>
                      Latest {recentDeliveryRows.length} shown{hiddenDeliveryCount > 0 ? ` • ${hiddenDeliveryCount} earlier packet${hiddenDeliveryCount === 1 ? "" : "s"} kept in the scan set` : ""}.
                    </Text>
                  </View>
                </View>

                {recentDeliveryRows.map((row, reverseIndex) => {
                  const actualIndex = deliveryRows.length - 1 - reverseIndex;
                  const data = row?.data || {};

                  return (
                    <View
                      key={`${packetIdentity(data, row.scanText)}-${actualIndex}`}
                      style={styles.scannedRow}
                    >
                      <View style={styles.rowNumber}>
                        <Text style={styles.rowNumberText}>{actualIndex + 1}</Text>
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={styles.scannedRowTitle} numberOfLines={1}>
                          {data?.itemName || packetLabel(row)}
                        </Text>
                        <Text style={styles.scannedRowMeta} numberOfLines={1}>
                          {packetLabel(row)}
                          {clean(data?.challanNumber)
                            ? ` • ${clean(data?.challanNumber)}`
                            : ""}
                        </Text>
                      </View>

                      {!deliveryProofReady ? (
                        <TouchableOpacity
                          style={styles.removeRowBtn}
                          onPress={() => removeDeliveryPacket(actualIndex)}
                        >
                          <Text style={styles.removeRowText}>×</Text>
                        </TouchableOpacity>
                      ) : (
                        <View style={styles.verifiedDot}>
                          <Text style={styles.verifiedDotText}>✓</Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            ) : null}

            {!deliveryProofReady && deliveryRows.length > 0 ? (
              <>
                <TouchableOpacity
                  style={styles.continueBtn}
                  onPress={continueToDeliveryProof}
                  disabled={loading}
                >
                  <Text style={styles.continueText}>
                    Continue to Photo & GPS • {deliveryRows.length} Packet{deliveryRows.length === 1 ? "" : "s"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.resetBtn}
                  onPress={clearDeliveryScans}
                  disabled={loading}
                >
                  <Text style={styles.resetText}>Clear scanned set</Text>
                </TouchableOpacity>
              </>
            ) : null}
          </View>

          {deliveryProofReady ? (
            <>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>2. Receiver / site note</Text>
                <Text style={styles.cardSub}>
                  These details will be applied to all {deliveryRows.length} scanned packet{deliveryRows.length === 1 ? "" : "s"}.
                </Text>
                <TextInput
                  value={receiverName}
                  onChangeText={setReceiverName}
                  placeholder="Receiver name (optional)"
                  placeholderTextColor="#64748b"
                  style={styles.inputFull}
                />
                <TextInput
                  value={receiverPhone}
                  onChangeText={setReceiverPhone}
                  placeholder="Receiver phone (optional)"
                  placeholderTextColor="#64748b"
                  keyboardType="phone-pad"
                  style={styles.inputFull}
                />
              </View>

              <View style={styles.card}>
                <Text style={styles.cardTitle}>3. Delivery photo evidence</Text>
                <Text style={styles.cardSub}>
                  Take 1–4 current site photos. The same evidence is saved against every scanned packet.
                </Text>

                {cameraPurpose === "PHOTO" ? (
                  <View style={styles.cameraBox}>
                    <CameraView
                      ref={cameraRef}
                      style={styles.camera}
                      facing="back"
                    />
                    <View style={styles.photoControls}>
                      <TouchableOpacity
                        style={styles.captureBtn}
                        onPress={capturePhoto}
                        disabled={capturing}
                      >
                        <Text style={styles.captureText}>
                          {capturing ? "Saving…" : "Take Photo"}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.cancelCameraBtn}
                        onPress={() => setCameraPurpose("SCAN")}
                      >
                        <Text style={styles.cancelCameraText}>Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.addPhotoBtn}
                    onPress={startPhoto}
                  >
                    <Text style={styles.addPhotoText}>
                      + Take Photo ({photos.length}/{maxPhotos})
                    </Text>
                  </TouchableOpacity>
                )}

                <View style={styles.photoGrid}>
                  {photos.map((photo, index) => (
                    <View key={`${photo.uri}-${index}`} style={styles.photoWrap}>
                      <Image source={{ uri: photo.uri }} style={styles.photo} />
                      <TouchableOpacity
                        style={styles.removePhoto}
                        onPress={() => removePhoto(index)}
                      >
                        <Text style={styles.removePhotoText}>×</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </View>

              <View style={styles.card}>
                <Text style={styles.cardTitle}>4. Confirm scanned delivery</Text>
                <Text style={styles.cardSub}>
                  ShipTrack re-checks every QR against your driver assignment, captures one fresh foreground GPS fix, then saves the proof against each scanned packet.
                </Text>

                <TextInput
                  value={remarks}
                  onChangeText={setRemarks}
                  placeholder="Delivery remarks (optional)"
                  placeholderTextColor="#64748b"
                  multiline
                  style={styles.remarks}
                />

                {deliveryProgress ? (
                  <View style={styles.progressBox}>
                    <ActivityIndicator color="#93c5fd" />
                    <Text style={styles.progressText}>{deliveryProgress}</Text>
                  </View>
                ) : null}

                <TouchableOpacity
                  style={[
                    styles.confirmBtn,
                    submitting ? styles.disabled : null,
                  ]}
                  onPress={confirmDeliverySet}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.confirmText}>
                      Confirm {deliveryRows.length} Packet{deliveryRows.length === 1 ? "" : "s"} + Photo + GPS
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          ) : null}
        </>
      ) : (
        <>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>1. Verify physical packet</Text>
            <Text style={styles.cardSub}>
              The backend validates the latest active sticker before allowing on-site opening.
            </Text>

            <View style={styles.manualRow}>
              <TextInput
                value={manualSticker}
                onChangeText={setManualSticker}
                placeholder="Sticker Number"
                placeholderTextColor="#64748b"
                autoCapitalize="characters"
                style={styles.input}
              />
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={submitManual}
                disabled={loading}
              >
                <Text style={styles.secondaryText}>Resolve</Text>
              </TouchableOpacity>
            </View>

            {!permission?.granted ? (
              <TouchableOpacity
                style={styles.cameraPermissionBtn}
                onPress={ensureCameraPermission}
              >
                <Text style={styles.cameraPermissionText}>
                  Enable Camera for QR / Photos
                </Text>
              </TouchableOpacity>
            ) : null}

            {permission?.granted && cameraPurpose === "SCAN" && !resolved ? (
              <View style={styles.cameraBox}>
                <CameraView
                  ref={cameraRef}
                  style={styles.camera}
                  facing="back"
                  barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                  onBarcodeScanned={
                    scannerEnabled ? onBarcodeScanned : undefined
                  }
                />
                <View style={styles.scanOverlay}>
                  <Text style={styles.scanOverlayText}>
                    {loading ? "Resolving…" : "Point camera at packet QR"}
                  </Text>
                </View>
              </View>
            ) : null}

            {loading ? (
              <ActivityIndicator
                style={{ marginTop: 14 }}
                color="#60a5fa"
              />
            ) : null}
          </View>

          {resolved ? (
            <>
              <View style={styles.card}>
                <View style={styles.packetTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>
                      {resolved.itemName || "Packet"}
                    </Text>
                    <Text style={styles.packetMeta}>
                      {resolved.packetNumber || resolved.stickerNumber || "—"}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, statusTone]}>
                    <Text style={styles.statusText}>
                      {pretty(resolved.siteStatus)}
                    </Text>
                  </View>
                </View>

                <View style={styles.infoGrid}>
                  <Info label="Challan" value={resolved.challanNumber} />
                  <Info label="Plant" value={resolved.plantCode} />
                  <Info label="PD No." value={resolved.pdNo} />
                  <Info label="Drawing" value={resolved.drawingNo} />
                  <Info label="Client" value={resolved.clientName} />
                  <Info label="Driver" value={resolved.driverName || "—"} />
                  <Info label="Vehicle" value={resolved.vehicleNumber || "—"} />
                  <Info
                    label="Dispatched"
                    value={formatDateTime(resolved.dispatchedAt)}
                  />
                </View>

                <Text style={styles.deliveredHint}>
                  Delivered: {formatDateTime(resolved.deliveredAt)}
                </Text>
              </View>

              <View style={styles.card}>
                <Text style={styles.cardTitle}>2. Opening evidence</Text>
                <Text style={styles.cardSub}>
                  You may take up to two photos of the packet opening.
                </Text>

                {cameraPurpose === "PHOTO" ? (
                  <View style={styles.cameraBox}>
                    <CameraView
                      ref={cameraRef}
                      style={styles.camera}
                      facing="back"
                    />
                    <View style={styles.photoControls}>
                      <TouchableOpacity
                        style={styles.captureBtn}
                        onPress={capturePhoto}
                        disabled={capturing}
                      >
                        <Text style={styles.captureText}>
                          {capturing ? "Saving…" : "Take Photo"}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.cancelCameraBtn}
                        onPress={() => setCameraPurpose("SCAN")}
                      >
                        <Text style={styles.cancelCameraText}>Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.addPhotoBtn}
                    onPress={startPhoto}
                  >
                    <Text style={styles.addPhotoText}>
                      + Take Photo ({photos.length}/{maxPhotos})
                    </Text>
                  </TouchableOpacity>
                )}

                <View style={styles.photoGrid}>
                  {photos.map((photo, index) => (
                    <View key={`${photo.uri}-${index}`} style={styles.photoWrap}>
                      <Image source={{ uri: photo.uri }} style={styles.photo} />
                      <TouchableOpacity
                        style={styles.removePhoto}
                        onPress={() => removePhoto(index)}
                      >
                        <Text style={styles.removePhotoText}>×</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </View>

              <View style={styles.card}>
                <Text style={styles.cardTitle}>3. Confirm packet opening</Text>
                <Text style={styles.cardSub}>
                  A fresh foreground GPS fix is captured only when you press Confirm.
                </Text>

                <TextInput
                  value={remarks}
                  onChangeText={setRemarks}
                  placeholder="Opening remarks (optional)"
                  placeholderTextColor="#64748b"
                  multiline
                  style={styles.remarks}
                />

                <TouchableOpacity
                  style={[
                    styles.confirmBtn,
                    submitting ? styles.disabled : null,
                  ]}
                  onPress={confirmOpening}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.confirmText}>
                      Confirm Opened + GPS
                    </Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.resetBtn}
                  onPress={resetSession}
                  disabled={submitting}
                >
                  <Text style={styles.resetText}>Scan another packet</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : null}
        </>
      )}

      {navigation?.canGoBack?.() ? (
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
      ) : null}
    </ScrollView>
  );
}

function ModeButton({ active, label, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.modeBtn, active ? styles.modeBtnActive : null]}
      onPress={onPress}
    >
      <Text style={[styles.modeText, active ? styles.modeTextActive : null]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function Info({ label, value }) {
  return (
    <View style={styles.info}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{clean(value) || "—"}</Text>
    </View>
  );
}

const styles = {
  page: {
    flex: 1,
    backgroundColor: "#020617",
  },

  content: {
    padding: 16,
    paddingBottom: 38,
  },

  hero: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
    padding: 18,
    borderRadius: 22,
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.09)",
  },

  kicker: {
    color: "#60a5fa",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.4,
  },

  title: {
    marginTop: 6,
    color: "#fff",
    fontSize: 25,
    fontWeight: "900",
  },

  sub: {
    marginTop: 7,
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
  },

  identity: {
    marginTop: 8,
    color: "#cbd5e1",
    fontSize: 11,
    fontWeight: "900",
  },

  logout: {
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "rgba(239,68,68,.10)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,.20)",
  },

  logoutText: {
    color: "#fca5a5",
    fontWeight: "900",
    fontSize: 11,
  },

  modeRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    padding: 4,
    borderRadius: 14,
    backgroundColor: "#0f172a",
  },

  modeBtn: {
    flex: 1,
    minHeight: 42,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },

  modeBtnActive: {
    backgroundColor: "#2563eb",
  },

  modeText: {
    color: "#94a3b8",
    fontWeight: "900",
    fontSize: 12,
  },

  modeTextActive: {
    color: "#fff",
  },

  card: {
    marginTop: 12,
    padding: 16,
    borderRadius: 20,
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.09)",
  },

  sectionHead: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },

  cardTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "900",
  },

  cardSub: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 17,
    marginTop: 5,
  },

  countBadge: {
    minWidth: 72,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 15,
    alignItems: "center",
    backgroundColor: "rgba(37,99,235,.14)",
    borderWidth: 1,
    borderColor: "rgba(96,165,250,.24)",
  },

  countValue: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "900",
  },

  countLabel: {
    marginTop: 1,
    color: "#93c5fd",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.8,
  },

  manualRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
  },

  input: {
    flex: 1,
    minHeight: 48,
    paddingHorizontal: 13,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.10)",
    color: "#fff",
    fontWeight: "800",
  },

  inputFull: {
    minHeight: 48,
    marginTop: 10,
    paddingHorizontal: 13,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.10)",
    color: "#fff",
    fontWeight: "800",
  },

  secondaryBtn: {
    minWidth: 86,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: "rgba(59,130,246,.13)",
    borderWidth: 1,
    borderColor: "rgba(59,130,246,.28)",
    alignItems: "center",
    justifyContent: "center",
  },

  secondaryWideBtn: {
    minHeight: 44,
    marginTop: 10,
    borderRadius: 13,
    backgroundColor: "rgba(59,130,246,.13)",
    borderWidth: 1,
    borderColor: "rgba(59,130,246,.28)",
    alignItems: "center",
    justifyContent: "center",
  },

  secondaryText: {
    color: "#93c5fd",
    fontWeight: "900",
    fontSize: 12,
  },

  cameraPermissionBtn: {
    marginTop: 12,
    minHeight: 44,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(245,158,11,.10)",
    borderWidth: 1,
    borderColor: "rgba(245,158,11,.24)",
  },

  cameraPermissionText: {
    color: "#fbbf24",
    fontWeight: "900",
    fontSize: 12,
  },

  cameraBox: {
    marginTop: 14,
    height: 340,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#000",
    position: "relative",
  },

  camera: {
    flex: 1,
  },

  scanOverlay: {
    position: "absolute",
    left: 18,
    right: 18,
    bottom: 18,
    padding: 10,
    borderRadius: 12,
    backgroundColor: "rgba(2,6,23,.80)",
  },

  scanOverlayText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "900",
    fontSize: 12,
  },

  scanNotice: {
    marginTop: 12,
    padding: 11,
    borderRadius: 13,
    borderWidth: 1,
  },

  scanNoticeGood: {
    backgroundColor: "rgba(16,185,129,.08)",
    borderColor: "rgba(16,185,129,.22)",
  },

  scanNoticeError: {
    backgroundColor: "rgba(239,68,68,.08)",
    borderColor: "rgba(239,68,68,.22)",
  },

  scanNoticeText: {
    fontSize: 11,
    lineHeight: 17,
    fontWeight: "800",
  },

  scanNoticeGoodText: {
    color: "#6ee7b7",
  },

  scanNoticeErrorText: {
    color: "#fca5a5",
  },

  proofLockedCard: {
    marginTop: 14,
    padding: 13,
    borderRadius: 15,
    backgroundColor: "rgba(16,185,129,.08)",
    borderWidth: 1,
    borderColor: "rgba(16,185,129,.20)",
  },

  proofLockedTitle: {
    color: "#6ee7b7",
    fontSize: 12,
    fontWeight: "900",
  },

  proofLockedText: {
    marginTop: 5,
    color: "#94a3b8",
    fontSize: 11,
    lineHeight: 17,
    fontWeight: "700",
  },

  scannedList: {
    marginTop: 14,
    paddingTop: 13,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,.08)",
  },

  scannedListHead: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 6,
  },

  scannedListTitle: {
    color: "#e2e8f0",
    fontSize: 13,
    fontWeight: "900",
  },

  scannedListSub: {
    marginTop: 3,
    color: "#64748b",
    fontSize: 10,
    lineHeight: 15,
    fontWeight: "700",
  },

  scannedRow: {
    minHeight: 58,
    marginTop: 7,
    padding: 9,
    borderRadius: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    backgroundColor: "rgba(255,255,255,.035)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.07)",
  },

  rowNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(59,130,246,.13)",
  },

  rowNumberText: {
    color: "#93c5fd",
    fontSize: 10,
    fontWeight: "900",
  },

  scannedRowTitle: {
    color: "#e2e8f0",
    fontSize: 11.5,
    fontWeight: "900",
  },

  scannedRowMeta: {
    marginTop: 3,
    color: "#64748b",
    fontSize: 9.5,
    fontWeight: "700",
  },

  removeRowBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(239,68,68,.08)",
  },

  removeRowText: {
    color: "#fca5a5",
    fontSize: 18,
    fontWeight: "900",
    lineHeight: 20,
  },

  verifiedDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(16,185,129,.12)",
    borderWidth: 1,
    borderColor: "rgba(16,185,129,.25)",
  },

  verifiedDotText: {
    color: "#6ee7b7",
    fontSize: 12,
    fontWeight: "900",
  },

  continueBtn: {
    minHeight: 52,
    marginTop: 14,
    borderRadius: 15,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },

  continueText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 13,
    textAlign: "center",
  },

  packetTop: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },

  packetMeta: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "800",
    marginTop: 4,
  },

  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },

  waitBadge: {
    backgroundColor: "rgba(245,158,11,.10)",
    borderColor: "rgba(245,158,11,.28)",
  },

  deliveredBadge: {
    backgroundColor: "rgba(16,185,129,.10)",
    borderColor: "rgba(16,185,129,.28)",
  },

  goodBadge: {
    backgroundColor: "rgba(139,92,246,.11)",
    borderColor: "rgba(139,92,246,.28)",
  },

  statusText: {
    color: "#e2e8f0",
    fontSize: 9,
    fontWeight: "900",
  },

  infoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },

  info: {
    width: "47%",
    minHeight: 58,
    padding: 10,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,.035)",
  },

  infoLabel: {
    color: "#64748b",
    fontSize: 9,
    fontWeight: "900",
    textTransform: "uppercase",
  },

  infoValue: {
    marginTop: 5,
    color: "#e2e8f0",
    fontSize: 11,
    fontWeight: "800",
  },

  deliveredHint: {
    marginTop: 12,
    color: "#6ee7b7",
    fontSize: 11,
    fontWeight: "800",
  },

  addPhotoBtn: {
    marginTop: 13,
    minHeight: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(59,130,246,.12)",
    borderWidth: 1,
    borderColor: "rgba(59,130,246,.28)",
  },

  addPhotoText: {
    color: "#93c5fd",
    fontWeight: "900",
    fontSize: 12,
  },

  photoControls: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 16,
    flexDirection: "row",
    gap: 8,
  },

  captureBtn: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
  },

  captureText: {
    color: "#fff",
    fontWeight: "900",
  },

  cancelCameraBtn: {
    minWidth: 90,
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: "rgba(2,6,23,.82)",
    alignItems: "center",
    justifyContent: "center",
  },

  cancelCameraText: {
    color: "#cbd5e1",
    fontWeight: "900",
  },

  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },

  photoWrap: {
    width: 105,
    height: 105,
    borderRadius: 14,
    overflow: "hidden",
    position: "relative",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.10)",
  },

  photo: {
    width: "100%",
    height: "100%",
  },

  removePhoto: {
    position: "absolute",
    right: 5,
    top: 5,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(2,6,23,.85)",
  },

  removePhotoText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 18,
    lineHeight: 20,
  },

  remarks: {
    minHeight: 90,
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.10)",
    color: "#fff",
    textAlignVertical: "top",
    fontWeight: "700",
  },

  progressBox: {
    marginTop: 12,
    padding: 11,
    borderRadius: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    backgroundColor: "rgba(59,130,246,.08)",
    borderWidth: 1,
    borderColor: "rgba(59,130,246,.16)",
  },

  progressText: {
    flex: 1,
    color: "#bfdbfe",
    fontSize: 10.5,
    fontWeight: "800",
  },

  confirmBtn: {
    minHeight: 52,
    marginTop: 13,
    borderRadius: 15,
    backgroundColor: "#059669",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },

  confirmText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 14,
    textAlign: "center",
  },

  disabled: {
    opacity: 0.65,
  },

  resetBtn: {
    minHeight: 42,
    marginTop: 8,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,.04)",
  },

  resetText: {
    color: "#94a3b8",
    fontWeight: "900",
    fontSize: 12,
  },

  successCard: {
    marginTop: 12,
    padding: 13,
    borderRadius: 16,
    backgroundColor: "rgba(16,185,129,.10)",
    borderWidth: 1,
    borderColor: "rgba(16,185,129,.24)",
  },

  successTitle: {
    color: "#6ee7b7",
    fontWeight: "900",
    fontSize: 12,
  },

  successText: {
    color: "#cbd5e1",
    fontWeight: "700",
    fontSize: 11,
    marginTop: 4,
  },

  backBtn: {
    minHeight: 44,
    marginTop: 12,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,.04)",
  },

  backText: {
    color: "#cbd5e1",
    fontWeight: "900",
  },
};
