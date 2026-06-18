import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import * as SecureStore from "expo-secure-store";

import {
  API_BASE_URL,
  buildBearerToken,
  getStoredToken,
} from "./client";

const LIVE_LOCATION_TASK =
  "SHIPTRACK_LIVE_LOCATION_TASK";

const ACTIVE_TRIP_KEY =
  "shiptrack_active_live_trip_id";

let foregroundSubscription = null;
let foregroundTripId = null;

async function sendLocationToBackend(
  tripId,
  coords
) {
  if (!tripId || !coords) return;

  const token =
    await getStoredToken();

  const bearer =
    buildBearerToken(token);

  if (!bearer) return;

  const cleanBaseUrl =
    String(API_BASE_URL || "").replace(/\/+$/, "");

  await fetch(
    `${cleanBaseUrl}/api/logistics/trips/${tripId}/location`,
    {
      method: "POST",
      headers: {
        Authorization: bearer,
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
 * Background task must stay at top-level.
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

    if (!locations.length) return;

    const tripId =
      await SecureStore.getItemAsync(
        ACTIVE_TRIP_KEY
      );

    if (!tripId) return;

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

async function startForegroundTracker(
  tripId
) {
  await stopForegroundTracker();

  foregroundTripId = String(tripId);

  foregroundSubscription =
    await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 10000,
        distanceInterval: 15,
      },
      async (position) => {
        try {
          if (!foregroundTripId) return;

          await sendLocationToBackend(
            foregroundTripId,
            position.coords
          );
        } catch (e) {
          console.log(
            "Foreground location upload failed",
            e?.message || e
          );
        }
      }
    );
}

async function stopForegroundTracker() {
  if (foregroundSubscription) {
    foregroundSubscription.remove();
    foregroundSubscription = null;
  }

  foregroundTripId = null;
}

export async function requestLiveLocationPermissions() {
  const foreground =
    await Location.requestForegroundPermissionsAsync();

  if (foreground.status !== "granted") {
    throw new Error(
      "Location permission denied. Please allow location permission."
    );
  }

  const background =
    await Location.requestBackgroundPermissionsAsync();

  if (background.status !== "granted") {
    throw new Error(
      "Background location denied. Please allow Always Allow / Allow all the time for WhatsApp-style live tracking."
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

  /*
   * Start foreground tracker also.
   * This gives instant updates while app is open.
   */
  await startForegroundTracker(tripId);

  /*
   * Then start background tracker.
   */
  const alreadyStarted =
    await Location.hasStartedLocationUpdatesAsync(
      LIVE_LOCATION_TASK
    );

  if (alreadyStarted) {
    await Location.stopLocationUpdatesAsync(
      LIVE_LOCATION_TASK
    );
  }

  try {
    await Location.startLocationUpdatesAsync(
      LIVE_LOCATION_TASK,
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 10000,
        distanceInterval: 15,
        pausesUpdatesAutomatically: false,

        foregroundService: {
          notificationTitle:
            "ShipTrack live location active",
          notificationBody:
            "Your live trip location is being shared until the trip is ended.",
          notificationColor: "#2563eb",
        },

        showsBackgroundLocationIndicator: true,
      }
    );
  } catch (e) {
    /*
     * Safety fallback:
     * If Android rejects background scheduler for any reason,
     * foreground tracking still works instead of crashing the app.
     */
    console.log(
      "Background tracker failed, foreground tracker still running:",
      e?.message || e
    );
  }

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
  try {
    const started =
      await Location.hasStartedLocationUpdatesAsync(
        LIVE_LOCATION_TASK
      );

    if (started) {
      await Location.stopLocationUpdatesAsync(
        LIVE_LOCATION_TASK
      );
    }
  } catch (e) {
    console.log(
      "Stop live location failed",
      e?.message || e
    );
  }

  try {
    await SecureStore.deleteItemAsync(
      ACTIVE_TRIP_KEY
    );
  } catch (e) {
    console.log(
      "Clear active trip key failed",
      e?.message || e
    );
  }
}

export async function resetLiveLocationTask() {
  try {
    const started =
      await Location.hasStartedLocationUpdatesAsync(
        LIVE_LOCATION_TASK
      );

    if (started) {
      await Location.stopLocationUpdatesAsync(
        LIVE_LOCATION_TASK
      );
    }
  } catch (e) {
    console.log(
      "Reset live location task failed",
      e?.message || e
    );
  }

  try {
    await SecureStore.deleteItemAsync(
      ACTIVE_TRIP_KEY
    );
  } catch (e) {
    console.log(
      "Reset active trip key failed",
      e?.message || e
    );
  }
}