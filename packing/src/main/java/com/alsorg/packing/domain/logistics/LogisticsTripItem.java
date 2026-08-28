package com.alsorg.packing.domain.logistics;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.util.UUID;

@Entity
@Table(name = "logistics_trip_items")
public class LogisticsTripItem {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "trip_id", nullable = false)
    private LogisticsTrip trip;

    private String zohoItemId;
    private UUID packetItemId;
    private String itemName;
    private String sku;
    private String pdNo;
    private String drawingNo;
    private String clientName;

    @Column(length = 1000)
    private String description;

    @Column(length = 1000)
    private String remarks;

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public LogisticsTrip getTrip() { return trip; }
    public void setTrip(LogisticsTrip trip) { this.trip = trip; }
    public String getZohoItemId() { return zohoItemId; }
    public void setZohoItemId(String zohoItemId) { this.zohoItemId = zohoItemId; }
    public UUID getPacketItemId() { return packetItemId; }
    public void setPacketItemId(UUID packetItemId) { this.packetItemId = packetItemId; }
    public String getItemName() { return itemName; }
    public void setItemName(String itemName) { this.itemName = itemName; }
    public String getSku() { return sku; }
    public void setSku(String sku) { this.sku = sku; }
    public String getPdNo() { return pdNo; }
    public void setPdNo(String pdNo) { this.pdNo = pdNo; }
    public String getDrawingNo() { return drawingNo; }
    public void setDrawingNo(String drawingNo) { this.drawingNo = drawingNo; }
    public String getClientName() { return clientName; }
    public void setClientName(String clientName) { this.clientName = clientName; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getRemarks() { return remarks; }
    public void setRemarks(String remarks) { this.remarks = remarks; }
}
