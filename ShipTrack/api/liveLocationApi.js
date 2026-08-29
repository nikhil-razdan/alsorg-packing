import * as Location from "expo-location";
import * as SecureStore from "expo-secure-store";

/*
 * Current PackFlow backend contract:
 * /api/logistics/trips/{tripId}/start
 * /api/logistics/trips/{tripId}/location
 * /api/logistics/trips/{tripId}/end
 * are intentionally retired and return HTTP 410 GONE.
 *
 * Keep these exports so older ShipTrack imports remain source-compatible, but
 * do not request location permission, register a background task, or send GPS
 * data to an endpoint the backend has deliberately removed.
 */
const LIVE_LOCATION_TASK =
  "SHIPTRACK_LIVE_LOCATION_TASK";

const ACTIVE_TRIP_KEY =
  "shiptrack_active_live_trip_id";

const removedMessage =
  "Live location tracking has been removed from the current PackFlow workflow. Dispatch challan timing is authoritative.";

export async function requestLiveLocationPermissions() {
  throw new Error(removedMessage);
}

export async function startLiveLocationForTrip() {
  throw new Error(removedMessage);
}

async function stopLegacyScheduledTask() {
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
  } catch {
    /* Best-effort cleanup for an APK upgraded from the old tracker. */
  }

  try {
    await SecureStore.deleteItemAsync(
      ACTIVE_TRIP_KEY
    );
  } catch {
    /* Local cleanup must not break logout/navigation. */
  }
}

export async function stopLiveLocation() {
  await stopLegacyScheduledTask();
}

export async function resetLiveLocationTask() {
  await stopLegacyScheduledTask();
}
