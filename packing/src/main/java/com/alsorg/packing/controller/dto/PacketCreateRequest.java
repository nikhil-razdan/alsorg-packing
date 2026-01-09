package com.alsorg.packing.controller.dto;

import java.util.List;
import java.util.UUID;

public class PacketCreateRequest {

    private UUID companyId;
    private String createdBy;
    private List<PacketItemRequest> items;

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
