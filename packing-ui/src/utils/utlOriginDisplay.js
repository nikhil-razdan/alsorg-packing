import { API_BASE_URL } from "../config";
import { secureFetch } from "../services/api";

export const WR38_PLANT_CODE = "WR-38";
const UTL_SUFFIX = " - UTL";
const UTL_METADATA_BATCH_SIZE = 50;

export const normalizePackFlowPlantCode = (value) => {
  const text = String(value || "")
    .trim()
    .toUpperCase();

  if (!text) {
    return "";
  }

  const match = text.match(
    /\b(?:AL-P\d+|WR-38)\b/
  );

  return match
    ? match[0]
    : text.split(/\s+/)[0].trim();
};

export const isWr38PackFlowRow = (row) =>
  normalizePackFlowPlantCode(
    row?.plantCode ||
    row?.utlSourcePlantCode ||
    row?.displayPlantCode
  ) === WR38_PLANT_CODE;

export const getPackFlowPacketItemId = (row) =>
  String(
    row?.packetItemId ||
    row?.itemId ||
    row?.packet_item_id ||
    row?.zohoItemId ||
    ""
  ).trim();

export const getWriverProductCode = (row) =>
  String(
    row?.pdNo ||
    row?.productCode ||
    row?.product_code ||
    row?.sku ||
    ""
  ).trim();

export const getPackFlowSkuDisplayValue = (row) => {
  if (isWr38PackFlowRow(row)) {
    return getWriverProductCode(row);
  }

  return String(row?.sku || "").trim();
};

export const getUtlOriginMetadataForRow = (
  row,
  metadataByPacketItemId = {}
) => {
  const directOrigin =
    row?.utlOrigin === true ||
    String(row?.utlOrigin || "")
      .trim()
      .toLowerCase() === "true";

  if (directOrigin) {
    return {
      utlOrigin: true,
      sourcePlantCode:
        row?.utlSourcePlantCode ||
        row?.sourcePlantCode ||
        row?.plantCode ||
        "",
      dispatchMode:
        row?.utlDispatchMode ||
        row?.dispatchMode ||
        "",
      dispatchTargetPlantCode:
        row?.utlDispatchTargetPlantCode ||
        row?.dispatchTargetPlantCode ||
        "",
      displayPlantCode:
        row?.displayPlantCode ||
        "",
    };
  }

  const packetItemId =
    getPackFlowPacketItemId(row);

  if (
    packetItemId &&
    metadataByPacketItemId &&
    metadataByPacketItemId[packetItemId]
  ) {
    return metadataByPacketItemId[
      packetItemId
    ];
  }

  return null;
};

export const isUtlOriginPackFlowRow = (
  row,
  metadataByPacketItemId = {},
  fallbackUtl = false
) =>
  Boolean(
    getUtlOriginMetadataForRow(
      row,
      metadataByPacketItemId
    )?.utlOrigin ||
    fallbackUtl
  );

export const getPackFlowPlantDisplayLabel = (
  row,
  metadataByPacketItemId = {},
  {
    fallbackUtl = false,
    wr38NormalLabel = "WR-38 • WRIVER",
  } = {}
) => {
  const metadata =
    getUtlOriginMetadataForRow(
      row,
      metadataByPacketItemId
    );

  const plantCode =
    normalizePackFlowPlantCode(
      metadata?.sourcePlantCode ||
      metadata?.displayPlantCode ||
      row?.plantCode
    );

  if (!plantCode) {
    return "—";
  }

  if (
    metadata?.utlOrigin ||
    fallbackUtl
  ) {
    return `${plantCode}${UTL_SUFFIX}`;
  }

  return plantCode === WR38_PLANT_CODE
    ? wr38NormalLabel
    : plantCode;
};

const chunk = (
  values,
  size
) => {
  const result = [];

  for (
    let index = 0;
    index < values.length;
    index += size
  ) {
    result.push(
      values.slice(
        index,
        index + size
      )
    );
  }

  return result;
};

/*
 * UTL origin is persisted in UtlPacketRouting, not in plantCode.
 * This read-only metadata endpoint allows normal AL-P3 / WR-38 receivers
 * to distinguish UTL-origin rows without corrupting the physical plant code
 * used by permissions, FG, Warehouse and Dispatch routing.
 */
export const fetchUtlOriginMetadataForRows =
  async (
    rows,
    {
      signal,
    } = {}
  ) => {
    const packetItemIds =
      Array.from(
        new Set(
          (
            Array.isArray(rows)
              ? rows
              : []
          )
            .map(
              getPackFlowPacketItemId
            )
            .filter(Boolean)
        )
      );

    if (
      packetItemIds.length === 0
    ) {
      return {};
    }

    const result = {};

    for (
      const batch of chunk(
        packetItemIds,
        UTL_METADATA_BATCH_SIZE
      )
    ) {
      const query =
        batch
          .map(
            (id) =>
              `ids=${encodeURIComponent(id)}`
          )
          .join("&");

      /*
       * This is presentation metadata, not a mutation. Using GET avoids the
       * cookie-authenticated browser CSRF boundary without weakening CSRF for
       * real PackFlow writes. The backend still applies authentication plus
       * UtlWorkflowService row visibility before returning any metadata.
       */
      const response =
        await secureFetch(
          `${API_BASE_URL}/api/operational-metadata/utl-origins?${query}`,
          {
            method: "GET",
            credentials: "include",
            cache: "no-store",
            headers: {
              Accept: "application/json",
            },
            signal,
          }
        );

      if (!response.ok) {
        const text =
          await response.text();

        throw new Error(
          text ||
          "Failed to load UTL origin metadata"
        );
      }

      const payload =
        await response.json();

      (
        Array.isArray(payload)
          ? payload
          : []
      ).forEach((entry) => {
        const packetItemId =
          String(
            entry?.packetItemId ||
            ""
          ).trim();

        if (!packetItemId) {
          return;
        }

        result[packetItemId] = {
          ...entry,
          utlOrigin: true,
        };
      });
    }

    return result;
  };
