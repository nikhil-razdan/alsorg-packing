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
} from "react-native";

import {
  Map,
  Camera,
  ViewAnnotation,
} from "@maplibre/maplibre-react-native";

import {
  fetchTrips,
} from "../api/logisticsApi";

import {
  safeOpenCoordinatesInMaps,
} from "../api/locationApi";

const MAP_STYLE_URL =
  "https://tiles.openfreemap.org/styles/liberty";

const normalizeStatus = (value) =>
  String(value || "")
    .trim()
    .toUpperCase();

function cleanNumber(value) {
  const n = Number(value);

  return Number.isFinite(n)
    ? n
    : null;
}

function formatTime(value) {
  if (!value) return "—";

  try {
    return new Date(value).toLocaleTimeString();
  } catch {
    return "—";
  }
}

function isStaleLocation(value) {
  if (!value) return false;

  const updatedAt =
    new Date(value).getTime();

  if (!Number.isFinite(updatedAt)) {
    return false;
  }

  const diffMs =
    Date.now() - updatedAt;

  return diffMs > 2 * 60 * 1000;
}

async function reverseGeocodeAddress(
  latitude,
  longitude
) {
  try {
    const url =
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`;

    const res =
      await fetch(url, {
        headers: {
          "User-Agent":
            "ShipTrack/1.0 alsorg logistics live location",
          "Accept-Language": "en",
        },
      });

    if (!res.ok) {
      return "";
    }

    const data =
      await res.json();

    return (
      data?.display_name ||
      data?.name ||
      ""
    );
  } catch {
    return "";
  }
}

export default function LiveTripMapScreen({
  route,
  navigation,
}) {
  const initialTrip =
    route?.params?.trip || null;

  const tripId =
    route?.params?.tripId ||
    initialTrip?.id;

  const [trip, setTrip] =
    useState(initialTrip);

  const [loading, setLoading] =
    useState(false);

  const [address, setAddress] =
    useState("");

  const [mapError, setMapError] =
    useState("");

  const intervalRef =
    useRef(null);

  const lat =
    cleanNumber(trip?.currentLatitude);

  const lng =
    cleanNumber(trip?.currentLongitude);

  const hasLocation =
    lat !== null && lng !== null;

  const isActive =
    normalizeStatus(trip?.status) ===
    "OUT_FOR_DELIVERY";

  const stale =
    isStaleLocation(
      trip?.currentLocationAt
    );

  const loadFreshTrip = async () => {
    if (!tripId) {
      return;
    }

    try {
      setLoading(true);

      const trips =
        await fetchTrips();

      const fresh =
        Array.isArray(trips)
          ? trips.find(
              (x) =>
                String(x.id) ===
                String(tripId)
            )
          : null;

      if (fresh) {
        setTrip(fresh);
      }
    } catch (e) {
      console.log(
        "Live map refresh failed",
        e?.response?.data ||
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
  }, [tripId]);

  useEffect(() => {
    let cancelled = false;

    const loadAddress = async () => {
      if (!hasLocation) {
        setAddress("");
        return;
      }

      const result =
        await reverseGeocodeAddress(
          lat,
          lng
        );

      if (!cancelled) {
        setAddress(result);
      }
    };

    loadAddress();

    return () => {
      cancelled = true;
    };
  }, [lat, lng, hasLocation]);

  if (!tripId) {
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
          Waiting for driver GPS location...
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
    formatTime(
      trip?.currentLocationAt
    );

  const accuracy =
    trip?.currentLocationAccuracy
      ? `${Math.round(
          Number(
            trip.currentLocationAccuracy
          )
        )} m`
      : "—";

  const speed =
    trip?.currentSpeed != null
      ? `${Math.round(
          Number(trip.currentSpeed) * 3.6
        )} km/h`
      : "—";

  const heading =
    trip?.currentHeading != null
      ? `${Math.round(
          Number(trip.currentHeading)
        )}°`
      : "—";

  return (
    <View style={styles.page}>
      <Map
        style={styles.map}
        mapStyle={MAP_STYLE_URL}
        onDidFinishLoadingMap={() =>
          setMapError("")
        }
        onDidFailLoadingMap={() =>
          setMapError(
            "Map tiles failed to load. Check internet connection."
          )
        }
      >
        <Camera
          zoom={16.5}
          center={[
            lng,
            lat,
          ]}
          animationMode="flyTo"
          animationDuration={900}
        />

        <ViewAnnotation
          id="driver-location"
          lngLat={[
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
        </ViewAnnotation>
      </Map>

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
        ) : (
          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={loadFreshTrip}
          >
            <Text style={styles.refreshText}>
              ↻
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {mapError ? (
        <View style={styles.mapErrorBox}>
          <Text style={styles.mapErrorText}>
            {mapError}
          </Text>
        </View>
      ) : null}

      <View style={styles.addressPill}>
        <Text
          style={styles.addressText}
          numberOfLines={2}
        >
          {address ||
            `Lat ${lat.toFixed(
              5
            )}, Long ${lng.toFixed(5)}`}
        </Text>
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
                ? stale
                  ? "Live location stale"
                  : "Live location active"
                : "Trip not active"}
            </Text>

            <Text style={styles.liveSub}>
              Last updated: {lastUpdated}
            </Text>

            <Text style={styles.liveSub}>
              Accuracy: {accuracy}
            </Text>

            <Text style={styles.liveSub}>
              Speed: {speed} • Heading: {heading}
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

  refreshBtn: {
    width: 42,
    height: 42,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,.12)",
    alignItems: "center",
    justifyContent: "center",
  },

  refreshText: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "900",
  },

  mapErrorBox: {
    position: "absolute",
    top: 96,
    left: 16,
    right: 16,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "rgba(239,68,68,.92)",
  },

  mapErrorText: {
    color: "#fff",
    fontWeight: "900",
    textAlign: "center",
  },

  addressPill: {
    position: "absolute",
    top: 100,
    left: 16,
    right: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: "rgba(2,6,23,.88)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.08)",
  },

  addressText: {
    color: "#e5e7eb",
    fontWeight: "800",
    fontSize: 12,
    lineHeight: 17,
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
    width: 58,
    height: 58,
    borderRadius: 999,
    backgroundColor: "rgba(34,197,94,.25)",
    alignItems: "center",
    justifyContent: "center",
  },

  markerInner: {
    width: 44,
    height: 44,
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