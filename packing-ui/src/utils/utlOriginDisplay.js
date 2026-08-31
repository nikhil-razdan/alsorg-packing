import { API_BASE_URL } from "../config";
import { secureFetch } from "../services/api";

export const WR38_PLANT_CODE = "WR-38";

const UTL_SUFFIX = " - UTL";

/*
 * Keep GET query strings comfortably below browser / proxy request-line
 * limits. This affects presentation metadata only.
 */
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

  return String(
    row?.sku || ""
  ).trim();
};

export const getUtlOriginMetadataForRow = (
  row,
  metadataByPacketItemId = {}
) => {
  const directOrigin =
    row?.utlOrigin === true ||
    String(
      row?.utlOrigin || ""
    )
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
    metadataByPacketItemId[
      packetItemId
    ]
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
    wr38NormalLabel =
      "WR-38 • WRIVER",
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

  return plantCode ===
    WR38_PLANT_CODE
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
 * ============================================================
 * UTL ORIGIN PRESENTATION METADATA
 * ============================================================
 *
 * IMPORTANT:
 *
 * UTL origin remains persisted in UtlPacketRouting.
 *
 * This helper is READ-ONLY presentation enrichment. It does NOT:
 *
 * - change plantCode
 * - change dispatch routing
 * - change Warehouse state
 * - change FG state
 * - change Dispatch state
 * - change UTL assignment
 * - change packet ownership
 * - perform any mutation
 *
 * Browser reads use the backend's safe GET endpoint:
 *
 * GET
 * /api/operational-metadata/utl-origins?ids=<uuid>&ids=<uuid>
 *
 * POST compatibility remains on the backend for older clients.
 *
 * Abort behaviour:
 *
 * Warehouse / Dispatch may cancel a stale metadata refresh when their
 * visible rows change or when the component unmounts.
 *
 * Cancellation is expected lifecycle behaviour for this OPTIONAL
 * presentation request. It must not become an unhandled browser error.
 *
 * Therefore AbortError returns the metadata already resolved, if any.
 * A genuine HTTP/server/authentication error is still propagated.
 * ============================================================
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
      /*
       * The caller may have cancelled this stale read between batches.
       *
       * That is not an application failure. Return whatever presentation
       * metadata has already been resolved.
       */
      if (signal?.aborted) {
        return result;
      }

      const params =
        new URLSearchParams();

      batch.forEach(
        (packetItemId) => {
          params.append(
            "ids",
            packetItemId
          );
        }
      );

      let response;

      try {
        response =
          await secureFetch(
            `${API_BASE_URL}/api/operational-metadata/utl-origins?${params.toString()}`,
            {
              method: "GET",

              credentials:
                "include",

              cache:
                "no-store",

              headers: {
                Accept:
                  "application/json",
              },

              signal,
            }
          );
      } catch (error) {
        /*
         * Abort is an expected consequence of React replacing/unmounting
         * a stale read-only request. Never surface it as an unhandled
         * promise rejection.
         */
        if (
          error?.name ===
            "AbortError" ||
          signal?.aborted
        ) {
          return result;
        }

        /*
         * Real network/auth/server errors remain visible to the caller.
         */
        throw error;
      }

      /*
       * The request may technically complete immediately before cleanup
       * aborts the signal. Do not continue processing a stale response.
       */
      if (signal?.aborted) {
        return result;
      }

      if (!response.ok) {
        let text = "";

        try {
          text =
            await response.text();
        } catch {
          text = "";
        }

        throw new Error(
          text ||
            "Failed to load UTL origin metadata"
        );
      }

      let payload;

      try {
        payload =
          await response.json();
      } catch (error) {
        if (
          error?.name ===
            "AbortError" ||
          signal?.aborted
        ) {
          return result;
        }

        throw error;
      }

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

        result[
          packetItemId
        ] = {
          ...entry,
          utlOrigin: true,
        };
      });
    }

    return result;
  };