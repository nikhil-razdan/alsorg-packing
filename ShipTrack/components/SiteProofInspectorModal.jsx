import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import {
  deleteSiteEvidenceFiles,
  downloadSiteEvidence,
  fetchSiteLifecycleDetail,
  getSitePacketItemId,
  normalizeSiteStatus,
  siteStatusLabel,
} from "../api/siteLifecycleApi";

const clean = (value) =>
  String(value ?? "").trim();

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

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return raw;
    }

    return new Intl.DateTimeFormat(
      "en-IN",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }
    ).format(date);
  } catch {
    return raw;
  }
}

function formatGps(
  latitude,
  longitude,
  accuracy
) {
  const lat =
    Number(latitude);

  const lng =
    Number(longitude);

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng)
  ) {
    return "—";
  }

  const acc =
    Number(accuracy);

  return `${lat.toFixed(6)}, ${lng.toFixed(6)}${
    Number.isFinite(acc) && acc > 0
      ? ` • ±${Math.round(acc)} m`
      : ""
  }`;
}

function statusTone(status) {
  const normalized =
    normalizeSiteStatus(status);

  if (
    normalized ===
    "OPENED_ON_SITE"
  ) {
    return {
      backgroundColor:
        "rgba(139,92,246,.15)",
      borderColor:
        "rgba(167,139,250,.32)",
      color:
        "#c4b5fd",
    };
  }

  if (
    normalized ===
    "DELIVERED"
  ) {
    return {
      backgroundColor:
        "rgba(16,185,129,.14)",
      borderColor:
        "rgba(52,211,153,.30)",
      color:
        "#6ee7b7",
    };
  }

  return {
    backgroundColor:
      "rgba(245,158,11,.14)",
    borderColor:
      "rgba(251,191,36,.28)",
    color:
      "#fcd34d",
  };
}

export function SiteStatusPill({
  status,
  compact = false,
}) {
  const tone =
    statusTone(status);

  return (
    <View
      style={[
        styles.statusPill,
        compact
          ? styles.statusPillCompact
          : null,
        {
          backgroundColor:
            tone.backgroundColor,
          borderColor:
            tone.borderColor,
        },
      ]}
    >
      <Text
        style={[
          styles.statusPillText,
          compact
            ? styles.statusPillTextCompact
            : null,
          {
            color:
              tone.color,
          },
        ]}
        numberOfLines={1}
      >
        {siteStatusLabel(status)}
      </Text>
    </View>
  );
}

export default function SiteProofInspectorModal({
  visible,
  item,
  metadata = null,
  onClose,
}) {
  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    detail,
    setDetail,
  ] = useState(null);

  const [
    evidenceFiles,
    setEvidenceFiles,
  ] = useState([]);

  const [
    evidenceError,
    setEvidenceError,
  ] = useState("");

  const [
    selectedEvidence,
    setSelectedEvidence,
  ] = useState("");

  const packetItemId =
    getSitePacketItemId(item);

  const fallbackDetail =
    useMemo(
      () => ({
        ...(metadata || {}),
        siteStatus:
          metadata?.siteStatus ||
          "AWAITING_DELIVERY",
        packetItemId:
          packetItemId ||
          metadata?.packetItemId,
        itemName:
          item?.name ||
          item?.itemName ||
          metadata?.itemName,
        packetNumber:
          item?.packetNumber ||
          metadata?.packetNumber,
        stickerNumber:
          item?.stickerNumber ||
          metadata?.stickerNumber,
        pdNo:
          item?.pdNo ||
          metadata?.pdNo,
        drawingNo:
          item?.drawingNo ||
          item?.dwgNo ||
          metadata?.drawingNo,
        clientName:
          item?.clientName ||
          metadata?.clientName,
        plantCode:
          item?.displayPlantCode ||
          item?.plantCode ||
          metadata?.plantCode,
        challanNumber:
          item?.chalaanNumber ||
          item?.challanNumber ||
          metadata?.challanNumber,
        dispatchedAt:
          item?.dispatchedAt ||
          metadata?.dispatchedAt,
        driverName:
          item?.driverName ||
          metadata?.driverName,
        vehicleNumber:
          item?.vehicleNumber ||
          metadata?.vehicleNumber,
      }),
      [
        item,
        metadata,
        packetItemId,
      ]
    );

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!visible) {
        return;
      }

      setDetail(
        fallbackDetail
      );
      setEvidenceError("");
      setSelectedEvidence("");

      await deleteSiteEvidenceFiles(
        evidenceFiles
      );

      if (!cancelled) {
        setEvidenceFiles([]);
      }

      if (!packetItemId) {
        setEvidenceError(
          "This dispatch row is not linked to a physical Packet Item ID, so site proof cannot be inspected."
        );
        return;
      }

      try {
        setLoading(true);

        const nextDetail =
          await fetchSiteLifecycleDetail(
            packetItemId
          );

        if (cancelled) {
          return;
        }

        setDetail({
          ...fallbackDetail,
          ...(nextDetail || {}),
        });

        const evidenceIds =
          Array.isArray(
            nextDetail?.evidenceIds
          )
            ? nextDetail.evidenceIds
            : [];

        if (
          evidenceIds.length === 0
        ) {
          return;
        }

        const results =
          await Promise.allSettled(
            evidenceIds.map(
              (id) =>
                downloadSiteEvidence(id)
            )
          );

        if (cancelled) {
          const downloaded =
            results
              .filter(
                (result) =>
                  result.status ===
                  "fulfilled"
              )
              .map(
                (result) =>
                  result.value
              );

          await deleteSiteEvidenceFiles(
            downloaded
          );
          return;
        }

        const downloaded =
          results
            .filter(
              (result) =>
                result.status ===
                "fulfilled"
            )
            .map(
              (result) =>
                result.value
            );

        setEvidenceFiles(
          downloaded
        );

        if (
          downloaded.length <
          evidenceIds.length
        ) {
          setEvidenceError(
            "Some protected evidence photos could not be loaded. Pull to refresh the parent screen and try again."
          );
        }
      } catch (error) {
        if (!cancelled) {
          const statusCode =
            Number(
              error?.response?.status ||
              0
            );

          /*
           * A packet can legitimately have no site-lifecycle row before its
           * first delivery proof. Keep the dispatch facts visible and show the
           * synthesized Awaiting Site Delivery state instead of treating that
           * normal condition as a broken inspection. Authorization failures
           * (403) and real server errors are still surfaced.
           */
          if (statusCode !== 404) {
            setEvidenceError(
              error?.response?.data?.message ||
              error?.message ||
              "Unable to load site proof."
            );
          }
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
    // evidenceFiles is deliberately not a dependency:
    // every open starts from a fresh protected download set.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    visible,
    packetItemId,
  ]);

  useEffect(
    () => () => {
      void deleteSiteEvidenceFiles(
        evidenceFiles
      );
    },
    [evidenceFiles]
  );

  const close = async () => {
    setSelectedEvidence("");

    const files =
      evidenceFiles;

    setEvidenceFiles([]);
    setDetail(null);
    setEvidenceError("");
    setLoading(false);

    await deleteSiteEvidenceFiles(
      files
    );

    onClose?.();
  };

  const current =
    detail ||
    fallbackDetail ||
    {};

  const siteStatus =
    normalizeSiteStatus(
      current?.siteStatus
    );

  const evidenceCount =
    Number(
      current?.deliveryPhotoCount ||
      0
    ) +
    Number(
      current?.openingPhotoCount ||
      0
    );

  return (
    <>
      <Modal
        visible={Boolean(visible)}
        transparent
        animationType="fade"
        onRequestClose={close}
      >
        <View style={styles.overlay}>
          <TouchableOpacity
            style={styles.backdrop}
            activeOpacity={1}
            onPress={close}
          />

          <View style={styles.modal}>
            <View style={styles.header}>
              <View style={{ flex: 1 }}>
                <Text style={styles.kicker}>
                  SITE PROOF INSPECTION
                </Text>

                <Text
                  style={styles.title}
                  numberOfLines={2}
                >
                  {clean(
                    current?.itemName
                  ) || "Packet"}
                </Text>

                <Text
                  style={styles.subtitle}
                  numberOfLines={2}
                >
                  {clean(
                    current?.challanNumber
                  ) || "No challan"}{" "}
                  •{" "}
                  {clean(
                    current?.packetNumber ||
                    current?.stickerNumber
                  ) || "Packet"}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.closeBtn}
                onPress={close}
              >
                <Text style={styles.closeText}>
                  ×
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                paddingBottom: 18,
              }}
            >
              <View style={styles.statusRow}>
                <SiteStatusPill
                  status={siteStatus}
                />

                <Text style={styles.evidenceCount}>
                  {evidenceCount} photo
                  {evidenceCount === 1
                    ? ""
                    : "s"}
                </Text>
              </View>

              {loading ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator
                    color="#60a5fa"
                  />

                  <Text style={styles.loadingText}>
                    Loading protected site timeline and evidence…
                  </Text>
                </View>
              ) : null}

              {evidenceError ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>
                    {evidenceError}
                  </Text>
                </View>
              ) : null}

              <Section
                title="Packet / Dispatch"
              >
                <Grid>
                  <Detail
                    label="PD No."
                    value={current?.pdNo}
                  />

                  <Detail
                    label="Drawing"
                    value={
                      current?.drawingNo
                    }
                  />

                  <Detail
                    label="Client"
                    value={
                      current?.clientName
                    }
                  />

                  <Detail
                    label="Plant"
                    value={
                      current?.plantCode ||
                      item?.displayPlantCode
                    }
                  />

                  <Detail
                    label="Dispatch Driver"
                    value={
                      current?.driverName ||
                      "Unassigned"
                    }
                  />

                  <Detail
                    label="Vehicle"
                    value={
                      current?.vehicleNumber ||
                      "Not recorded"
                    }
                  />

                  <Detail
                    label="Dispatched At"
                    value={formatDateTime(
                      current?.dispatchedAt
                    )}
                  />
                </Grid>
              </Section>

              <Section
                title="Site Delivery"
              >
                <Grid>
                  <Detail
                    label="Delivered At"
                    value={formatDateTime(
                      current?.deliveredAt
                    )}
                  />

                  <Detail
                    label="Delivered By"
                    value={
                      current?.deliveredBy
                    }
                  />

                  <Detail
                    label="Receiver"
                    value={
                      [
                        current?.receiverName,
                        current?.receiverPhone,
                      ]
                        .filter(Boolean)
                        .join(" • ")
                    }
                  />

                  <Detail
                    label="Delivery GPS"
                    value={formatGps(
                      current?.deliveryLatitude,
                      current?.deliveryLongitude,
                      current?.deliveryAccuracy ??
                      current?.deliveryLocationAccuracy
                    )}
                    wide
                  />

                  <Detail
                    label="Delivery Photos"
                    value={String(
                      Number(
                        current?.deliveryPhotoCount ||
                        0
                      )
                    )}
                  />
                </Grid>

                {clean(
                  current?.deliveryRemarks
                ) ? (
                  <Note
                    label="Delivery Remarks"
                    value={
                      current.deliveryRemarks
                    }
                  />
                ) : null}
              </Section>

              <Section
                title="On-site Opening"
              >
                <Grid>
                  <Detail
                    label="Opened At"
                    value={formatDateTime(
                      current?.openedAt
                    )}
                  />

                  <Detail
                    label="Opened By"
                    value={
                      current?.openedBy
                    }
                  />

                  <Detail
                    label="Opening GPS"
                    value={formatGps(
                      current?.openingLatitude,
                      current?.openingLongitude,
                      current?.openingAccuracy ??
                      current?.openingLocationAccuracy
                    )}
                    wide
                  />

                  <Detail
                    label="Opening Photos"
                    value={String(
                      Number(
                        current?.openingPhotoCount ||
                        0
                      )
                    )}
                  />
                </Grid>

                {clean(
                  current?.openingRemarks
                ) ? (
                  <Note
                    label="Opening Remarks"
                    value={
                      current.openingRemarks
                    }
                  />
                ) : null}
              </Section>

              <Section
                title="Protected Evidence"
              >
                {evidenceFiles.length ===
                0 ? (
                  <Text style={styles.noEvidence}>
                    {loading
                      ? "Evidence is loading…"
                      : evidenceCount > 0
                        ? "Evidence records exist but the protected image bytes could not be loaded."
                        : "No evidence photos are recorded for this packet yet."}
                  </Text>
                ) : (
                  <View style={styles.photoGrid}>
                    {evidenceFiles.map(
                      (
                        evidence,
                        index
                      ) => (
                        <TouchableOpacity
                          key={
                            evidence.evidenceId ||
                            evidence.uri ||
                            index
                          }
                          style={styles.photoWrap}
                          onPress={() =>
                            setSelectedEvidence(
                              evidence.uri
                            )
                          }
                        >
                          <Image
                            source={{
                              uri:
                                evidence.uri,
                            }}
                            style={styles.photo}
                            resizeMode="cover"
                          />

                          <View style={styles.photoLabel}>
                            <Text style={styles.photoLabelText}>
                              Evidence{" "}
                              {index + 1}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      )
                    )}
                  </View>
                )}
              </Section>
            </ScrollView>

            <TouchableOpacity
              style={styles.doneBtn}
              onPress={close}
            >
              <Text style={styles.doneText}>
                Close Site Proof
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={Boolean(
          selectedEvidence
        )}
        transparent
        animationType="fade"
        onRequestClose={() =>
          setSelectedEvidence("")
        }
      >
        <View style={styles.imageOverlay}>
          <TouchableOpacity
            style={styles.imageBackdrop}
            activeOpacity={1}
            onPress={() =>
              setSelectedEvidence("")
            }
          />

          {selectedEvidence ? (
            <Image
              source={{
                uri:
                  selectedEvidence,
              }}
              style={styles.fullImage}
              resizeMode="contain"
            />
          ) : null}

          <TouchableOpacity
            style={styles.imageClose}
            onPress={() =>
              setSelectedEvidence("")
            }
          >
            <Text style={styles.imageCloseText}>
              ×
            </Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </>
  );
}

function Section({
  title,
  children,
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>
        {title}
      </Text>

      {children}
    </View>
  );
}

function Grid({
  children,
}) {
  return (
    <View style={styles.grid}>
      {children}
    </View>
  );
}

function Detail({
  label,
  value,
  wide = false,
}) {
  const text =
    clean(value) || "—";

  return (
    <View
      style={[
        styles.detail,
        wide
          ? styles.detailWide
          : null,
      ]}
    >
      <Text style={styles.detailLabel}>
        {label}
      </Text>

      <Text
        style={styles.detailValue}
        selectable
      >
        {text}
      </Text>
    </View>
  );
}

function Note({
  label,
  value,
}) {
  return (
    <View style={styles.note}>
      <Text style={styles.noteLabel}>
        {label}
      </Text>

      <Text
        style={styles.noteValue}
        selectable
      >
        {clean(value) || "—"}
      </Text>
    </View>
  );
}

const styles = {
  overlay: {
    flex: 1,
    backgroundColor:
      "rgba(2,6,23,.82)",
    justifyContent:
      "flex-end",
  },

  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },

  modal: {
    maxHeight:
      "94%",
    backgroundColor:
      "#07111f",
    borderTopLeftRadius:
      24,
    borderTopRightRadius:
      24,
    borderWidth: 1,
    borderColor:
      "rgba(148,163,184,.18)",
    padding: 16,
  },

  header: {
    flexDirection:
      "row",
    alignItems:
      "flex-start",
    gap: 10,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor:
      "rgba(148,163,184,.12)",
  },

  kicker: {
    color:
      "#60a5fa",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2,
  },

  title: {
    color:
      "#fff",
    fontSize: 20,
    fontWeight: "900",
    marginTop: 4,
  },

  subtitle: {
    color:
      "#94a3b8",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 4,
  },

  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems:
      "center",
    justifyContent:
      "center",
    backgroundColor:
      "rgba(148,163,184,.12)",
    borderWidth: 1,
    borderColor:
      "rgba(148,163,184,.18)",
  },

  closeText: {
    color: "#fff",
    fontSize: 23,
    fontWeight: "800",
    lineHeight: 25,
  },

  statusRow: {
    flexDirection:
      "row",
    alignItems:
      "center",
    justifyContent:
      "space-between",
    gap: 10,
    marginTop: 14,
  },

  statusPill: {
    minHeight: 30,
    maxWidth: "76%",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 11,
    justifyContent:
      "center",
  },

  statusPillCompact: {
    minHeight: 24,
    paddingHorizontal: 8,
    maxWidth: "100%",
  },

  statusPillText: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: .2,
  },

  statusPillTextCompact: {
    fontSize: 9,
  },

  evidenceCount: {
    color: "#cbd5e1",
    fontSize: 11,
    fontWeight: "900",
  },

  loadingBox: {
    marginTop: 12,
    borderRadius: 14,
    padding: 12,
    backgroundColor:
      "rgba(59,130,246,.08)",
    borderWidth: 1,
    borderColor:
      "rgba(59,130,246,.18)",
    flexDirection:
      "row",
    alignItems:
      "center",
    gap: 10,
  },

  loadingText: {
    flex: 1,
    color: "#bfdbfe",
    fontSize: 11,
    fontWeight: "800",
    lineHeight: 16,
  },

  errorBox: {
    marginTop: 12,
    borderRadius: 14,
    padding: 12,
    backgroundColor:
      "rgba(239,68,68,.08)",
    borderWidth: 1,
    borderColor:
      "rgba(239,68,68,.20)",
  },

  errorText: {
    color: "#fca5a5",
    fontSize: 11,
    fontWeight: "800",
    lineHeight: 17,
  },

  section: {
    marginTop: 14,
    padding: 13,
    borderRadius: 16,
    backgroundColor:
      "#0f172a",
    borderWidth: 1,
    borderColor:
      "rgba(255,255,255,.08)",
  },

  sectionTitle: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "900",
    marginBottom: 9,
  },

  grid: {
    flexDirection:
      "row",
    flexWrap:
      "wrap",
    marginHorizontal: -4,
  },

  detail: {
    width: "50%",
    padding: 4,
  },

  detailWide: {
    width: "100%",
  },

  detailLabel: {
    color: "#64748b",
    fontSize: 9,
    fontWeight: "900",
    textTransform:
      "uppercase",
    letterSpacing: .45,
  },

  detailValue: {
    color: "#e2e8f0",
    fontSize: 11,
    fontWeight: "800",
    lineHeight: 16,
    marginTop: 3,
  },

  note: {
    marginTop: 8,
    borderRadius: 12,
    padding: 10,
    backgroundColor:
      "rgba(148,163,184,.07)",
    borderWidth: 1,
    borderColor:
      "rgba(148,163,184,.12)",
  },

  noteLabel: {
    color: "#94a3b8",
    fontSize: 9,
    fontWeight: "900",
    textTransform:
      "uppercase",
  },

  noteValue: {
    color: "#e2e8f0",
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 17,
    marginTop: 4,
  },

  noEvidence: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 17,
  },

  photoGrid: {
    flexDirection:
      "row",
    flexWrap:
      "wrap",
    gap: 8,
  },

  photoWrap: {
    width: "48.5%",
    aspectRatio: 1.15,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor:
      "#020617",
    borderWidth: 1,
    borderColor:
      "rgba(96,165,250,.22)",
    position:
      "relative",
  },

  photo: {
    width: "100%",
    height: "100%",
  },

  photoLabel: {
    position:
      "absolute",
    left: 6,
    bottom: 6,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor:
      "rgba(2,6,23,.78)",
  },

  photoLabelText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "900",
  },

  doneBtn: {
    minHeight: 46,
    marginTop: 12,
    borderRadius: 14,
    alignItems:
      "center",
    justifyContent:
      "center",
    backgroundColor:
      "#2563eb",
  },

  doneText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 12,
  },

  imageOverlay: {
    flex: 1,
    backgroundColor:
      "rgba(0,0,0,.96)",
    alignItems:
      "center",
    justifyContent:
      "center",
  },

  imageBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },

  fullImage: {
    width: "94%",
    height: "86%",
  },

  imageClose: {
    position: "absolute",
    top: 46,
    right: 18,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor:
      "rgba(15,23,42,.88)",
    borderWidth: 1,
    borderColor:
      "rgba(255,255,255,.18)",
    alignItems:
      "center",
    justifyContent:
      "center",
  },

  imageCloseText: {
    color: "#fff",
    fontSize: 27,
    fontWeight: "700",
    lineHeight: 29,
  },
};
