import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";

import MapView, {
  Marker,
  PROVIDER_GOOGLE,
} from "react-native-maps";

import {
  fetchTrips,
} from "../api/logisticsApi";

import {
  safeOpenCoordinatesInMaps,
} from "../api/locationApi";

function normalizeStatus(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function hasCoords(trip) {
  return (
    Number.isFinite(Number(trip?.currentLatitude)) &&
    Number.isFinite(Number(trip?.currentLongitude))
  );
}

function getRegion(trip) {
  const latitude =
    Number(trip.currentLatitude);

  const longitude =
    Number(trip.currentLongitude);

  return {
    latitude,
    longitude,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  };
}

function formatLastUpdated(value) {
  if (!value) return "Not updated yet";

  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
}

export default function LiveTripMapScreen({
  route,
  navigation,
}) {
  const initialTrip =
    route?.params?.trip || null;

  const tripId =
    initialTrip?.id ||
    route?.params?.tripId;

  const [trip, setTrip] =
    useState(initialTrip);

  const [loading, setLoading] =
    useState(false);

  const mapRef =
    useRef(null);

  const region =
    useMemo(() => {
      if (!hasCoords(trip)) return null;

      return getRegion(trip);
    }, [trip]);

  const loadTrip = async (
    silent = false
  ) => {
    if (!tripId) return;

    try {
      if (!silent) {
        setLoading(true);
      }

      const trips =
        await fetchTrips();

      const found =
        Array.isArray(trips)
          ? trips.find(
              (x) =>
                String(x.id) === String(tripId)
            )
          : null;

      if (found) {
        setTrip(found);

        if (hasCoords(found) && mapRef.current) {
          mapRef.current.animateToRegion(
            getRegion(found),
            700
          );
        }
      }
    } catch (e) {
      if (!silent) {
        Alert.alert(
          "Location failed",
          e?.response?.data?.message ||
            e?.response?.data ||
            e?.message ||
            "Unable to load live location"
        );
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTrip(false);

    const timer =
      setInterval(() => {
        loadTrip(true);
      }, 5000);

    return () => {
      clearInterval(timer);
    };
  }, [tripId]);

  const driverName =
    trip?.driver?.name ||
    trip?.driverName ||
    "—";

  const vehicleNo =
    trip?.vehicle?.vehicleNumber ||
    trip?.vehicleNumber ||
    "—";

  const status =
    normalizeStatus(trip?.status);

  const canOpenExternal =
    hasCoords(trip);

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.title}>
          Live Location
        </Text>

        <Text style={styles.sub}>
          {trip?.challanNumber || "—"} •{" "}
          {driverName} • {vehicleNo}
        </Text>

        <View style={styles.statusRow}>
          <Text style={styles.statusText}>
            {status || "—"}
          </Text>

          <Text style={styles.lastUpdated}>
            Last update:{" "}
            {formatLastUpdated(
              trip?.currentLocationAt
            )}
          </Text>
        </View>
      </View>

      <View style={styles.mapCard}>
        {loading && !region ? (
          <View style={styles.center}>
            <ActivityIndicator />

            <Text style={styles.waitText}>
              Loading live location...
            </Text>
          </View>
        ) : region ? (
          <MapView
            ref={mapRef}
            provider={PROVIDER_GOOGLE}
            style={styles.map}
            initialRegion={region}
            showsUserLocation={false}
            showsMyLocationButton={false}
          >
            <Marker
              coordinate={{
                latitude:
                  region.latitude,
                longitude:
                  region.longitude,
              }}
              title={
                driverName ||
                "Driver Location"
              }
              description={
                trip?.challanNumber ||
                "Live trip location"
              }
            />
          </MapView>
        ) : (
          <View style={styles.center}>
            <Text style={styles.noLocationTitle}>
              No live location yet
            </Text>

            <Text style={styles.noLocationText}>
              Location will appear here once the driver starts tracking.
            </Text>
          </View>
        )}
      </View>

      <View style={styles.bottomPanel}>
        <View style={styles.coordinateBox}>
          <Text style={styles.coordLabel}>
            Latitude
          </Text>

          <Text style={styles.coordValue}>
            {trip?.currentLatitude || "—"}
          </Text>
        </View>

        <View style={styles.coordinateBox}>
          <Text style={styles.coordLabel}>
            Longitude
          </Text>

          <Text style={styles.coordValue}>
            {trip?.currentLongitude || "—"}
          </Text>
        </View>

        <View style={styles.coordinateBox}>
          <Text style={styles.coordLabel}>
            Accuracy
          </Text>

          <Text style={styles.coordValue}>
            {trip?.currentLocationAccuracy
              ? `${Math.round(
                  Number(
                    trip.currentLocationAccuracy
                  )
                )} m`
              : "—"}
          </Text>
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() =>
            navigation.goBack()
          }
        >
          <Text style={styles.secondaryText}>
            Back
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.primaryBtn,
            !canOpenExternal
              ? styles.disabledBtn
              : null,
          ]}
          disabled={!canOpenExternal}
          onPress={() =>
            safeOpenCoordinatesInMaps(
              trip.currentLatitude,
              trip.currentLongitude,
              trip.challanNumber ||
                "Live Trip Location"
            )
          }
        >
          <Text style={styles.primaryText}>
            Open in Google Maps
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = {
  page: {
    flex: 1,
    backgroundColor: "#020617",
    padding: 16,
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
    marginTop: 5,
    fontWeight: "700",
  },

  statusRow: {
    marginTop: 10,
    gap: 5,
  },

  statusText: {
    color: "#93c5fd",
    fontWeight: "900",
    fontSize: 12,
  },

  lastUpdated: {
    color: "#cbd5e1",
    fontWeight: "700",
    fontSize: 12,
  },

  mapCard: {
    flex: 1,
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.08)",
  },

  map: {
    width: "100%",
    height: "100%",
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 22,
  },

  waitText: {
    color: "#94a3b8",
    marginTop: 12,
    fontWeight: "700",
  },

  noLocationTitle: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 18,
    marginBottom: 8,
  },

  noLocationText: {
    color: "#94a3b8",
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 20,
  },

  bottomPanel: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },

  coordinateBox: {
    flex: 1,
    backgroundColor: "#0f172a",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.08)",
  },

  coordLabel: {
    color: "#64748b",
    fontSize: 10,
    fontWeight: "900",
  },

  coordValue: {
    color: "#e5e7eb",
    fontWeight: "800",
    marginTop: 4,
    fontSize: 11,
  },

  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },

  secondaryBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(96,165,250,.25)",
    backgroundColor: "rgba(59,130,246,.10)",
    alignItems: "center",
    justifyContent: "center",
  },

  secondaryText: {
    color: "#93c5fd",
    fontWeight: "900",
  },

  primaryBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
  },

  disabledBtn: {
    opacity: 0.5,
  },

  primaryText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 12,
  },
};