package com.alsorg.packing.controller.dto;

import java.util.List;
import java.util.UUID;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public class PacketCreateRequest {

    @NotNull(message = "Company is required.")
    private UUID companyId;

    /*
     * Legacy transport field retained for older clients. The hardened
     * PacketController attributes creation to the authenticated user instead.
     */
    @Size(max = 255, message = "Created-by value cannot exceed 255 characters.")
    private String createdBy;

    @NotEmpty(message = "At least one packet item is required.")
    @Size(max = 500, message = "A maximum of 500 packet items can be created at once.")
    private List<@Valid PacketItemRequest> items;

    // Getters & Setters

    public UUID getCompanyId() {
        return companyId;
    }

    public void setCompanyId(UUID companyId) {
        this.companyId = companyId;
    }

    public String getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(String createdBy) {
        this.createdBy = createdBy;
    }

    public List<PacketItemRequest> getItems() {
        return items;
    }

    public void setItems(List<PacketItemRequest> items) {
        this.items = items;
    }
}
