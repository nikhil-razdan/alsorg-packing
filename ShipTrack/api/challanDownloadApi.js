import {
  Alert,
  Platform,
} from "react-native";

import * as FileSystem from "expo-file-system/legacy";
import * as IntentLauncher from "expo-intent-launcher";
import * as SecureStore from "expo-secure-store";

import {
  API_BASE_URL,
} from "./client";

function cleanFilename(value) {
  const text =
    String(value || "challan")
      .replace(/[^a-zA-Z0-9._-]/g, "_");

  return text.endsWith(".pdf")
    ? text
    : `${text}.pdf`;
}

async function assertPdfFile(uri) {
  const base64 =
    await FileSystem.readAsStringAsync(
      uri,
      {
        encoding: FileSystem.EncodingType.Base64,
        length: 20,
        position: 0,
      }
    );

  /*
   * PDF files start with "%PDF".
   * In base64, "%PDF" starts as "JVBER".
   */
  if (!String(base64 || "").startsWith("JVBER")) {
    throw new Error(
      "Downloaded file is not a valid PDF. Backend may have returned an error instead of challan PDF."
    );
  }
}

export async function downloadChallanPdf(
  tripId,
  challanNo
) {
  if (!tripId) {
    throw new Error("Trip id missing");
  }

  const token =
    await SecureStore.getItemAsync("token");

  const filename =
    cleanFilename(
      challanNo || `challan-${tripId}`
    );

  const url =
    `${API_BASE_URL}/api/logistics/trips/${tripId}/challan`;

  const fileUri =
    FileSystem.documentDirectory + filename;

  const result =
    await FileSystem.downloadAsync(
      url,
      fileUri,
      {
        headers: token
          ? {
              Authorization: `Bearer ${token}`,
            }
          : {},
      }
    );

  if (!result?.uri) {
    throw new Error("Challan download failed");
  }

  if (
    result.status &&
    result.status >= 400
  ) {
    throw new Error(
      `Challan download failed. Backend returned ${result.status}.`
    );
  }

  await assertPdfFile(result.uri);

  return {
    uri: result.uri,
    filename,
  };
}

export async function openChallanPdf(
  tripId,
  challanNo
) {
  const {
    uri,
  } = await downloadChallanPdf(
    tripId,
    challanNo
  );

  if (Platform.OS === "android") {
    const contentUri =
      await FileSystem.getContentUriAsync(uri);

    await IntentLauncher.startActivityAsync(
      "android.intent.action.VIEW",
      {
        data: contentUri,
        type: "application/pdf",
        flags: 1,
      }
    );

    return;
  }

  throw new Error(
    "Opening challan PDF is currently configured for Android only."
  );
}

export async function safeOpenChallanPdf(
  tripId,
  challanNo
) {
  try {
    await openChallanPdf(
      tripId,
      challanNo
    );
  } catch (e) {
    Alert.alert(
      "Challan failed",
      e?.message || "Unable to open challan"
    );
  }
}