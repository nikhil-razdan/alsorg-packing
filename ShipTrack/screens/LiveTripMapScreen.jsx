import React, {
  useEffect,
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

import MapLibreGL from "@maplibre/maplibre-react-native";

import {
  fetchTrips,
} from "../api/logisticsApi";

import {
  safeOpenCoordinatesInMaps,
} from "../api/locationApi";

MapLibreGL.setAccessToken(null);

const normalizeStatus = (value) =>
  String(value || "").trim().toUpperCase();

export default function LiveTripMapScreen({
  route,
  navigation,
}) {
  const initialTrip =
    route?.params?.trip || null;

  const [trip, setTrip] =
    useState(initialTrip);

  const [loading, setLoading] =
    useState(false);

  const intervalRef =
    useRef(null);

  const lat =
    Number(trip?.currentLatitude);

  const lng =
    Number(trip?.currentLongitude);

  const hasLocation =
    Number.isFinite(lat) &&
    Number.isFinite(lng);

  const isActive =
    normalizeStatus(trip?.status) ===
    "OUT_FOR_DELIVERY";

  const loadFreshTrip = async () => {
    if (!initialTrip?.id) return;

    try {
      setLoading(true);

      const trips =
        await fetchTrips();

      const fresh =
        Array.isArray(trips)
          ? trips.find(
              (x) =>
                String(x.id) ===
                String(initialTrip.id)
            )
          : null;

      if (fresh) {
        setTrip(fresh);
      }
    } catch (e) {
      console.log(
        "Live map refresh failed",
        e?.message
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFreshTrip();

    intervalRef.current =
      setInterval(
        loadFreshTrip,
        5000
      );

    return () => {
      if (intervalRef.current) {
        clearInterval(
          intervalRef.current
        );
      }
    };
  }, []);

  if (!initialTrip) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>
          Trip missing
        </Text>
      </View>
    );
  }

  if (!hasLocation) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>
          Live Location
        </Text>

        <Text style={styles.sub}>
          Waiting for driver location...
        </Text>

        <TouchableOpacity
          style={styles.retryBtn}
          onPress={loadFreshTrip}
        >
          <Text style={styles.retryText}>
            Refresh
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const lastUpdated =
    trip?.currentLocationAt
      ? new Date(
          trip.currentLocationAt
        ).toLocaleTimeString()
      : "—";

  return (
    <View style={styles.page}>
      <MapLibreGL.MapView
        style={styles.map}
        styleURL="https://demotiles.maplibre.org/style.json"
        logoEnabled={false}
        attributionEnabled={false}
      >
        <MapLibreGL.Camera
          zoomLevel={15}
          centerCoordinate={[
            lng,
            lat,
          ]}
          animationMode="flyTo"
          animationDuration={900}
        />

        <MapLibreGL.PointAnnotation
          id="driver-location"
          coordinate={[
            lng,
            lat,
          ]}
        >
          <View style={styles.markerOuter}>
            <View style={styles.markerInner}>
              <Text style={styles.markerText}>
                🚚
              </Text>
            </View>
          </View>
        </MapLibreGL.PointAnnotation>
      </MapLibreGL.MapView>

      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() =>
            navigation.goBack()
          }
        >
          <Text style={styles.back}>
            ←
          </Text>
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text style={styles.mapTitle}>
            Live Trip Location
          </Text>

          <Text style={styles.mapSub}>
            {trip?.challanNumber || "—"}
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : null}
      </View>

      <View style={styles.bottomCard}>
        <View style={styles.liveRow}>
          <View style={styles.liveIcon}>
            <Text style={styles.liveIconText}>
              ((•))
            </Text>
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.liveTitle}>
              {isActive
                ? "Live location active"
                : "Trip not active"}
            </Text>

            <Text style={styles.liveSub}>
              Last updated: {lastUpdated}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.openMapsBtn}
          onPress={() =>
            safeOpenCoordinatesInMaps(
              lat,
              lng,
              trip?.challanNumber ||
                "Driver Location"
            )
          }
        >
          <Text style={styles.openMapsText}>
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
  },

  map: {
    flex: 1,
  },

  center: {
    flex: 1,
    backgroundColor: "#020617",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },

  title: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "900",
    marginBottom: 8,
  },

  sub: {
    color: "#94a3b8",
    fontWeight: "700",
    textAlign: "center",
  },

  error: {
    color: "#f87171",
    fontWeight: "900",
  },

  retryBtn: {
    height: 44,
    paddingHorizontal: 22,
    borderRadius: 14,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
  },

  retryText: {
    color: "#fff",
    fontWeight: "900",
  },

  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    minHeight: 88,
    paddingTop: 34,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: "rgba(2,6,23,.92)",
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },

  back: {
    color: "#fff",
    fontSize: 34,
    fontWeight: "700",
  },

  mapTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "900",
  },

  mapSub: {
    color: "#94a3b8",
    fontWeight: "700",
    marginTop: 2,
  },

  bottomCard: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#020617",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 18,
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,.08)",
  },

  liveRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 16,
  },

  liveIcon: {
    width: 54,
    height: 54,
    borderRadius: 999,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },

  liveIconText: {
    color: "#020617",
    fontWeight: "900",
    fontSize: 16,
  },

  liveTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "900",
  },

  liveSub: {
    color: "#94a3b8",
    marginTop: 4,
    fontWeight: "700",
  },

  openMapsBtn: {
    height: 52,
    borderRadius: 16,
    backgroundColor: "#22c55e",
    alignItems: "center",
    justifyContent: "center",
  },

  openMapsText: {
    color: "#052e16",
    fontWeight: "900",
    fontSize: 15,
  },

  markerOuter: {
    width: 54,
    height: 54,
    borderRadius: 999,
    backgroundColor: "rgba(34,197,94,.25)",
    alignItems: "center",
    justifyContent: "center",
  },

  markerInner: {
    width: 42,
    height: 42,
    borderRadius: 999,
    backgroundColor: "#22c55e",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#fff",
  },

  markerText: {
    fontSize: 18,
  },
};