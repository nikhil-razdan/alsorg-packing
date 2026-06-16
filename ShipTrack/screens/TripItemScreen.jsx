import React, {
    useCallback,
    useState,
} from "react";

import {
    View,
    Text,
    FlatList,
    ActivityIndicator,
    Alert,
    TouchableOpacity,
    RefreshControl,
} from "react-native";

import {
    safeOpenChallanPdf,
} from "../api/challanDownloadApi";

import {
    useFocusEffect,
} from "@react-navigation/native";

import {
    hasValidCoordinates,
    safeOpenCoordinatesInMaps,
} from "../api/locationApi";

import {
    safeDownloadPodImage,
    safeOpenPodImage,
} from "../api/podDownloadApi";

import {
    fetchTripItems,
} from "../api/logisticsApi";

const normalizeStatus = (value) =>
    String(value || "")
        .trim()
        .toUpperCase();

export default function TripItemScreen({
    route,
    navigation,
}) {
    const trip =
        route?.params?.trip || null;

    const [loading, setLoading] =
        useState(false);

    const [refreshing, setRefreshing] =
        useState(false);

    const [items, setItems] =
        useState([]);

    const loadItems = async () => {
        if (!trip?.id) {
            Alert.alert(
                "Trip missing",
                "Trip id not found"
            );

            return;
        }

        try {
            setLoading(true);

            const data =
                await fetchTripItems(trip.id);

            setItems(
                Array.isArray(data)
                    ? data
                    : []
            );
        } catch (e) {
            console.error(e);

            Alert.alert(
                "Items failed",
                e?.message ||
                "Failed to load trip items"
            );
        } finally {
            setLoading(false);
        }
    };

    const refresh = async () => {
        if (!trip?.id) return;

        try {
            setRefreshing(true);

            const data =
                await fetchTripItems(trip.id);

            setItems(
                Array.isArray(data)
                    ? data
                    : []
            );
        } catch (e) {
            Alert.alert(
                "Refresh failed",
                e?.message ||
                "Failed to refresh items"
            );
        } finally {
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadItems();
        }, [trip?.id])
    );

    const status =
        normalizeStatus(trip?.status);

    const isActive =
        status === "OUT_FOR_DELIVERY";

    const driverName =
        trip?.driver?.name ||
        trip?.driverName ||
        "—";

    const vehicleNo =
        trip?.vehicle?.vehicleNumber ||
        trip?.vehicleNumber ||
        "—";

    if (loading && items.length === 0) {
        return (
            <View style={styles.center}>
                <ActivityIndicator />

                <Text style={styles.loadingText}>
                    Loading trip items...
                </Text>
            </View>
        );
    }

    return (
        <View style={styles.page}>
            <View style={styles.tripCard}>
                <View style={styles.tripHeader}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.challan}>
                            {trip?.challanNumber || "—"}
                        </Text>

                        <Text style={styles.meta}>
                            {driverName} • {vehicleNo}
                        </Text>
                    </View>

                    <View
                        style={[
                            styles.statusBadge,
                            isActive
                                ? styles.activeBadge
                                : styles.doneBadge,
                        ]}
                    >
                        <Text
                            style={[
                                styles.statusText,
                                isActive
                                    ? styles.activeText
                                    : styles.doneText,
                            ]}
                        >
                            {isActive
                                ? "OUT FOR DELIVERY"
                                : "DELIVERED"}
                        </Text>
                    </View>
                </View>

                <View style={styles.summaryRow}>
                    <Info
                        label="Items"
                        value={String(
                            trip?.totalItems || items.length || 0
                        )}
                    />

                    <Info
                        label="Start"
                        value={
                            trip?.tripStart
                                ? new Date(
                                    trip.tripStart
                                ).toLocaleString()
                                : "—"
                        }
                    />

                    <Info
                        label="End"
                        value={
                            trip?.tripEnd
                                ? new Date(
                                    trip.tripEnd
                                ).toLocaleString()
                                : "—"
                        }
                    />

                </View>
                <TouchableOpacity
                    style={styles.openLocationBtn}
                    onPress={() =>
                        safeOpenChallanPdf(
                            trip?.id,
                            trip?.challanNumber
                        )
                    }
                >
                    <Text style={styles.openLocationText}>
                        Open Challan
                    </Text>
                </TouchableOpacity>
                {status === "DELIVERED" && (
                    <View style={styles.podBox}>
                        <Text style={styles.podTitle}>
                            POD / Delivery Details
                        </Text>

                        <Text style={styles.podText}>
                            Receiver:{" "}
                            {trip?.receiverName || "—"}
                        </Text>

                        <Text style={styles.podText}>
                            Phone:{" "}
                            {trip?.receiverPhone || "—"}
                        </Text>

                        <Text style={styles.podText}>
                            POD:{" "}
                            {trip?.podUrl
                                ? "Attached"
                                : "—"}
                        </Text>

                        <Text style={styles.podText}>
                            Location:{" "}
                            {hasValidCoordinates(
                                trip?.deliveryLatitude,
                                trip?.deliveryLongitude
                            )
                                ? `${trip.deliveryLatitude}, ${trip.deliveryLongitude}`
                                : "—"}
                        </Text>

                        {hasValidCoordinates(
                            trip?.deliveryLatitude,
                            trip?.deliveryLongitude
                        ) ? (
                            <TouchableOpacity
                                style={styles.openLocationBtn}
                                onPress={() =>
                                    safeOpenCoordinatesInMaps(
                                        trip.deliveryLatitude,
                                        trip.deliveryLongitude,
                                        trip.challanNumber || "Delivery Location"
                                    )
                                }
                            >
                                <Text style={styles.openLocationText}>
                                    Open Delivery Location
                                </Text>
                            </TouchableOpacity>
                        ) : null}

                        <Text style={styles.podText}>
                            Remarks:{" "}
                            {trip?.deliveryRemarks || "—"}
                        </Text>
                        {trip?.podUrl ? (
                            <View style={styles.podActions}>
                                <TouchableOpacity
                                    style={styles.podOpenBtn}
                                    onPress={() =>
                                        safeOpenPodImage(trip.podUrl)
                                    }
                                >
                                    <Text style={styles.podOpenText}>
                                        Open in Gallery
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.podDownloadBtn}
                                    onPress={() =>
                                        safeDownloadPodImage(trip.podUrl)
                                    }
                                >
                                    <Text style={styles.podDownloadText}>
                                        Download POD
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        ) : null}
                    </View>
                )}

                {isActive && (
                    <TouchableOpacity
                        style={styles.endBtn}
                        onPress={() =>
                            navigation.push(
                                "EndTrip",
                                {
                                    trip,
                                }
                            )
                        }
                    >
                        <Text style={styles.endBtnText}>
                            End Trip
                        </Text>
                    </TouchableOpacity>
                )}
            </View>

            <Text style={styles.sectionTitle}>
                Trip Items
            </Text>

            <FlatList
                data={items}
                keyExtractor={(item, index) =>
                    item.id ||
                    item.zohoItemId ||
                    String(index)
                }
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={refresh}
                        tintColor="#fff"
                    />
                }
                contentContainerStyle={{
                    paddingBottom: 28,
                }}
                ListEmptyComponent={
                    <View style={styles.emptyBox}>
                        <Text style={styles.emptyText}>
                            No items found for this trip.
                        </Text>
                    </View>
                }
                renderItem={({ item, index }) => (
                    <ItemCard
                        item={item}
                        index={index}
                    />
                )}
            />
        </View>
    );
}

function ItemCard({
    item,
    index,
}) {
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
                        {item.itemName || "Unnamed Item"}
                    </Text>

                    <Text
                        style={styles.itemSub}
                        numberOfLines={1}
                    >
                        {item.sku || "No SKU"}
                    </Text>
                </View>
            </View>

            <View style={styles.detailGrid}>
                <Detail
                    label="PD No"
                    value={item.pdNo || "—"}
                />

                <Detail
                    label="DWG No"
                    value={item.drawingNo || "—"}
                />

                <Detail
                    label="Client"
                    value={item.clientName || "—"}
                />

                <Detail
                    label="Packet Item ID"
                    value={item.packetItemId || "—"}
                />
            </View>

            <View style={styles.longBox}>
                <Text style={styles.longLabel}>
                    Description
                </Text>

                <Text style={styles.longValue}>
                    {item.description || "—"}
                </Text>
            </View>

            {item.remarks ? (
                <View style={styles.longBox}>
                    <Text style={styles.longLabel}>
                        Remarks
                    </Text>

                    <Text style={styles.longValue}>
                        {item.remarks}
                    </Text>
                </View>
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

function Detail({
    label,
    value,
}) {
    return (
        <View style={styles.detail}>
            <Text style={styles.detailLabel}>
                {label}
            </Text>

            <Text
                style={styles.detailValue}
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

    tripCard: {
        backgroundColor: "#0f172a",
        borderRadius: 20,
        padding: 16,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,.08)",
        marginBottom: 16,
    },

    tripHeader: {
        flexDirection: "row",
        alignItems: "flex-start",
        marginBottom: 14,
    },

    challan: {
        color: "#fff",
        fontSize: 18,
        fontWeight: "900",
    },

    meta: {
        color: "#94a3b8",
        marginTop: 5,
        fontWeight: "700",
    },

    statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
    },

    activeBadge: {
        backgroundColor: "rgba(59,130,246,.14)",
    },

    doneBadge: {
        backgroundColor: "rgba(16,185,129,.14)",
    },

    statusText: {
        fontSize: 10,
        fontWeight: "900",
    },

    activeText: {
        color: "#93c5fd",
    },

    doneText: {
        color: "#6ee7b7",
    },

    summaryRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        marginHorizontal: -4,
    },

    info: {
        width: "33.33%",
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

    podBox: {
        marginTop: 12,
        padding: 12,
        borderRadius: 14,
        backgroundColor: "rgba(16,185,129,.08)",
        borderWidth: 1,
        borderColor: "rgba(16,185,129,.15)",
    },

    podTitle: {
        color: "#6ee7b7",
        fontWeight: "900",
        marginBottom: 6,
    },

    podText: {
        color: "#cbd5e1",
        fontSize: 12,
        fontWeight: "700",
        marginBottom: 3,
    },

    endBtn: {
        height: 44,
        borderRadius: 12,
        backgroundColor: "#2563eb",
        alignItems: "center",
        justifyContent: "center",
        marginTop: 14,
    },

    endBtnText: {
        color: "#fff",
        fontWeight: "900",
    },

    sectionTitle: {
        color: "#fff",
        fontSize: 20,
        fontWeight: "900",
        marginBottom: 12,
    },

    emptyBox: {
        padding: 24,
        borderRadius: 16,
        backgroundColor: "#0f172a",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,.08)",
        alignItems: "center",
    },

    emptyText: {
        color: "#94a3b8",
        fontWeight: "700",
        textAlign: "center",
    },

    itemCard: {
        backgroundColor: "#0f172a",
        borderRadius: 18,
        padding: 16,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,.08)",
    },

    itemTop: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 14,
    },

    itemNo: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: "rgba(59,130,246,.16)",
        alignItems: "center",
        justifyContent: "center",
        marginRight: 12,
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
        fontSize: 12,
        fontWeight: "700",
        marginTop: 4,
    },

    detailGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        marginHorizontal: -4,
    },

    detail: {
        width: "50%",
        padding: 4,
    },

    detailLabel: {
        color: "#64748b",
        fontSize: 11,
        fontWeight: "900",
    },

    detailValue: {
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
    podActions: {
        flexDirection: "row",
        gap: 10,
        marginTop: 10,
    },

    podOpenBtn: {
        flex: 1,
        minHeight: 42,
        borderRadius: 12,
        backgroundColor: "rgba(59,130,246,.12)",
        borderWidth: 1,
        borderColor: "rgba(59,130,246,.25)",
        alignItems: "center",
        justifyContent: "center",
    },

    podOpenText: {
        color: "#93c5fd",
        fontWeight: "900",
        fontSize: 12,
    },

    podDownloadBtn: {
        flex: 1,
        minHeight: 42,
        borderRadius: 12,
        backgroundColor: "rgba(16,185,129,.14)",
        borderWidth: 1,
        borderColor: "rgba(16,185,129,.28)",
        alignItems: "center",
        justifyContent: "center",
    },

    podDownloadText: {
        color: "#6ee7b7",
        fontWeight: "900",
        fontSize: 12,
    },

    openLocationBtn: {
        minHeight: 42,
        borderRadius: 12,
        backgroundColor: "rgba(16,185,129,.14)",
        borderWidth: 1,
        borderColor: "rgba(16,185,129,.28)",
        alignItems: "center",
        justifyContent: "center",
        marginTop: 10,
    },

    openLocationText: {
        color: "#6ee7b7",
        fontWeight: "900",
        fontSize: 12,
    },
};