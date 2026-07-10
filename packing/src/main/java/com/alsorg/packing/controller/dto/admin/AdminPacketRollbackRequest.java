package com.alsorg.packing.controller.dto.admin;

public record AdminPacketRollbackRequest(
        String confirmationText,
        String reason
) {
}