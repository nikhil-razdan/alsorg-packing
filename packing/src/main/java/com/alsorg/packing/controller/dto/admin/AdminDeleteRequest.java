package com.alsorg.packing.controller.dto.admin;

import jakarta.validation.constraints.Size;

public record AdminDeleteRequest(
        @Size(max = 500, message = "Confirmation text is too long")
        String confirmationText,

        @Size(max = 1000, message = "Deletion reason cannot exceed 1000 characters")
        String reason) {
}
