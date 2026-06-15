import {
  Alert,
  Linking,
} from "react-native";

import * as FileSystem from "expo-file-system/legacy";
import * as MediaLibrary from "expo-media-library";
import * as SecureStore from "expo-secure-store";

function getImageExtension(url) {
  const cleanUrl =
    String(url || "")
      .split("?")[0]
      .toLowerCase();

  if (cleanUrl.endsWith(".png")) return "png";
  if (cleanUrl.endsWith(".webp")) return "webp";
  if (cleanUrl.endsWith(".jpeg")) return "jpeg";

  return "jpg";
}

function getMimeType(ext) {
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "jpeg") return "image/jpeg";

  return "image/jpeg";
}

async function requestGalleryPermission() {
  const permission =
    await MediaLibrary.requestPermissionsAsync();

  if (
    permission.status !== "granted" &&
    permission.granted !== true
  ) {
    throw new Error(
      "Gallery permission denied. Please allow photo/gallery permission."
    );
  }
}

async function downloadPodToCache(url) {
  if (!url) {
    throw new Error("POD URL missing");
  }

  const ext = getImageExtension(url);

  const fileUri =
    FileSystem.cacheDirectory +
    `shiptrack-pod-${Date.now()}.${ext}`;

  const token =
    await SecureStore.getItemAsync("token");

  const headers = token
    ? {
        Authorization: `Bearer ${token}`,
      }
    : {};

  const result =
    await FileSystem.downloadAsync(
      url,
      fileUri,
      {
        headers,
      }
    );

  if (!result?.uri) {
    throw new Error("POD image download failed");
  }

  return {
    uri: result.uri,
    ext,
    mimeType: getMimeType(ext),
  };
}

async function savePodToGallery(url) {
  await requestGalleryPermission();

  const downloaded =
    await downloadPodToCache(url);

  const asset =
    await MediaLibrary.createAssetAsync(
      downloaded.uri
    );

  try {
    await MediaLibrary.createAlbumAsync(
      "ShipTrack POD",
      asset,
      false
    );
  } catch (e) {
    // Album may already exist on some Android devices.
    // The image is already saved as an asset, so this is not fatal.
  }

  return {
    asset,
    downloaded,
  };
}

export async function openPodImageInGallery(url) {
  const {
    asset,
    downloaded,
  } = await savePodToGallery(url);

  let openUri = "";

  try {
    const assetInfo =
      await MediaLibrary.getAssetInfoAsync(
        asset
      );

    openUri =
      assetInfo?.localUri ||
      assetInfo?.uri ||
      asset?.uri ||
      downloaded.uri;
  } catch (e) {
    openUri =
      asset?.uri ||
      downloaded.uri;
  }

  if (!openUri) {
    throw new Error(
      "POD saved, but gallery path could not be opened."
    );
  }

  const canOpen =
    await Linking.canOpenURL(openUri);

  if (canOpen) {
    await Linking.openURL(openUri);
    return;
  }

  Alert.alert(
    "POD saved",
    "POD image has been saved in your phone gallery under ShipTrack POD."
  );
}

export async function downloadPodImageToGallery(url) {
  await savePodToGallery(url);

  return true;
}

export async function safeOpenPodImage(url) {
  try {
    await openPodImageInGallery(url);
  } catch (e) {
    Alert.alert(
      "Open POD failed",
      e?.message ||
        "POD image could not be opened, but please check your phone gallery."
    );
  }
}

export async function safeDownloadPodImage(url) {
  try {
    await downloadPodImageToGallery(url);

    Alert.alert(
      "POD downloaded",
      "POD image has been saved to your phone gallery under ShipTrack POD."
    );
  } catch (e) {
    Alert.alert(
      "Download failed",
      e?.message ||
        "Unable to download POD image."
    );
  }
}