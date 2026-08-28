package com.alsorg.packing.controller.dto.admin;

import java.util.List;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

public record AdminWarehouseBulkDeleteRequest(
        @NotEmpty(message = "Select at least one item")
        @Size(max = 200, message = "A maximum of 200 items can be deleted at once")
        List<String> itemIds,

        @Size(max = 500, message = "Confirmation text is too long")
        String confirmationText,

        @Size(max = 1000, message = "Deletion reason cannot exceed 1000 characters")
        String reason) {
}
