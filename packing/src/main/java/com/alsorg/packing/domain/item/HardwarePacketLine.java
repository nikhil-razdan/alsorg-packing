package com.alsorg.packing.domain.item;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonIgnore;

import jakarta.persistence.*;

@Entity
@Table(name = "hardware_packet_lines", uniqueConstraints = {
        @UniqueConstraint(name = "uq_hardware_packet_line_number", columnNames = {
                "packet_item_id",
                "line_no"
        })
})
public class HardwarePacketLine {

    @Id
    private UUID id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "packet_item_id", nullable = false)
    private PacketItem packetItem;

    @Column(name = "line_no", nullable = false)
    private Integer lineNo;

    @Column(name = "item_name", nullable = false, length = 300)
    private String itemName;

    @Column(nullable = false, precision = 14, scale = 3)
    private BigDecimal quantity;

    @Column(nullable = false, length = 30)
    private String uom;

    /*
     * Reserved for Phase 2 hardware inventory integration.
     */
    @Column(name = "hardware_inventory_item_id")
    private UUID hardwareInventoryItemId;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public PacketItem getPacketItem() {
        return packetItem;
    }

    public void setPacketItem(PacketItem packetItem) {
        this.packetItem = packetItem;
    }

    public Integer getLineNo() {
        return lineNo;
    }

    public void setLineNo(Integer lineNo) {
        this.lineNo = lineNo;
    }

    public String getItemName() {
        return itemName;
    }

    public void setItemName(String itemName) {
        this.itemName = itemName;
    }

    public BigDecimal getQuantity() {
        return quantity;
    }

    public void setQuantity(BigDecimal quantity) {
        this.quantity = quantity;
    }

    public String getUom() {
        return uom;
    }

    public void setUom(String uom) {
        this.uom = uom;
    }

    public UUID getHardwareInventoryItemId() {
        return hardwareInventoryItemId;
    }

    public void setHardwareInventoryItemId(UUID hardwareInventoryItemId) {
        this.hardwareInventoryItemId = hardwareInventoryItemId;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    @PrePersist
    private void applyCreateDefaults() {
        if (id == null) {
            id = UUID.randomUUID();
        }

        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }

        if (uom == null
                || uom.isBlank()) {
            uom = "Nos";
        }
    }
}