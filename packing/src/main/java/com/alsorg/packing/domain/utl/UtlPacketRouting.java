package com.alsorg.packing.domain.utl;

import java.time.LocalDateTime;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * Dispatch ownership/routing for packets packed by the external UTL team.
 *
 * This is deliberately a separate table instead of adding UTL-only columns to
 * PacketItem/DispatchedItem.  Existing ALSORG packet, warehouse, dispatch,
 * challan and sticker schemas therefore keep their current contracts.
 */
@Entity
@Table(name = "utl_packet_routing")
public class UtlPacketRouting {

    @Id
    @Column(name = "packet_item_id", nullable = false)
    private UUID packetItemId;

    @Column(name = "source_plant_code", nullable = false, length = 32)
    private String sourcePlantCode;

    @Column(name = "dispatch_mode", nullable = false, length = 20)
    private String dispatchMode;

    @Column(name = "dispatch_target_username", nullable = false, length = 180)
    private String dispatchTargetUsername;

    @Column(name = "dispatch_target_plant_code", nullable = false, length = 32)
    private String dispatchTargetPlantCode;

    @Column(name = "packed_by_username", nullable = false, length = 180)
    private String packedByUsername;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    public UUID getPacketItemId() {
        return packetItemId;
    }

    public void setPacketItemId(UUID packetItemId) {
        this.packetItemId = packetItemId;
    }

    public String getSourcePlantCode() {
        return sourcePlantCode;
    }

    public void setSourcePlantCode(String sourcePlantCode) {
        this.sourcePlantCode = sourcePlantCode;
    }

    public String getDispatchMode() {
        return dispatchMode;
    }

    public void setDispatchMode(String dispatchMode) {
        this.dispatchMode = dispatchMode;
    }

    public String getDispatchTargetUsername() {
        return dispatchTargetUsername;
    }

    public void setDispatchTargetUsername(String dispatchTargetUsername) {
        this.dispatchTargetUsername = dispatchTargetUsername;
    }

    public String getDispatchTargetPlantCode() {
        return dispatchTargetPlantCode;
    }

    public void setDispatchTargetPlantCode(String dispatchTargetPlantCode) {
        this.dispatchTargetPlantCode = dispatchTargetPlantCode;
    }

    public String getPackedByUsername() {
        return packedByUsername;
    }

    public void setPackedByUsername(String packedByUsername) {
        this.packedByUsername = packedByUsername;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
