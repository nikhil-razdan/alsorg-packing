package com.alsorg.packing.controller.dto.client;

public record ClientMasterStatsResponse(
        long total,
        long active,
        long inactive
) {
}
