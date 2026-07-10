package com.alsorg.packing.controller.dto.admin;

public record AdminDeleteRequest(
        String confirmationText,
        String reason
) {
}