package com.alsorg.packing.reporting.dto;

import java.util.List;

public record MasterItemDetailResponse(
        MasterItemListRow master,
        List<MasterPacketRow> packets,
        List<MasterPacketItemRow> packetItems,
        List<MasterChallanRow> challans
) {
}