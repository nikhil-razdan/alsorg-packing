import React, {
  useCallback,
  useState,
} from "react";

import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native";

import {
  useFocusEffect,
} from "@react-navigation/native";

import {
  safeOpenChallanPdf,
} from "../api/challanDownloadApi";

import {
  hasValidCoordinates,
  safeOpenCoordinatesInMaps,
} from "../api/locationApi";

import {
  useAuth,
} from "../auth/AuthContext";

import {
  fetchTrips,
  startTrip,
} from "../api/logisticsApi";

import {
  startLiveLocationForTrip,
} from "../api/liveLocationTracker";

const normalizeStatus = (value) =>
  String(value || "")
    .trim()
    .toUpperCase();

function getBackendNowDateTime() {
  const d = new Date();

  d.setMinutes(
    d.getMinutes() - d.getTimezoneOffset()
  );

  return d.toISOString().slice(0, 19);
}

export default function TripsScreen({
  navigation,
}) {
  const {
    role,
  } = useAuth();

  const normalizedRole =
    normalizeStatus(role);

  const isDriver =
    normalizedRole === "DRIVER";

  const [loading, setLoading] =
    useState(false);

  const [refreshing, setRefreshing] =
    useState(false);

  const [trips, setTrips] =
    useState([]);

  const loadTrips = async () => {
    try {
      setLoading(true);

      const data =
        await fetchTrips();

      setTrips(
        Array.isArray(data)
          ? data
          : []
      );
    } catch (e) {
      console.error(e);

      Alert.alert(
        "Trips failed",
        e?.response?.data?.message ||
        e?.response?.data ||
        e?.message ||
        "Failed to load trips"
      );
    } finally {
      setLoading(false);
    }
  };

  const refresh = async () => {
    try {
      setRefreshing(true);

      const data =
        await fetchTrips();

      setTrips(
        Array.isArray(data)
          ? data
          : []
      );
    } catch (e) {
      Alert.alert(
        "Refresh failed",
        e?.response?.data?.message ||
        e?.response?.data ||
        e?.message ||
        "Failed to refresh trips"
      );
    } finally {
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadTrips();
    }, [])
  );

  const queuedTrips =
    trips.filter(
      (t) =>
        normalizeStatus(t.status) ===
        "QUEUED"
    );

  const activeTrips =
    trips.filter(
      (t) =>
        normalizeStatus(t.status) ===
        "OUT_FOR_DELIVERY"
    );

  const deliveredTrips =
    trips.filter(
      (t) =>
        normalizeStatus(t.status) ===
        "DELIVERED"
    );

  const rows = [
    {
      type: "section",
      id: "queued-section",
      title: "Queued Trips",
    },
    ...queuedTrips.map((x) => ({
      type: "trip",
      tripType: "queued",
      ...x,
    })),

    {
      type: "section",
      id: "active-section",
      title: "Active Trips",
    },
    ...activeTrips.map((x) => ({
      type: "trip",
      tripType: "active",
      ...x,
    })),

    {
      type: "section",
      id: "delivered-section",
      title: "Delivered Trips",
    },
    ...deliveredTrips.map((x) => ({
      type: "trip",
      tripType: "delivered",
      ...x,
    })),
  ];

  if (loading && trips.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />

        <Text style={styles.loadingText}>
          Loading trips...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.title}>
          Trips / Delivery
        </Text>

        <Text style={styles.sub}>
          Queued, active and completed dispatch trips
        </Text>
      </View>

      <FlatList
        data={rows}
        keyExtractor={(item, index) =>
          item.id ||
          `${item.type}-${item.challanNumber}-${index}`
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
        renderItem={({ item }) => {
          if (item.type === "section") {
            return (
              <Text style={styles.sectionTitle}>
                {item.title}
              </Text>
            );
          }

          return (
            <TripCard
              trip={item}
              navigation={navigation}
              isDriver={isDriver}
              refresh={refresh}
            />
          );
        }}
        ListEmptyComponent={
          <Text style={styles.empty}>
            No trips found
          </Text>
        }
      />
    </View>
  );
}

function TripCard({
  trip,
  navigation,
  isDriver,
  refresh,
}) {
  const status =
    normalizeStatus(trip.status);

  const isQueued =
    status === "QUEUED";

  const isActive =
    status === "OUT_FOR_DELIVERY";

  const isDelivered =
    status === "DELIVERED";

  const hasLiveLocation =
    hasValidCoordinates(
      trip.currentLatitude,
      trip.currentLongitude
    );

  const hasDeliveryLocation =
    hasValidCoordinates(
      trip.deliveryLatitude,
      trip.deliveryLongitude
    );

  const driverName =
    trip.driver?.name ||
    trip.driverName ||
    "—";

  const vehicleNo =
    trip.vehicle?.vehicleNumber ||
    trip.vehicleNumber ||
    "—";

  const statusLabel =
    isQueued
      ? "QUEUED"
      : isActive
        ? "OUT FOR DELIVERY"
        : "DELIVERED";

  const handleStartTrip = async () => {
    try {
      await startTrip(
        trip.id,
        {
          tripStart:
            getBackendNowDateTime(),
        }
      );

      await startLiveLocationForTrip(
        trip.id
      );

      Alert.alert(
        "Trip Started",
        "Live location tracking has started."
      );

      await refresh();
    } catch (e) {
      Alert.alert(
        "Start failed",
        e?.response?.data?.message ||
        e?.response?.data ||
        e?.message ||
        "Unable to start trip"
      );
    }
  };

  const handleRestartLiveTracking = async () => {
    try {
      await startLiveLocationForTrip(
        trip.id
      );

      Alert.alert(
        "Live Tracking",
        "Live location tracking is running for this trip."
      );

      await refresh();
    } catch (e) {
      Alert.alert(
        "Tracking failed",
        e?.response?.data?.message ||
        e?.response?.data ||
        e?.message ||
        "Unable to start live tracking"
      );
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.challan}>
            {trip.challanNumber || "—"}
          </Text>

          <Text style={styles.meta}>
            {driverName} • {vehicleNo}
          </Text>
        </View>

        <View
          style={[
            styles.statusBadge,
            isQueued
              ? styles.queuedBadge
              : isActive
                ? styles.activeBadge
                : styles.doneBadge,
          ]}
        >
          <Text
            style={[
              styles.statusText,
              isQueued
                ? styles.queuedText
                : isActive
                  ? styles.activeText
                  : styles.doneText,
            ]}
          >
            {statusLabel}
          </Text>
        </View>
      </View>

      <View style={styles.infoGrid}>
        <Info
          label="Start"
          value={
            trip.tripStart
              ? new Date(
                trip.tripStart
              ).toLocaleString()
              : "—"
          }
        />

        <Info
          label="End"
          value={
            trip.tripEnd
              ? new Date(
                trip.tripEnd
              ).toLocaleString()
              : "—"
          }
        />

        <Info
          label="Items"
          value={String(
            trip.totalItems || 0
          )}
        />

        <Info
          label="Source"
          value={trip.source || "—"}
        />
      </View>

      {isDelivered &&
        (trip.receiverName || trip.podUrl) && (
          <View style={styles.podBox}>
            <Text style={styles.podText}>
              Receiver:{" "}
              {trip.receiverName || "—"}
            </Text>

            <Text style={styles.podText}>
              POD:{" "}
              {trip.podUrl
                ? "Attached"
                : "—"}
            </Text>
          </View>
        )}

      <TouchableOpacity
        style={styles.challanBtn}
        onPress={() =>
          safeOpenChallanPdf(
            trip.id,
            trip.challanNumber
          )
        }
      >
        <Text style={styles.challanText}>
          Open Challan
        </Text>
      </TouchableOpacity>

      <View style={styles.actions}>
        {isQueued && isDriver ? (
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={handleStartTrip}
          >
            <Text style={styles.primaryText}>
              Start Trip
            </Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() =>
            navigation.navigate(
              "TripItems",
              {
                trip,
              }
            )
          }
        >
          <Text style={styles.secondaryText}>
            View Items
          </Text>
        </TouchableOpacity>

        {/* ACTIVE TRIP LIVE MAP - for ADMIN / DISPATCH / LOGISTICS / DRIVER */}
        {isActive ? (
          <TouchableOpacity
            style={styles.locationBtn}
            onPress={() =>
              navigation.navigate(
                "LiveTripMap",
                {
                  trip,
                  tripId: trip.id,
                }
              )
            }
          >
            <Text style={styles.locationText}>
              {hasLiveLocation
                ? "Live Map"
                : "Waiting GPS"}
            </Text>
          </TouchableOpacity>
        ) : null}

        {/* DRIVER ONLY - restart/resume background live tracking */}
        {isActive && isDriver ? (
          <TouchableOpacity
            style={styles.locationBtn}
            onPress={handleRestartLiveTracking}
          >
            <Text style={styles.locationText}>
              Track Live
            </Text>
          </TouchableOpacity>
        ) : null}

        {/* DELIVERED TRIP FINAL GPS LOCATION */}
        {isDelivered && hasDeliveryLocation ? (
          <TouchableOpacity
            style={styles.locationBtn}
            onPress={() =>
              safeOpenCoordinatesInMaps(
                trip.deliveryLatitude,
                trip.deliveryLongitude,
                trip.challanNumber ||
                "Delivery Location"
              )
            }
          >
            <Text style={styles.locationText}>
              Open Location
            </Text>
          </TouchableOpacity>
        ) : null}

        {isActive && isDriver ? (
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() =>
              navigation.push(
                "EndTrip",
                {
                  trip,
                }
              )
            }
          >
            <Text style={styles.primaryText}>
              End Trip
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
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
  },

  loadingText: {
    color: "#94a3b8",
    marginTop: 12,
    fontWeight: "700",
  },

  header: {
    marginBottom: 12,
  },

  title: {
    color: "#fff",
    fontSize: 26,
    fontWeight: "900",
  },

  sub: {
    color: "#94a3b8",
    marginTop: 4,
    fontWeight: "700",
  },

  sectionTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 18,
    marginBottom: 10,
  },

  empty: {
    color: "#94a3b8",
    textAlign: "center",
    marginTop: 40,
    fontWeight: "700",
  },

  card: {
    backgroundColor: "#0f172a",
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.08)",
  },

  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 14,
  },

  challan: {
    color: "#fff",
    fontSize: 17,
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

  queuedBadge: {
    backgroundColor: "rgba(251,191,36,.14)",
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

  queuedText: {
    color: "#facc15",
  },

  activeText: {
    color: "#93c5fd",
  },

  doneText: {
    color: "#6ee7b7",
  },

  infoGrid: {
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

  podBox: {
    marginTop: 10,
    padding: 10,
    borderRadius: 12,
    backgroundColor: "rgba(16,185,129,.08)",
    borderWidth: 1,
    borderColor: "rgba(16,185,129,.15)",
  },

  podText: {
    color: "#cbd5e1",
    fontSize: 12,
    fontWeight: "700",
  },

  challanBtn: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(251,191,36,.28)",
    backgroundColor: "rgba(251,191,36,.12)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
  },

  challanText: {
    color: "#facc15",
    fontWeight: "900",
  },

  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 14,
  },

  secondaryBtn: {
    flex: 1,
    minWidth: "30%",
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(96,165,250,.25)",
    backgroundColor: "rgba(59,130,246,.10)",
    alignItems: "center",
    justifyContent: "center",
  },

  secondaryText: {
    color: "#93c5fd",
    fontWeight: "900",
    fontSize: 12,
  },

  primaryBtn: {
    flex: 1,
    minWidth: "30%",
    height: 44,
    borderRadius: 12,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
  },

  primaryText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 12,
  },

  locationBtn: {
    flex: 1,
    minWidth: "30%",
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(16,185,129,.28)",
    backgroundColor: "rgba(16,185,129,.12)",
    alignItems: "center",
    justifyContent: "center",
  },

  locationText: {
    color: "#6ee7b7",
    fontWeight: "900",
    fontSize: 12,
  },
};