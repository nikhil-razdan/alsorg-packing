import * as Location from "expo-location";

import {
  updateTripLocation,
} from "./logisticsApi";

let subscription = null;
let activeTripId = null;

export async function startLiveLocationForTrip(
  tripId
) {
  if (!tripId) {
    throw new Error(
      "Trip id missing for live location"
    );
  }

  const permission =
    await Location.requestForegroundPermissionsAsync();

  if (permission.status !== "granted") {
    throw new Error(
      "Location permission denied. Please allow location permission."
    );
  }

  await stopLiveLocation();

  activeTripId = tripId;

  subscription =
    await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 15000,
        distanceInterval: 25,
      },
      async (position) => {
        try {
          if (!activeTripId) return;

          await updateTripLocation(
            activeTripId,
            {
              latitude:
                position.coords.latitude,

              longitude:
                position.coords.longitude,

              accuracy:
                position.coords.accuracy,
            }
          );
        } catch (e) {
          console.log(
            "Live location update failed",
            e?.response?.data ||
              e?.message
          );
        }
      }
    );
}

export async function stopLiveLocation() {
  if (subscription) {
    subscription.remove();
    subscription = null;
  }

  activeTripId = null;
}