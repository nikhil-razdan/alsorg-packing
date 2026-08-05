package com.alsorg.packing.controller.dto.dispatch;

import java.util.List;

public record AdminBulkDispatchEditResponse(
        int requestedItemCount,
        int updatedItemCount,
        int updatedChallanCount,
        List<AdminUpdatedDispatchRow> updatedRows
) {
}