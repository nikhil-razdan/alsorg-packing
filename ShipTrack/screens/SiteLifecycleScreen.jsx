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
import { api, getBackendMessage } from "../api/client";
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

/*
 * Driver-safe challan context.
 *
 * This endpoint does NOT expose Dispatch history to DRIVER. The backend first
 * runs the exact scanned packet through the existing DELIVERY resolver and only
 * then returns the authoritative number of physical packet rows linked to that
 * already-authorized challan.
 */
async function fetchDeliveryChallanContext(scanText) {
  const value = clean(scanText);

  if (!value) {
    throw new Error("Scan a packet QR or enter Sticker Number.");
  }

  const response = await api.get(
    "/api/site-lifecycle/delivery-challan-context",
    {
      params: {
        scanText: value,
      },
      headers: {
        Accept: "application/json",
      },
    }
  );

  const data = response?.data || {};
  const challanNumber = clean(data?.challanNumber);
  const packetCount = Number(data?.packetCount);

  if (!challanNumber) {
    throw new Error(
      "The delivery challan number could not be determined for this packet."
    );
  }

  if (!Number.isInteger(packetCount) || packetCount < 1) {
    throw new Error(
      "The challan packet count could not be determined. Delivery cannot continue until the server returns the complete challan count."
    );
  }

  return {
    challanNumber,
    packetCount,
  };
}

function getBulkRepresentative(rows) {
  return rows?.[0]?.data || null;
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

  const requestedDeliveryScanMode = normalize(
    route?.params?.scanMode || route?.params?.deliveryScanMode
  );

  const [mode, setMode] = useState(defaultMode);
  const [deliveryScanMode, setDeliveryScanMode] = useState(
    requestedDeliveryScanMode === "BULK" ? "BULK" : "SINGLE"
  );

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);
  const scanGuardRef = useRef({ value: "", at: 0 });

  const [cameraPurpose, setCameraPurpose] = useState("SCAN");
  const [scannerEnabled, setScannerEnabled] = useState(true);
  const [scanText, setScanText] = useState("");
  const [manualSticker, setManualSticker] = useState("");
  const [resolved, setResolved] = useState(null);

  const [bulkRows, setBulkRows] = useState([]);
  const [bulkChallanNumber, setBulkChallanNumber] = useState("");
  const [bulkExpectedCount, setBulkExpectedCount] = useState(0);
  const [bulkProofReady, setBulkProofReady] = useState(false);
  const [bulkRecoveryMode, setBulkRecoveryMode] = useState(false);
  const [bulkProgress, setBulkProgress] = useState("");

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

  useEffect(() => {
    if (requestedDeliveryScanMode === "BULK") {
      setDeliveryScanMode("BULK");
    } else if (requestedDeliveryScanMode === "SINGLE") {
      setDeliveryScanMode("SINGLE");
    }
  }, [requestedDeliveryScanMode]);

  const isBulkDelivery =
    mode === "DELIVERY" && deliveryScanMode === "BULK";

  const maxPhotos = mode === "DELIVERY" ? 4 : 2;
  const photoRequired = mode === "DELIVERY";
  const siteStatus = normalize(resolved?.siteStatus || "AWAITING_DELIVERY");

  const unassignedDelivery =
    mode === "DELIVERY" &&
    Boolean(resolved) &&
    !clean(resolved?.driverName);

  const bulkUnassignedDelivery =
    isBulkDelivery &&
    bulkRows.length > 0 &&
    bulkRows.some((row) => !clean(row?.data?.driverName));

  const modeTitle =
    mode === "DELIVERY" ? "Site Delivery Proof" : "On-site Packet Opening";

  const modeSub =
    mode === "DELIVERY"
      ? isBulkDelivery
        ? "Scan continuously until every physical packet from the first packet’s challan is accepted. Proof unlocks automatically only at the exact challan total."
        : "Scan the exact packet, photograph it at site, capture fresh GPS and mark physical delivery."
      : "Scan a delivered packet when it is physically opened and record the opening time/GPS.";

  const statusTone = useMemo(() => {
    if (siteStatus === "OPENED_ON_SITE") return styles.goodBadge;
    if (siteStatus === "DELIVERED") return styles.deliveredBadge;
    return styles.waitBadge;
  }, [siteStatus]);

  const bulkServerCountReached =
    bulkExpectedCount > 0 && bulkRows.length >= bulkExpectedCount;

  const bulkScanComplete =
    bulkRecoveryMode
      ? bulkRows.length > 0
      : bulkExpectedCount > 0 &&
        bulkRows.length === bulkExpectedCount;

  const ensureCameraPermission = async () => {
    if (permission?.granted) return true;

    const next = await requestPermission();
    return Boolean(next?.granted);
  };

  const resetPacket = () => {
    setResolved(null);
    setScanText("");
    setManualSticker("");

    setBulkRows([]);
    setBulkChallanNumber("");
    setBulkExpectedCount(0);
    setBulkProofReady(false);
    setBulkRecoveryMode(false);
    setBulkProgress("");

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

    resetPacket();
    setLastResult(null);
    setMode(nextMode);
  };

  const switchDeliveryScanMode = (nextMode) => {
    if (nextMode === deliveryScanMode) return;

    resetPacket();
    setLastResult(null);
    setDeliveryScanMode(nextMode);
  };

  const lockBulkProof = (rows) => {
    const representative = getBulkRepresentative(rows);

    setResolved(representative);
    setScanText(rows?.[0]?.scanText || "");
    setBulkProofReady(true);
    setScannerEnabled(false);
    setCameraPurpose("SCAN");
    setBulkProgress("");
  };

  const addBulkResolvedPacket = (raw, data, context = null) => {
    const resolvedChallan = clean(data?.challanNumber);
    const contextChallan = clean(context?.challanNumber);
    const challanNumber = contextChallan || resolvedChallan;

    if (!challanNumber) {
      Alert.alert(
        "Challan missing",
        "This packet resolved successfully, but its dispatch challan number was not returned."
      );
      return false;
    }

    if (
      contextChallan &&
      resolvedChallan &&
      normalize(contextChallan) !== normalize(resolvedChallan)
    ) {
      Alert.alert(
        "Challan mismatch",
        "The server resolved this QR to a different challan than its delivery context. Reset and scan again."
      );
      return false;
    }

    if (
      bulkChallanNumber &&
      normalize(bulkChallanNumber) !== normalize(challanNumber)
    ) {
      Alert.alert(
        "Different challan",
        `Bulk delivery is locked to challan ${bulkChallanNumber}. Scan only packets from that challan.`
      );
      return false;
    }

    const identity = packetIdentity(data, raw);
    const duplicate = bulkRows.some(
      (row) => packetIdentity(row.data, row.scanText) === identity
    );

    if (duplicate) {
      Alert.alert(
        "Already scanned",
        "This physical packet is already in the challan scan cart."
      );
      return false;
    }

    const contextCount = Number(context?.packetCount);
    const authoritativeCount =
      Number.isInteger(contextCount) && contextCount > 0
        ? contextCount
        : bulkExpectedCount;

    if (!Number.isInteger(authoritativeCount) || authoritativeCount < 1) {
      Alert.alert(
        "Challan count unavailable",
        "The server did not return the complete packet count for this challan. Bulk delivery is blocked so the driver cannot continue with an incomplete scan set."
      );
      return false;
    }

    if (
      bulkExpectedCount > 0 &&
      contextCount > 0 &&
      bulkExpectedCount !== contextCount
    ) {
      Alert.alert(
        "Challan count changed",
        "The server returned a different packet count for this challan. Reset and scan the challan again."
      );
      return false;
    }

    if (bulkRows.length >= authoritativeCount) {
      Alert.alert(
        "Challan already complete",
        `${authoritativeCount} packet${authoritativeCount === 1 ? "" : "s"} are already scanned for this challan.`
      );
      return false;
    }

    const nextRows = [
      ...bulkRows,
      {
        scanText: raw,
        data,
      },
    ];

    setBulkRows(nextRows);
    setBulkChallanNumber(challanNumber);
    setBulkExpectedCount(authoritativeCount);
    setManualSticker("");
    setBulkProgress("");

    const isNowComplete = nextRows.length === authoritativeCount;

    if (isNowComplete) {
      lockBulkProof(nextRows);
    } else {
      setResolved(null);
      setScanText("");
      setBulkProofReady(false);
      setScannerEnabled(true);
    }

    return true;
  };

  const resolvePacket = async (value) => {
    const raw = clean(value);
    if (!raw) return false;

    try {
      setLoading(true);
      setLastResult(null);

      const data = await resolveSitePacket(raw, mode);

      if (mode === "DELIVERY") {
        if (isBulkDelivery) {
          let context = null;

          if (!bulkChallanNumber || bulkExpectedCount <= 0) {
            context = await fetchDeliveryChallanContext(raw);
          }

          return addBulkResolvedPacket(raw, data, context);
        }

        if (deliveryScanMode === "SINGLE") {
          const context = await fetchDeliveryChallanContext(raw);

          if (context.packetCount > 1) {
            /*
             * A multi-packet challan can never be completed through Single Scan.
             * Promote immediately, keep the first QR, and re-arm the camera for
             * packet 2 exactly like Dispatch Bulk Scan. No confirmation dialog.
             */
            setDeliveryScanMode("BULK");
            return addBulkResolvedPacket(raw, data, context);
          }
        }
      }

      setResolved(data);
      setScanText(raw);
      setScannerEnabled(false);
      setCameraPurpose("SCAN");
      setPhotos([]);
      return true;
    } catch (error) {
      Alert.alert(
        "Packet not accepted",
        getBackendMessage(error, "Unable to resolve packet")
      );

      setScannerEnabled(true);
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

    if (last.value === raw && now - last.at < 1400) {
      return;
    }

    scanGuardRef.current = { value: raw, at: now };
    setScannerEnabled(false);

    const ok = await resolvePacket(raw);

    if (!ok) {
      setScannerEnabled(true);
    }
  };

  const submitManual = async () => {
    try {
      const value = buildStickerScanText(manualSticker);
      const ok = await resolvePacket(value);

      if (ok && isBulkDelivery) {
        setManualSticker("");
      }
    } catch (error) {
      Alert.alert(
        "Sticker Number",
        error?.message || "Enter Sticker Number"
      );
    }
  };

  const removeBulkRow = (index) => {
    if (bulkProofReady || submitting) return;

    setBulkRows((current) => {
      const next = current.filter((_, rowIndex) => rowIndex !== index);

      if (next.length === 0) {
        setBulkChallanNumber("");
        setBulkExpectedCount(0);
      }

      return next;
    });

    setScannerEnabled(true);
  };



  const startPhoto = async () => {
    if (isBulkDelivery && !bulkProofReady) {
      Alert.alert(
        "Finish scanning first",
        "Scan every packet in the challan and finish the scan set before taking delivery evidence."
      );
      return;
    }

    if (!resolved) {
      Alert.alert(
        "Scan first",
        mode === "DELIVERY"
          ? "Scan the packet before taking evidence photos."
          : "Scan the packet before taking evidence photos."
      );
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
      Alert.alert(
        "Photo failed",
        error?.message || "Unable to capture photo"
      );
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
    const permissionResult =
      await Location.requestForegroundPermissionsAsync();

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

  const preflightBulkRows = async () => {
    const refreshedRows = [];
    let expectedCount = bulkRecoveryMode ? 0 : bulkExpectedCount;

    if (!bulkRecoveryMode) {
      const context = await fetchDeliveryChallanContext(
        bulkRows?.[0]?.scanText
      );

      if (
        normalize(context.challanNumber) !== normalize(bulkChallanNumber)
      ) {
        throw new Error(
          `The first packet now resolves to challan ${context.challanNumber}, not ${bulkChallanNumber}. Reset and scan again.`
        );
      }

      if (
        expectedCount > 0 &&
        context.packetCount !== expectedCount
      ) {
        throw new Error(
          `The challan packet count changed from ${expectedCount} to ${context.packetCount}. Reset and scan the challan again.`
        );
      }

      expectedCount = context.packetCount;

      if (bulkRows.length !== expectedCount) {
        throw new Error(
          `Challan ${bulkChallanNumber} requires ${expectedCount} packet scans, but ${bulkRows.length} are present.`
        );
      }
    }

    for (let index = 0; index < bulkRows.length; index += 1) {
      const row = bulkRows[index];
      const data = await resolveSitePacket(row.scanText, "DELIVERY");
      const challanNumber = clean(data?.challanNumber);

      if (
        !challanNumber ||
        normalize(challanNumber) !== normalize(bulkChallanNumber)
      ) {
        throw new Error(
          `Packet ${index + 1} no longer resolves to challan ${bulkChallanNumber}. Reset and scan the challan again.`
        );
      }

      const identity = packetIdentity(data, row.scanText);

      if (
        refreshedRows.some(
          (candidate) =>
            packetIdentity(candidate.data, candidate.scanText) === identity
        )
      ) {
        throw new Error(
          `Duplicate packet detected during final verification at position ${index + 1}.`
        );
      }

      refreshedRows.push({
        scanText: row.scanText,
        data,
      });
    }

    return {
      rows: refreshedRows,
      expectedCount,
    };
  };

  const confirmBulkDelivery = async () => {
    if (!bulkProofReady || bulkRows.length === 0) {
      Alert.alert(
        "Challan scan incomplete",
        "Finish scanning the challan before confirming delivery."
      );
      return;
    }

    if (
      !bulkRecoveryMode &&
      bulkExpectedCount > 0 &&
      bulkRows.length !== bulkExpectedCount
    ) {
      Alert.alert(
        "Challan scan incomplete",
        `Scanned ${bulkRows.length} of ${bulkExpectedCount}. Every packet must be scanned first.`
      );
      return;
    }

    if (photos.length < 1) {
      Alert.alert(
        "Delivery photo required",
        "Take at least one photo showing the delivered packets at site."
      );
      return;
    }

    try {
      setSubmitting(true);
      setBulkProgress("Re-verifying every scanned packet…");

      const preflight = await preflightBulkRows();
      const verifiedRows = preflight.rows;

      setBulkRows(verifiedRows);

      if (preflight.expectedCount > 0) {
        setBulkExpectedCount(preflight.expectedCount);
      }

      setBulkProgress("Capturing fresh GPS…");
      const location = await captureFreshLocation();

      let completed = 0;
      let lastSaved = null;

      for (let index = 0; index < verifiedRows.length; index += 1) {
        const row = verifiedRows[index];

        setBulkProgress(
          `Saving packet ${index + 1} of ${verifiedRows.length}…`
        );

        try {
          lastSaved = await submitSiteDelivery({
            scanText: row.scanText,
            location,
            receiverName,
            receiverPhone,
            remarks,
            photos,
          });

          completed += 1;
        } catch (error) {
          const remainingRows = verifiedRows.slice(completed);

          setBulkRows(remainingRows);
          setBulkExpectedCount(0);
          setBulkRecoveryMode(true);
          setResolved(getBulkRepresentative(remainingRows));
          setScanText(remainingRows[0]?.scanText || "");
          setBulkProofReady(remainingRows.length > 0);
          setBulkProgress("");

          const message = getBackendMessage(
            error,
            "Unable to save one of the packet deliveries"
          );

          throw new Error(
            completed > 0
              ? `${completed} packet${completed === 1 ? "" : "s"} were saved successfully. ${remainingRows.length} remain in the cart. ${message}`
              : message
          );
        }
      }

      setLastResult({
        ...(lastSaved || {}),
        itemName: `Challan ${bulkChallanNumber}`,
        bulkCount: verifiedRows.length,
        challanNumber: bulkChallanNumber,
      });

      Alert.alert(
        "Challan delivered on site",
        `${verifiedRows.length} packet${verifiedRows.length === 1 ? "" : "s"} from challan ${bulkChallanNumber} were verified first, then saved with the site photo, fresh GPS and delivery time.`
      );

      resetPacket();
    } catch (error) {
      Alert.alert(
        "Bulk site proof failed",
        getBackendMessage(error, error?.message || "Unable to save bulk site proof")
      );
    } finally {
      setSubmitting(false);
      setBulkProgress("");
    }
  };

  const confirm = async () => {
    if (isBulkDelivery) {
      await confirmBulkDelivery();
      return;
    }

    if (!resolved || !scanText) {
      Alert.alert(
        "Scan required",
        "Scan the exact packet before confirming."
      );
      return;
    }

    if (photoRequired && photos.length < 1) {
      Alert.alert(
        "Delivery photo required",
        "Take at least one photo showing the delivered packet at site."
      );
      return;
    }

    try {
      setSubmitting(true);

      const location = await captureFreshLocation();

      const result =
        mode === "DELIVERY"
          ? await submitSiteDelivery({
              scanText,
              location,
              receiverName,
              receiverPhone,
              remarks,
              photos,
            })
          : await submitSiteOpening({
              scanText,
              location,
              remarks,
              photos,
            });

      setLastResult(result);

      Alert.alert(
        mode === "DELIVERY" ? "Delivered on site" : "Opened on site",
        mode === "DELIVERY"
          ? "QR, photo evidence, current GPS and delivery time were saved to PackFlow."
          : "Packet opening scan, current GPS and opening time were saved to PackFlow."
      );

      resetPacket();
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

  const showScanner =
    permission?.granted &&
    cameraPurpose === "SCAN" &&
    (isBulkDelivery
      ? !bulkProofReady && !bulkServerCountReached
      : !resolved);

  const proofVisible =
    Boolean(resolved) && (!isBulkDelivery || bulkProofReady);

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

      {mode === "DELIVERY" && canDelivery ? (
        <View style={styles.scanModeCard}>
          <View style={styles.scanModeHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.scanModeTitle}>Delivery Scan Mode</Text>
              <Text style={styles.scanModeSub}>
                Use Bulk Challan when one challan contains multiple physical packets.
              </Text>
            </View>

            {isBulkDelivery && bulkRows.length > 0 ? (
              <View style={styles.cartCountBadge}>
                <Text style={styles.cartCountText}>{bulkRows.length}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.scanModeRow}>
            <ScanModeButton
              active={deliveryScanMode === "SINGLE"}
              label="Single Scan"
              caption="One packet"
              onPress={() => switchDeliveryScanMode("SINGLE")}
            />

            <ScanModeButton
              active={deliveryScanMode === "BULK"}
              label="Bulk Challan Scan"
              caption="Scan all first"
              onPress={() => switchDeliveryScanMode("BULK")}
            />
          </View>
        </View>
      ) : null}

      {lastResult ? (
        <View style={styles.successCard}>
          <Text style={styles.successTitle}>Last proof saved</Text>

          <Text style={styles.successText}>
            {lastResult.itemName || "Packet"}
            {lastResult.bulkCount
              ? ` • ${lastResult.bulkCount} packets`
              : ` • ${pretty(lastResult.siteStatus)}`}
          </Text>

          {lastResult.challanNumber ? (
            <Text style={styles.successText}>
              Challan: {lastResult.challanNumber}
            </Text>
          ) : null}

          <Text style={styles.successText}>
            {formatDateTime(lastResult.openedAt || lastResult.deliveredAt)}
          </Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          {isBulkDelivery
            ? "1. Scan every packet in the challan"
            : "1. Verify physical packet"}
        </Text>

        <Text style={styles.cardSub}>
          {isBulkDelivery
            ? "The first accepted packet locks the challan and loads its exact packet total from the server. The camera then keeps scanning continuously; duplicates and other challans are rejected, and proof unlocks automatically only when the counter reaches the total."
            : "The backend validates the latest active sticker, not only the text printed in the QR."}
        </Text>

        {isBulkDelivery && bulkChallanNumber ? (
          <View style={styles.bulkHeaderCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.bulkKicker}>LOCKED CHALLAN</Text>
              <Text style={styles.bulkChallan}>{bulkChallanNumber}</Text>
            </View>

            <View style={styles.bulkCounterWrap}>
              <Text style={styles.bulkCounterValue}>
                {bulkRows.length}
                {bulkExpectedCount > 0 ? `/${bulkExpectedCount}` : ""}
              </Text>
              <Text style={styles.bulkCounterLabel}>SCANNED</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.manualRow}>
          <TextInput
            value={manualSticker}
            onChangeText={setManualSticker}
            placeholder="Sticker Number"
            placeholderTextColor="#64748b"
            autoCapitalize="characters"
            style={styles.input}
            editable={
              !loading &&
              !bulkProofReady &&
              !submitting &&
              !bulkServerCountReached
            }
          />

          <TouchableOpacity
            style={[
              styles.secondaryBtn,
              loading ||
              bulkProofReady ||
              submitting ||
              bulkServerCountReached
                ? styles.disabled
                : null,
            ]}
            onPress={submitManual}
            disabled={
              loading ||
              bulkProofReady ||
              submitting ||
              bulkServerCountReached
            }
          >
            <Text style={styles.secondaryText}>
              {isBulkDelivery ? "Add" : "Resolve"}
            </Text>
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

        {showScanner ? (
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
                  ? "Resolving…"
                  : isBulkDelivery
                    ? bulkRows.length > 0
                      ? bulkExpectedCount > 0
                        ? `Keep scanning • ${bulkRows.length}/${bulkExpectedCount} • ${Math.max(0, bulkExpectedCount - bulkRows.length)} left`
                        : "Loading challan packet count…"
                      : "Scan first packet from the challan"
                    : "Point camera at packet QR"}
              </Text>
            </View>
          </View>
        ) : null}

        {loading ? (
          <ActivityIndicator style={{ marginTop: 14 }} color="#60a5fa" />
        ) : null}

        {isBulkDelivery && bulkRows.length > 0 ? (
          <View style={styles.bulkCart}>
            <View style={styles.bulkCartHead}>
              <View style={{ flex: 1 }}>
                <Text style={styles.bulkCartTitle}>Challan Scan Cart</Text>
                <Text style={styles.bulkCartSub}>
                  {bulkRecoveryMode
                    ? "A previous save stopped part-way through. Only the remaining verified packets are kept here for retry."
                    : bulkExpectedCount > 0
                      ? bulkRows.length === bulkExpectedCount
                        ? "Complete challan scanned. Delivery proof unlocked automatically."
                        : `${bulkExpectedCount - bulkRows.length} packet${bulkExpectedCount - bulkRows.length === 1 ? "" : "s"} remaining. Keep scanning continuously.`
                      : "Loading the authoritative challan packet total…"}
                </Text>
              </View>

              <View
                style={[
                  styles.bulkStateBadge,
                  bulkExpectedCount > 0 && bulkScanComplete
                    ? styles.bulkStateGood
                    : styles.bulkStateScanning,
                ]}
              >
                <Text style={styles.bulkStateText}>
                  {bulkRecoveryMode
                    ? "RETRY"
                    : bulkExpectedCount > 0 && bulkScanComplete
                      ? "COMPLETE"
                      : "SCANNING"}
                </Text>
              </View>
            </View>

            {bulkRows.map((row, index) => (
              <BulkPacketRow
                key={`${packetIdentity(row.data, row.scanText)}-${index}`}
                index={index}
                row={row}
                removable={!bulkProofReady && !submitting}
                onRemove={() => removeBulkRow(index)}
              />
            ))}

            {!bulkProofReady ? (
              <View style={styles.scanProgressBox}>
                <Text style={styles.scanProgressTitle}>
                  {bulkExpectedCount > 0
                    ? `${bulkRows.length} of ${bulkExpectedCount} scanned`
                    : "Reading challan total…"}
                </Text>
                <Text style={styles.scanProgressText}>
                  {bulkExpectedCount > 0
                    ? `${Math.max(0, bulkExpectedCount - bulkRows.length)} packet${Math.max(0, bulkExpectedCount - bulkRows.length) === 1 ? "" : "s"} still required. Scan the next QR; there is no manual finish button.`
                    : "The driver cannot proceed until the server returns the authoritative packet total."}
                </Text>
              </View>
            ) : (
              <View style={styles.scanLockedBox}>
                <Text style={styles.scanLockedTitle}>All challan packets scanned</Text>
                <Text style={styles.scanLockedText}>
                  Exact packet total reached. Receiver, photo and fresh GPS below will now be applied to this complete challan scan set.
                </Text>
              </View>
            )}
          </View>
        ) : null}
      </View>

      {proofVisible ? (
        <>
          <View style={styles.card}>
            <View style={styles.packetTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>
                  {isBulkDelivery
                    ? `Challan ${bulkChallanNumber}`
                    : resolved.itemName || "Packet"}
                </Text>

                <Text style={styles.packetMeta}>
                  {isBulkDelivery
                    ? `${bulkRows.length} packet${bulkRows.length === 1 ? "" : "s"} verified before proof`
                    : resolved.packetNumber || resolved.stickerNumber || "—"}
                </Text>
              </View>

              <View style={[styles.statusBadge, statusTone]}>
                <Text style={styles.statusText}>
                  {isBulkDelivery ? "SCAN COMPLETE" : pretty(resolved.siteStatus)}
                </Text>
              </View>
            </View>

            <View style={styles.infoGrid}>
              <Info
                label="Challan"
                value={
                  isBulkDelivery
                    ? bulkChallanNumber
                    : resolved.challanNumber
                }
              />

              <Info label="Plant" value={resolved.plantCode} />
              <Info label="PD No." value={resolved.pdNo} />
              <Info label="Drawing" value={resolved.drawingNo} />
              <Info label="Client" value={resolved.clientName} />
              <Info label="Driver" value={resolved.driverName || "Unassigned"} />
              <Info label="Vehicle" value={resolved.vehicleNumber || "—"} />
              <Info label="Dispatched" value={formatDateTime(resolved.dispatchedAt)} />

              {isBulkDelivery ? (
                <Info label="Scanned Packets" value={String(bulkRows.length)} />
              ) : null}
            </View>

            {mode === "OPENING" ? (
              <Text style={styles.deliveredHint}>
                Delivered: {formatDateTime(resolved.deliveredAt)}
              </Text>
            ) : null}

          </View>

          {(unassignedDelivery || bulkUnassignedDelivery) ? (
            <View style={styles.unassignedCard}>
              <Text style={styles.unassignedTitle}>
                Unassigned / External Driver Packet
              </Text>

              <Text style={styles.unassignedText}>
                Dispatch left Driver empty for this packet/challan. Any authenticated DRIVER account may claim the delivery only after scanning the exact current QR packet set and submitting the mandatory photo + fresh GPS proof. Your ShipTrack username is saved as Delivered By.
              </Text>
            </View>
          ) : null}

          {mode === "DELIVERY" ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>2. Receiver / site note</Text>

              <Text style={styles.cardSub}>
                {isBulkDelivery
                  ? "These receiver details apply to every scanned packet in this challan delivery set."
                  : "Optional receiver details for this packet delivery."}
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
          ) : null}

          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {mode === "DELIVERY"
                ? "3. Delivery photo evidence"
                : "2. Opening evidence (optional photos)"}
            </Text>

            <Text style={styles.cardSub}>
              {mode === "DELIVERY"
                ? isBulkDelivery
                  ? "Take 1–4 current site photos showing the delivered challan packet set. At least one is mandatory."
                  : "Take 1–4 current site photos. At least one is mandatory."
                : "You may take up to two photos of the packet opening."}
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
              <TouchableOpacity style={styles.addPhotoBtn} onPress={startPhoto}>
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
            <Text style={styles.cardTitle}>
              {mode === "DELIVERY"
                ? isBulkDelivery
                  ? "4. Confirm challan delivery"
                  : "4. Confirm physical delivery"
                : "3. Confirm packet opening"}
            </Text>

            <Text style={styles.cardSub}>
              {isBulkDelivery
                ? "Before any delivery is saved, ShipTrack re-resolves every QR in the cart. One fresh foreground GPS fix is then captured and the same receiver/photo/GPS proof is saved against each scanned packet."
                : "A fresh foreground GPS fix is captured only when you press Confirm. ShipTrack does not start background location tracking."}
            </Text>

            <TextInput
              value={remarks}
              onChangeText={setRemarks}
              placeholder={
                mode === "DELIVERY"
                  ? "Delivery remarks (optional)"
                  : "Opening remarks (optional)"
              }
              placeholderTextColor="#64748b"
              multiline
              style={styles.remarks}
            />

            {bulkProgress ? (
              <View style={styles.progressBox}>
                <ActivityIndicator color="#93c5fd" />
                <Text style={styles.progressText}>{bulkProgress}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[
                styles.confirmBtn,
                submitting ? styles.disabled : null,
              ]}
              onPress={confirm}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.confirmText}>
                  {mode === "DELIVERY"
                    ? isBulkDelivery
                      ? `Confirm ${bulkRows.length} Packet${bulkRows.length === 1 ? "" : "s"} + Photo + GPS`
                      : unassignedDelivery
                        ? "Claim Delivery + Photo + GPS"
                        : "Confirm Delivery + GPS"
                    : "Confirm Opened + GPS"}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.resetBtn}
              onPress={resetPacket}
              disabled={submitting}
            >
              <Text style={styles.resetText}>
                {isBulkDelivery
                  ? "Reset challan scan"
                  : "Scan another packet"}
              </Text>
            </TouchableOpacity>
          </View>
        </>
      ) : null}

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

function ScanModeButton({ active, label, caption, onPress }) {
  return (
    <TouchableOpacity
      style={[
        styles.scanModeBtn,
        active ? styles.scanModeBtnActive : null,
      ]}
      onPress={onPress}
      activeOpacity={0.86}
    >
      <Text
        style={[
          styles.scanModeBtnTitle,
          active ? styles.scanModeBtnTitleActive : null,
        ]}
      >
        {label}
      </Text>

      <Text
        style={[
          styles.scanModeBtnCaption,
          active ? styles.scanModeBtnCaptionActive : null,
        ]}
      >
        {caption}
      </Text>
    </TouchableOpacity>
  );
}

function BulkPacketRow({ index, row, removable, onRemove }) {
  const data = row?.data || {};

  return (
    <View style={styles.bulkRow}>
      <View style={styles.bulkRowNo}>
        <Text style={styles.bulkRowNoText}>{index + 1}</Text>
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.bulkRowTitle} numberOfLines={2}>
          {data.itemName || "Packet"}
        </Text>

        <Text style={styles.bulkRowMeta} numberOfLines={2}>
          {data.packetNumber || data.stickerNumber || "Packet"}
          {data.pdNo ? ` • PD ${data.pdNo}` : ""}
        </Text>
      </View>

      <View style={styles.bulkVerifiedBadge}>
        <Text style={styles.bulkVerifiedText}>✓</Text>
      </View>

      {removable ? (
        <TouchableOpacity style={styles.bulkRemoveBtn} onPress={onRemove}>
          <Text style={styles.bulkRemoveText}>×</Text>
        </TouchableOpacity>
      ) : null}
    </View>
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

  scanModeCard: {
    marginTop: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: "#0b1220",
    borderWidth: 1,
    borderColor: "rgba(96,165,250,.18)",
  },

  scanModeHeader: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },

  scanModeTitle: {
    color: "#e2e8f0",
    fontSize: 13,
    fontWeight: "900",
  },

  scanModeSub: {
    marginTop: 3,
    color: "#64748b",
    fontSize: 10.5,
    lineHeight: 15,
    fontWeight: "700",
  },

  cartCountBadge: {
    minWidth: 34,
    height: 34,
    paddingHorizontal: 8,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563eb",
  },

  cartCountText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "900",
  },

  scanModeRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },

  scanModeBtn: {
    flex: 1,
    minHeight: 62,
    paddingHorizontal: 10,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,.035)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.08)",
  },

  scanModeBtnActive: {
    backgroundColor: "rgba(37,99,235,.18)",
    borderColor: "rgba(96,165,250,.42)",
  },

  scanModeBtnTitle: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "900",
    textAlign: "center",
  },

  scanModeBtnTitleActive: {
    color: "#dbeafe",
  },

  scanModeBtnCaption: {
    marginTop: 4,
    color: "#475569",
    fontSize: 9.5,
    fontWeight: "800",
  },

  scanModeBtnCaptionActive: {
    color: "#93c5fd",
  },

  card: {
    marginTop: 12,
    padding: 16,
    borderRadius: 20,
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.09)",
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

  bulkHeaderCard: {
    marginTop: 13,
    padding: 12,
    borderRadius: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(37,99,235,.10)",
    borderWidth: 1,
    borderColor: "rgba(96,165,250,.22)",
  },

  bulkKicker: {
    color: "#60a5fa",
    fontSize: 8.5,
    fontWeight: "900",
    letterSpacing: 1.1,
  },

  bulkChallan: {
    marginTop: 4,
    color: "#dbeafe",
    fontSize: 14,
    fontWeight: "900",
  },

  bulkCounterWrap: {
    alignItems: "flex-end",
  },

  bulkCounterValue: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "900",
  },

  bulkCounterLabel: {
    marginTop: 1,
    color: "#64748b",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.8,
  },

  bulkCart: {
    marginTop: 14,
    paddingTop: 13,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,.08)",
  },

  bulkCartHead: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 8,
  },

  bulkCartTitle: {
    color: "#e2e8f0",
    fontSize: 13,
    fontWeight: "900",
  },

  bulkCartSub: {
    marginTop: 3,
    color: "#64748b",
    fontSize: 10,
    lineHeight: 15,
    fontWeight: "700",
  },

  bulkStateBadge: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },

  bulkStateScanning: {
    backgroundColor: "rgba(245,158,11,.10)",
    borderColor: "rgba(245,158,11,.24)",
  },

  bulkStateGood: {
    backgroundColor: "rgba(16,185,129,.10)",
    borderColor: "rgba(16,185,129,.25)",
  },

  bulkStateText: {
    color: "#e2e8f0",
    fontSize: 8.5,
    fontWeight: "900",
  },

  bulkRow: {
    minHeight: 62,
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

  bulkRowNo: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(59,130,246,.13)",
  },

  bulkRowNoText: {
    color: "#93c5fd",
    fontSize: 10,
    fontWeight: "900",
  },

  bulkRowTitle: {
    color: "#e2e8f0",
    fontSize: 11.5,
    fontWeight: "900",
  },

  bulkRowMeta: {
    marginTop: 3,
    color: "#64748b",
    fontSize: 9.5,
    fontWeight: "700",
  },

  bulkVerifiedBadge: {
    width: 25,
    height: 25,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(16,185,129,.12)",
    borderWidth: 1,
    borderColor: "rgba(16,185,129,.25)",
  },

  bulkVerifiedText: {
    color: "#6ee7b7",
    fontSize: 12,
    fontWeight: "900",
  },

  bulkRemoveBtn: {
    width: 27,
    height: 27,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(239,68,68,.08)",
  },

  bulkRemoveText: {
    color: "#fca5a5",
    fontSize: 18,
    fontWeight: "900",
    lineHeight: 20,
  },

  scanProgressBox: {
    marginTop: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(96,165,250,.28)",
    backgroundColor: "rgba(37,99,235,.10)",
    padding: 13,
  },

  scanProgressTitle: {
    color: "#dbeafe",
    fontSize: 13,
    fontWeight: "900",
  },

  scanProgressText: {
    color: "#93c5fd",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
  },

  scanLockedBox: {
    marginTop: 12,
    padding: 11,
    borderRadius: 13,
    backgroundColor: "rgba(16,185,129,.08)",
    borderWidth: 1,
    borderColor: "rgba(16,185,129,.20)",
  },

  scanLockedTitle: {
    color: "#6ee7b7",
    fontSize: 11,
    fontWeight: "900",
  },

  scanLockedText: {
    marginTop: 3,
    color: "#94a3b8",
    fontSize: 10,
    lineHeight: 15,
    fontWeight: "700",
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

  unassignedCard: {
    marginTop: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: "rgba(245,158,11,.11)",
    borderWidth: 1,
    borderColor: "rgba(245,158,11,.30)",
  },

  unassignedTitle: {
    color: "#fbbf24",
    fontSize: 13,
    fontWeight: "900",
  },

  unassignedText: {
    marginTop: 6,
    color: "#fde68a",
    fontSize: 11.5,
    fontWeight: "700",
    lineHeight: 18,
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
