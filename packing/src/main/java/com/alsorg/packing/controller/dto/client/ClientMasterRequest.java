package com.alsorg.packing.controller.dto.client;

public record ClientMasterRequest(
        String name,
        String address,
        Boolean active
) {
}
