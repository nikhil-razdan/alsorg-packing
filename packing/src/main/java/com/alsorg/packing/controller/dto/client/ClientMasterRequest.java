package com.alsorg.packing.controller.dto.client;

import jakarta.validation.constraints.Size;

public record ClientMasterRequest(
        @Size(max = 500, message = "Client name cannot exceed 500 characters")
        String name,

        @Size(max = 2000, message = "Client address cannot exceed 2000 characters")
        String address,

        Boolean active) {
}
