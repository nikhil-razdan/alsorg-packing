import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import * as SecureStore from "expo-secure-store";

import {
  API_BASE_URL,
} from "./client";

const LIVE_LOCATION_TASK =
  "SHIPTRACK_LIVE_LOCATION_TASK";

const ACTIVE_TRIP_KEY =
  "shiptrack_active_live_trip_id";

async function getToken() {
  return await SecureStore.getItemAsync("token");
}

async function sendLocationToBackend(
  tripId,
  coords
) {
  if (!tripId || !coords) {
    return;
  }

  const token = await getToken();

  if (!token) {
    return;
  }

  await fetch(
    `${API_BASE_URL}/api/logistics/trips/${tripId}/location`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy,
        speed: coords.speed,
        heading: coords.heading,
        altitude: coords.altitude,
      }),
    }
  );
}

/*
 * IMPORTANT:
 * This must stay outside React components.
 * Background tasks must be registered at top level.
 */
TaskManager.defineTask(
  LIVE_LOCATION_TASK,
  async ({
    data,
    error,
  }) => {
    if (error) {
      console.log(
        "Background location task error",
        error
      );
      return;
    }

    const locations =
      data?.locations || [];

    if (!locations.length) {
      return;
    }

    const tripId =
      await SecureStore.getItemAsync(
        ACTIVE_TRIP_KEY
      );

    if (!tripId) {
      return;
    }

    const latest =
      locations[locations.length - 1];

    try {
      await sendLocationToBackend(
        tripId,
        latest.coords
      );
    } catch (e) {
      console.log(
        "Background live location upload failed",
        e?.message || e
      );
    }
  }
);

export async function requestLiveLocationPermissions() {
  const foreground =
    await Location.requestForegroundPermissionsAsync();

  if (foreground.status !== "granted") {
    throw new Error(
      "Foreground location permission denied."
    );
  }

  const background =
    await Location.requestBackgroundPermissionsAsync();

  if (background.status !== "granted") {
    throw new Error(
      "Background location permission denied. Please allow location all the time for live trip tracking."
    );
  }
}

export async function startLiveLocationForTrip(
  tripId
) {
  if (!tripId) {
    throw new Error(
      "Trip id missing for live location"
    );
  }

  await requestLiveLocationPermissions();

  await SecureStore.setItemAsync(
    ACTIVE_TRIP_KEY,
    String(tripId)
  );

  const alreadyStarted =
    await Location.hasStartedLocationUpdatesAsync(
      LIVE_LOCATION_TASK
    );

  if (alreadyStarted) {
    await Location.stopLocationUpdatesAsync(
      LIVE_LOCATION_TASK
    );
  }

  await Location.startLocationUpdatesAsync(
    LIVE_LOCATION_TASK,
    {
      accuracy: Location.Accuracy.High,
      timeInterval: 10000,
      distanceInterval: 15,

      foregroundService: {
        notificationTitle:
          "ShipTrack live location active",
        notificationBody:
          "Your trip live location is being shared until the trip is ended.",
        notificationColor: "#2563eb",
      },

      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
    }
  );

  /*
   * Send one immediate location also,
   * so Dispatch/Admin can see location instantly.
   */
  const current =
    await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

  await sendLocationToBackend(
    tripId,
    current.coords
  );
}

export async function stopLiveLocation() {
  const started =
    await Location.hasStartedLocationUpdatesAsync(
      LIVE_LOCATION_TASK
    );

  if (started) {
    await Location.stopLocationUpdatesAsync(
      LIVE_LOCATION_TASK
    );
  }

  await SecureStore.deleteItemAsync(
    ACTIVE_TRIP_KEY
  );
}