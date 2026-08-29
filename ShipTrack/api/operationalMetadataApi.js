import { api } from "./client";

const MAX_METADATA_IDS = 500;

const clean = (value) => String(value ?? "").trim();

export function getPacketItemId(item) {
  return clean(
    item?.packetItemId ||
    item?.packetItem?.id ||
    item?.packetItemUuid ||
    ""
  );
}

export function getDisplayPlantCode(item) {
  return clean(
    item?.displayPlantCode ||
    item?.plantDisplayCode ||
    item?.utlDisplayPlantCode ||
    item?.plantCode ||
    item?.plant ||
    ""
  );
}

export function getDisplaySku(item) {
  const plant = clean(
    item?.sourcePlantCode ||
    item?.plantCode ||
    item?.plant ||
    item?.displayPlantCode ||
    ""
  ).toUpperCase();

  /*
   * Current PackFlow rule: WR-38 does not use the AL composite SKU.
   * Product Code / PD No is the SKU identity for WR-38, including UTL-WR-38.
   */
  if (plant === "WR-38" || plant.startsWith("WR-38 ")) {
    return clean(
      item?.pdNo ||
      item?.productCode ||
      item?.code ||
      item?.sku ||
      item?.codeSku ||
      ""
    );
  }

  return clean(
    item?.sku ||
    item?.codeSku ||
    item?.pdNo ||
    item?.productCode ||
    ""
  );
}

async function fetchMetadataChunk(ids) {
  const res = await api.post(
    "/api/operational-metadata/utl-origins",
    ids
  );

  return Array.isArray(res?.data)
    ? res.data
    : [];
}

export async function fetchUtlOriginMetadata(packetItemIds = []) {
  const ids = Array.from(
    new Set(
      (Array.isArray(packetItemIds) ? packetItemIds : [])
        .map(clean)
        .filter(Boolean)
    )
  );

  if (ids.length === 0) {
    return [];
  }

  const rows = [];

  for (let index = 0; index < ids.length; index += MAX_METADATA_IDS) {
    const chunk = ids.slice(index, index + MAX_METADATA_IDS);
    const data = await fetchMetadataChunk(chunk);
    rows.push(...data);
  }

  return rows;
}

export async function enrichItemsWithOperationalMetadata(items = []) {
  const source = Array.isArray(items) ? items : [];

  if (source.length === 0) {
    return [];
  }

  const packetItemIds = source
    .map(getPacketItemId)
    .filter(Boolean);

  if (packetItemIds.length === 0) {
    return source.map((item) => ({
      ...item,
      displayPlantCode:
        getDisplayPlantCode(item) || undefined,
      displaySku:
        getDisplaySku(item) || undefined,
    }));
  }

  let metadata = [];

  try {
    metadata = await fetchUtlOriginMetadata(packetItemIds);
  } catch {
    /*
     * Presentation metadata must never block operational reads. The backend
     * remains authoritative for routing/authorization; if the metadata endpoint
     * is temporarily unavailable, ShipTrack falls back to the physical plant.
     */
    metadata = [];
  }

  const byPacketItemId = new Map();

  metadata.forEach((row) => {
    const id = clean(row?.packetItemId);
    if (id) {
      byPacketItemId.set(id, row);
    }
  });

  return source.map((item) => {
    const packetItemId = getPacketItemId(item);
    const meta = packetItemId
      ? byPacketItemId.get(packetItemId)
      : null;

    const merged = {
      ...item,
      ...(meta
        ? {
            utlOrigin: meta?.utlOrigin === true,
            sourcePlantCode:
              meta?.sourcePlantCode ||
              item?.sourcePlantCode,
            dispatchMode:
              meta?.dispatchMode ||
              item?.dispatchMode,
            dispatchTargetUsername:
              meta?.dispatchTargetUsername ||
              item?.dispatchTargetUsername,
            displayPlantCode:
              meta?.displayPlantCode ||
              getDisplayPlantCode(item),
          }
        : {
            displayPlantCode:
              getDisplayPlantCode(item) || undefined,
          }),
    };

    return {
      ...merged,
      displaySku:
        getDisplaySku(merged) || undefined,
    };
  });
}

export async function enrichChallansWithOperationalMetadata(challans = []) {
  const source = Array.isArray(challans) ? challans : [];

  if (source.length === 0) {
    return [];
  }

  const allItems = source.flatMap((challan) =>
    Array.isArray(challan?.items)
      ? challan.items
      : []
  );

  if (allItems.length === 0) {
    return source;
  }

  const enrichedItems = await enrichItemsWithOperationalMetadata(allItems);
  let cursor = 0;

  return source.map((challan) => {
    const originalItems = Array.isArray(challan?.items)
      ? challan.items
      : [];

    const nextItems = enrichedItems.slice(
      cursor,
      cursor + originalItems.length
    );

    cursor += originalItems.length;

    return {
      ...challan,
      items: nextItems,
    };
  });
}

export async function enrichResolvedScanResponse(data) {
  if (!data || typeof data !== "object") {
    return data;
  }

  for (const key of ["item", "dispatchedItem", "packetItem"]) {
    if (data?.[key] && typeof data[key] === "object") {
      const [enriched] = await enrichItemsWithOperationalMetadata([
        data[key],
      ]);

      return {
        ...data,
        [key]: enriched || data[key],
      };
    }
  }

  const [enriched] = await enrichItemsWithOperationalMetadata([data]);
  return enriched || data;
}
