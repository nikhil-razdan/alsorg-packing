import {
  Alert,
  Linking,
  Platform,
} from "react-native";

import * as Location from "expo-location";

function cleanNumber(value) {
  const n = Number(value);

  return Number.isFinite(n)
    ? n
    : null;
}

export function hasValidCoordinates(
  latitude,
  longitude
) {
  const lat = cleanNumber(latitude);
  const lng = cleanNumber(longitude);

  return lat !== null && lng !== null;
}

function buildMapUrls(
  latitude,
  longitude,
  label = "Location"
) {
  const lat = cleanNumber(latitude);
  const lng = cleanNumber(longitude);

  if (lat === null || lng === null) {
    throw new Error("Location coordinates missing");
  }

  const safeLabel =
    encodeURIComponent(label || "Location");

  const nativeAndroidUrl =
    `geo:0,0?q=${lat},${lng}(${safeLabel})`;

  const googleMapsUrl =
    `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

  return {
    nativeAndroidUrl,
    googleMapsUrl,
  };
}

export async function openCoordinatesInMaps(
  latitude,
  longitude,
  label = "Delivery Location"
) {
  const {
    nativeAndroidUrl,
    googleMapsUrl,
  } = buildMapUrls(
    latitude,
    longitude,
    label
  );

  try {
    if (Platform.OS === "android") {
      await Linking.openURL(nativeAndroidUrl);
      return;
    }

    await Linking.openURL(googleMapsUrl);
  } catch (firstError) {
    try {
      await Linking.openURL(googleMapsUrl);
    } catch (secondError) {
      throw new Error(
        "Unable to open location. Please check that Google Maps or a browser is installed."
      );
    }
  }
}

export async function openCurrentLocationInMaps() {
  const permission =
    await Location.requestForegroundPermissionsAsync();

  if (permission.status !== "granted") {
    throw new Error(
      "Location permission denied. Please allow location permission."
    );
  }

  const current =
    await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

  const lat = current.coords.latitude;
  const lng = current.coords.longitude;

  await openCoordinatesInMaps(
    lat,
    lng,
    "My Live Location"
  );
}

export async function safeOpenCoordinatesInMaps(
  latitude,
  longitude,
  label
) {
  try {
    await openCoordinatesInMaps(
      latitude,
      longitude,
      label
    );
  } catch (e) {
    Alert.alert(
      "Location failed",
      e?.message || "Unable to open location"
    );
  }
}

export async function safeOpenCurrentLocationInMaps() {
  try {
    await openCurrentLocationInMaps();
  } catch (e) {
    Alert.alert(
      "Live location failed",
      e?.message || "Unable to open live location"
    );
  }
}

export async function downloadTripChallan(tripId, token) {
  const res = await fetch(
    `${API_BASE_URL}/api/logistics/trips/${tripId}/challan`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!res.ok) {
    const msg = await res.text();
    throw new Error(msg || "Unable to download challan");
  }

  const blob = await res.blob();

  const disposition =
    res.headers.get("Content-Disposition") || "";

  let filename = "challan.pdf";

  const match =
    disposition.match(/filename="?([^"]+)"?/);

  if (match?.[1]) {
    filename = match[1];
  }

  const url = window.URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();

  a.remove();
  window.URL.revokeObjectURL(url);
}