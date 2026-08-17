package com.alsorg.packing.controller.dto.admin;

import java.util.List;

public record AdminWarehouseBulkDeleteRequest(
        List<String> itemIds,
        String confirmationText,
        String reason) {
}
