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
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
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

export default function SiteLifecycleScreen({
  route,
  navigation,
  initialMode,
}) {
  const { hasRole, username, logout } = useAuth();
  const canDelivery = hasRole("DRIVER") || hasRole("ADMIN");
  const canOpening = hasRole("ONSITE") || hasRole("LOGISTICS") || hasRole("ADMIN");

  const requestedMode = normalize(route?.params?.mode || initialMode);
  const defaultMode = requestedMode === "OPENING" && canOpening
    ? "OPENING"
    : requestedMode === "DELIVERY" && canDelivery
      ? "DELIVERY"
      : canDelivery
        ? "DELIVERY"
        : "OPENING";

  const [mode, setMode] = useState(defaultMode);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);

  const [cameraPurpose, setCameraPurpose] = useState("SCAN");
  const [scannerEnabled, setScannerEnabled] = useState(true);
  const [scanText, setScanText] = useState("");
  const [manualSticker, setManualSticker] = useState("");
  const [resolved, setResolved] = useState(null);
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

  const maxPhotos = mode === "DELIVERY" ? 4 : 2;
  const photoRequired = mode === "DELIVERY";
  const siteStatus = normalize(resolved?.siteStatus || "AWAITING_DELIVERY");

  const modeTitle = mode === "DELIVERY" ? "Site Delivery Proof" : "On-site Packet Opening";
  const modeSub = mode === "DELIVERY"
    ? "Scan the exact packet, photograph it at site, capture fresh GPS and mark physical delivery."
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

  const resetPacket = () => {
    setResolved(null);
    setScanText("");
    setManualSticker("");
    setPhotos([]);
    setReceiverName("");
    setReceiverPhone("");
    setRemarks("");
    setCameraPurpose("SCAN");
    setScannerEnabled(true);
  };

  const resolvePacket = async (value) => {
    const raw = clean(value);
    if (!raw) return false;

    try {
      setLoading(true);
      setLastResult(null);
      const data = await resolveSitePacket(raw, mode);
      setResolved(data);
      setScanText(raw);
      setScannerEnabled(false);
      setCameraPurpose("SCAN");
      setPhotos([]);
      return true;
    } catch (error) {
      Alert.alert("Packet not accepted", getBackendMessage(error, "Unable to resolve packet"));
      setScannerEnabled(true);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const onBarcodeScanned = async ({ data }) => {
    if (!scannerEnabled || loading || cameraPurpose !== "SCAN") return;
    setScannerEnabled(false);
    const ok = await resolvePacket(data);
    if (!ok) setScannerEnabled(true);
  };

  const submitManual = async () => {
    try {
      const value = buildStickerScanText(manualSticker);
      await resolvePacket(value);
    } catch (error) {
      Alert.alert("Sticker Number", error?.message || "Enter Sticker Number");
    }
  };

  const startPhoto = async () => {
    if (!resolved) {
      Alert.alert("Scan first", "Scan the packet before taking evidence photos.");
      return;
    }
    if (photos.length >= maxPhotos) {
      Alert.alert("Photo limit", `Maximum ${maxPhotos} photo${maxPhotos === 1 ? "" : "s"} allowed.`);
      return;
    }
    const allowed = await ensureCameraPermission();
    if (!allowed) {
      Alert.alert("Camera required", "Camera permission is required to capture site evidence.");
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
        setPhotos((current) => [...current, { uri: picture.uri }].slice(0, maxPhotos));
      }
      setCameraPurpose("SCAN");
    } catch (error) {
      Alert.alert("Photo failed", error?.message || "Unable to capture photo");
    } finally {
      setCapturing(false);
    }
  };

  const removePhoto = (index) => {
    setPhotos((current) => current.filter((_, photoIndex) => photoIndex !== index));
  };

  const captureFreshLocation = async () => {
    const permissionResult = await Location.requestForegroundPermissionsAsync();
    if (permissionResult?.status !== "granted") {
      throw new Error("Foreground location permission is required to record site proof.");
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

  const confirm = async () => {
    if (!resolved || !scanText) {
      Alert.alert("Scan required", "Scan the exact packet before confirming.");
      return;
    }

    if (photoRequired && photos.length < 1) {
      Alert.alert("Delivery photo required", "Take at least one photo showing the delivered packet at site.");
      return;
    }

    try {
      setSubmitting(true);
      const location = await captureFreshLocation();
      const result = mode === "DELIVERY"
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
      Alert.alert("Site proof failed", getBackendMessage(error, "Unable to save site proof"));
    } finally {
      setSubmitting(false);
    }
  };

  const canSwitchMode = canDelivery && canOpening;

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
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
          <ModeButton active={mode === "DELIVERY"} label="Driver Delivery" onPress={() => { setMode("DELIVERY"); resetPacket(); }} />
          <ModeButton active={mode === "OPENING"} label="On-site Opening" onPress={() => { setMode("OPENING"); resetPacket(); }} />
        </View>
      ) : null}

      {lastResult ? (
        <View style={styles.successCard}>
          <Text style={styles.successTitle}>Last proof saved</Text>
          <Text style={styles.successText}>{lastResult.itemName || "Packet"} • {pretty(lastResult.siteStatus)}</Text>
          <Text style={styles.successText}>{formatDateTime(lastResult.openedAt || lastResult.deliveredAt)}</Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>1. Verify physical packet</Text>
        <Text style={styles.cardSub}>The backend validates the latest active sticker, not only the text printed in the QR.</Text>

        <View style={styles.manualRow}>
          <TextInput
            value={manualSticker}
            onChangeText={setManualSticker}
            placeholder="Sticker Number"
            placeholderTextColor="#64748b"
            autoCapitalize="characters"
            style={styles.input}
          />
          <TouchableOpacity style={styles.secondaryBtn} onPress={submitManual} disabled={loading}>
            <Text style={styles.secondaryText}>Resolve</Text>
          </TouchableOpacity>
        </View>

        {!permission?.granted ? (
          <TouchableOpacity style={styles.cameraPermissionBtn} onPress={ensureCameraPermission}>
            <Text style={styles.cameraPermissionText}>Enable Camera for QR / Photos</Text>
          </TouchableOpacity>
        ) : null}

        {permission?.granted && cameraPurpose === "SCAN" && !resolved ? (
          <View style={styles.cameraBox}>
            <CameraView
              ref={cameraRef}
              style={styles.camera}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
              onBarcodeScanned={scannerEnabled ? onBarcodeScanned : undefined}
            />
            <View style={styles.scanOverlay}><Text style={styles.scanOverlayText}>{loading ? "Resolving…" : "Point camera at packet QR"}</Text></View>
          </View>
        ) : null}

        {loading ? <ActivityIndicator style={{ marginTop: 14 }} color="#60a5fa" /> : null}
      </View>

      {resolved ? (
        <>
          <View style={styles.card}>
            <View style={styles.packetTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{resolved.itemName || "Packet"}</Text>
                <Text style={styles.packetMeta}>{resolved.packetNumber || resolved.stickerNumber || "—"}</Text>
              </View>
              <View style={[styles.statusBadge, statusTone]}>
                <Text style={styles.statusText}>{pretty(resolved.siteStatus)}</Text>
              </View>
            </View>

            <View style={styles.infoGrid}>
              <Info label="Challan" value={resolved.challanNumber} />
              <Info label="Plant" value={resolved.plantCode} />
              <Info label="PD No." value={resolved.pdNo} />
              <Info label="Drawing" value={resolved.drawingNo} />
              <Info label="Client" value={resolved.clientName} />
              <Info label="Driver" value={resolved.driverName || "Unassigned"} />
              <Info label="Vehicle" value={resolved.vehicleNumber || "—"} />
              <Info label="Dispatched" value={formatDateTime(resolved.dispatchedAt)} />
            </View>

            {mode === "OPENING" ? (
              <Text style={styles.deliveredHint}>Delivered: {formatDateTime(resolved.deliveredAt)}</Text>
            ) : null}
          </View>

          {mode === "DELIVERY" ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>2. Receiver / site note</Text>
              <TextInput value={receiverName} onChangeText={setReceiverName} placeholder="Receiver name (optional)" placeholderTextColor="#64748b" style={styles.inputFull} />
              <TextInput value={receiverPhone} onChangeText={setReceiverPhone} placeholder="Receiver phone (optional)" placeholderTextColor="#64748b" keyboardType="phone-pad" style={styles.inputFull} />
            </View>
          ) : null}

          <View style={styles.card}>
            <Text style={styles.cardTitle}>{mode === "DELIVERY" ? "3. Delivery photo evidence" : "2. Opening evidence (optional photos)"}</Text>
            <Text style={styles.cardSub}>{mode === "DELIVERY" ? "Take 1–4 current site photos. At least one is mandatory." : "You may take up to two photos of the packet opening."}</Text>

            {cameraPurpose === "PHOTO" ? (
              <View style={styles.cameraBox}>
                <CameraView ref={cameraRef} style={styles.camera} facing="back" />
                <View style={styles.photoControls}>
                  <TouchableOpacity style={styles.captureBtn} onPress={capturePhoto} disabled={capturing}>
                    <Text style={styles.captureText}>{capturing ? "Saving…" : "Take Photo"}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.cancelCameraBtn} onPress={() => setCameraPurpose("SCAN")}>
                    <Text style={styles.cancelCameraText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity style={styles.addPhotoBtn} onPress={startPhoto}>
                <Text style={styles.addPhotoText}>+ Take Photo ({photos.length}/{maxPhotos})</Text>
              </TouchableOpacity>
            )}

            <View style={styles.photoGrid}>
              {photos.map((photo, index) => (
                <View key={`${photo.uri}-${index}`} style={styles.photoWrap}>
                  <Image source={{ uri: photo.uri }} style={styles.photo} />
                  <TouchableOpacity style={styles.removePhoto} onPress={() => removePhoto(index)}>
                    <Text style={styles.removePhotoText}>×</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>{mode === "DELIVERY" ? "4. Confirm physical delivery" : "3. Confirm packet opening"}</Text>
            <Text style={styles.cardSub}>A fresh foreground GPS fix is captured only when you press Confirm. ShipTrack does not start background location tracking.</Text>
            <TextInput
              value={remarks}
              onChangeText={setRemarks}
              placeholder={mode === "DELIVERY" ? "Delivery remarks (optional)" : "Opening remarks (optional)"}
              placeholderTextColor="#64748b"
              multiline
              style={styles.remarks}
            />

            <TouchableOpacity style={[styles.confirmBtn, submitting ? styles.disabled : null]} onPress={confirm} disabled={submitting}>
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmText}>{mode === "DELIVERY" ? "Confirm Delivery + GPS" : "Confirm Opened + GPS"}</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.resetBtn} onPress={resetPacket} disabled={submitting}>
              <Text style={styles.resetText}>Scan another packet</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : null}

      {navigation?.canGoBack?.() ? (
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
      ) : null}
    </ScrollView>
  );
}

function ModeButton({ active, label, onPress }) {
  return <TouchableOpacity style={[styles.modeBtn, active ? styles.modeBtnActive : null]} onPress={onPress}><Text style={[styles.modeText, active ? styles.modeTextActive : null]}>{label}</Text></TouchableOpacity>;
}

function Info({ label, value }) {
  return <View style={styles.info}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{clean(value) || "—"}</Text></View>;
}

const styles = {
  page: { flex: 1, backgroundColor: "#020617" },
  content: { padding: 16, paddingBottom: 38 },
  hero: { flexDirection: "row", gap: 12, alignItems: "flex-start", padding: 18, borderRadius: 22, backgroundColor: "#0f172a", borderWidth: 1, borderColor: "rgba(255,255,255,.09)" },
  kicker: { color: "#60a5fa", fontSize: 10, fontWeight: "900", letterSpacing: 1.4 },
  title: { marginTop: 6, color: "#fff", fontSize: 25, fontWeight: "900" },
  sub: { marginTop: 7, color: "#94a3b8", fontSize: 12, fontWeight: "700", lineHeight: 18 },
  identity: { marginTop: 8, color: "#cbd5e1", fontSize: 11, fontWeight: "900" },
  logout: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: 12, backgroundColor: "rgba(239,68,68,.10)", borderWidth: 1, borderColor: "rgba(239,68,68,.20)" },
  logoutText: { color: "#fca5a5", fontWeight: "900", fontSize: 11 },
  modeRow: { flexDirection: "row", gap: 8, marginTop: 12, padding: 4, borderRadius: 14, backgroundColor: "#0f172a" },
  modeBtn: { flex: 1, minHeight: 42, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  modeBtnActive: { backgroundColor: "#2563eb" },
  modeText: { color: "#94a3b8", fontWeight: "900", fontSize: 12 },
  modeTextActive: { color: "#fff" },
  card: { marginTop: 12, padding: 16, borderRadius: 20, backgroundColor: "#0f172a", borderWidth: 1, borderColor: "rgba(255,255,255,.09)" },
  cardTitle: { color: "#fff", fontSize: 16, fontWeight: "900" },
  cardSub: { color: "#94a3b8", fontSize: 11, fontWeight: "700", lineHeight: 17, marginTop: 5 },
  manualRow: { flexDirection: "row", gap: 8, marginTop: 14 },
  input: { flex: 1, minHeight: 48, paddingHorizontal: 13, borderRadius: 14, backgroundColor: "rgba(255,255,255,.05)", borderWidth: 1, borderColor: "rgba(255,255,255,.10)", color: "#fff", fontWeight: "800" },
  inputFull: { minHeight: 48, marginTop: 10, paddingHorizontal: 13, borderRadius: 14, backgroundColor: "rgba(255,255,255,.05)", borderWidth: 1, borderColor: "rgba(255,255,255,.10)", color: "#fff", fontWeight: "800" },
  secondaryBtn: { minWidth: 86, minHeight: 48, borderRadius: 14, backgroundColor: "rgba(59,130,246,.13)", borderWidth: 1, borderColor: "rgba(59,130,246,.28)", alignItems: "center", justifyContent: "center" },
  secondaryText: { color: "#93c5fd", fontWeight: "900", fontSize: 12 },
  cameraPermissionBtn: { marginTop: 12, minHeight: 44, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(245,158,11,.10)", borderWidth: 1, borderColor: "rgba(245,158,11,.24)" },
  cameraPermissionText: { color: "#fbbf24", fontWeight: "900", fontSize: 12 },
  cameraBox: { marginTop: 14, height: 340, borderRadius: 18, overflow: "hidden", backgroundColor: "#000", position: "relative" },
  camera: { flex: 1 },
  scanOverlay: { position: "absolute", left: 18, right: 18, bottom: 18, padding: 10, borderRadius: 12, backgroundColor: "rgba(2,6,23,.80)" },
  scanOverlayText: { color: "#fff", textAlign: "center", fontWeight: "900", fontSize: 12 },
  packetTop: { flexDirection: "row", gap: 10, alignItems: "center" },
  packetMeta: { color: "#94a3b8", fontSize: 11, fontWeight: "800", marginTop: 4 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, borderWidth: 1 },
  waitBadge: { backgroundColor: "rgba(245,158,11,.10)", borderColor: "rgba(245,158,11,.28)" },
  deliveredBadge: { backgroundColor: "rgba(16,185,129,.10)", borderColor: "rgba(16,185,129,.28)" },
  goodBadge: { backgroundColor: "rgba(139,92,246,.11)", borderColor: "rgba(139,92,246,.28)" },
  statusText: { color: "#e2e8f0", fontSize: 9, fontWeight: "900" },
  infoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
  info: { width: "47%", minHeight: 58, padding: 10, borderRadius: 13, backgroundColor: "rgba(255,255,255,.035)" },
  infoLabel: { color: "#64748b", fontSize: 9, fontWeight: "900", textTransform: "uppercase" },
  infoValue: { marginTop: 5, color: "#e2e8f0", fontSize: 11, fontWeight: "800" },
  deliveredHint: { marginTop: 12, color: "#6ee7b7", fontSize: 11, fontWeight: "800" },
  addPhotoBtn: { marginTop: 13, minHeight: 46, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(59,130,246,.12)", borderWidth: 1, borderColor: "rgba(59,130,246,.28)" },
  addPhotoText: { color: "#93c5fd", fontWeight: "900", fontSize: 12 },
  photoControls: { position: "absolute", left: 16, right: 16, bottom: 16, flexDirection: "row", gap: 8 },
  captureBtn: { flex: 1, minHeight: 46, borderRadius: 14, backgroundColor: "#2563eb", alignItems: "center", justifyContent: "center" },
  captureText: { color: "#fff", fontWeight: "900" },
  cancelCameraBtn: { minWidth: 90, minHeight: 46, borderRadius: 14, backgroundColor: "rgba(2,6,23,.82)", alignItems: "center", justifyContent: "center" },
  cancelCameraText: { color: "#cbd5e1", fontWeight: "900" },
  photoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  photoWrap: { width: 105, height: 105, borderRadius: 14, overflow: "hidden", position: "relative", borderWidth: 1, borderColor: "rgba(255,255,255,.10)" },
  photo: { width: "100%", height: "100%" },
  removePhoto: { position: "absolute", right: 5, top: 5, width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(2,6,23,.85)" },
  removePhotoText: { color: "#fff", fontWeight: "900", fontSize: 18, lineHeight: 20 },
  remarks: { minHeight: 90, marginTop: 12, padding: 12, borderRadius: 14, backgroundColor: "rgba(255,255,255,.05)", borderWidth: 1, borderColor: "rgba(255,255,255,.10)", color: "#fff", textAlignVertical: "top", fontWeight: "700" },
  confirmBtn: { minHeight: 52, marginTop: 13, borderRadius: 15, backgroundColor: "#059669", alignItems: "center", justifyContent: "center" },
  confirmText: { color: "#fff", fontWeight: "900", fontSize: 14 },
  disabled: { opacity: 0.65 },
  resetBtn: { minHeight: 42, marginTop: 8, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.04)" },
  resetText: { color: "#94a3b8", fontWeight: "900", fontSize: 12 },
  successCard: { marginTop: 12, padding: 13, borderRadius: 16, backgroundColor: "rgba(16,185,129,.10)", borderWidth: 1, borderColor: "rgba(16,185,129,.24)" },
  successTitle: { color: "#6ee7b7", fontWeight: "900", fontSize: 12 },
  successText: { color: "#cbd5e1", fontWeight: "700", fontSize: 11, marginTop: 4 },
  backBtn: { minHeight: 44, marginTop: 12, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.04)" },
  backText: { color: "#cbd5e1", fontWeight: "900" },
};
