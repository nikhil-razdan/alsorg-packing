package com.alsorg.packing.domain.admin;

import java.time.LocalDateTime;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

@Entity
@Table(
        name = "packet_lifecycle_change_request",
        indexes = {
                @Index(
                        name = "idx_packet_lifecycle_request_status_time",
                        columnList = "status, requested_at"),
                @Index(
                        name = "idx_packet_lifecycle_request_packet_status",
                        columnList = "packet_item_id, status"),
                @Index(
                        name = "idx_packet_lifecycle_request_group",
                        columnList = "request_group_id")
        })
public class PacketLifecycleChangeRequest {

    @Id
    private UUID id;

    @Column(name = "request_group_id", nullable = false)
    private UUID requestGroupId;

    @Column(name = "packet_item_id", nullable = false)
    private UUID packetItemId;

    @Column(name = "display_name", length = 500)
    private String displayName;

    @Column(name = "item_name", length = 500)
    private String itemName;

    @Column(name = "packet_number", length = 255)
    private String packetNumber;

    @Column(name = "sku", length = 255)
    private String sku;

    @Column(name = "pd_no", length = 255)
    private String pdNo;

    @Column(name = "drawing_no", length = 255)
    private String drawingNo;

    @Column(name = "plant_code", length = 100)
    private String plantCode;

    @Column(name = "source", nullable = false, length = 40)
    private String source;

    @Column(name = "reason", nullable = false, length = 1000)
    private String reason;

    @Column(name = "requested_by", nullable = false, length = 255)
    private String requestedBy;

    @Column(name = "requested_at", nullable = false)
    private LocalDateTime requestedAt;

    @Column(name = "requested_from_state", nullable = false, length = 80)
    private String requestedFromState;

    @Column(name = "requested_from_label", nullable = false, length = 160)
    private String requestedFromLabel;

    @Column(name = "requested_to_state", nullable = false, length = 80)
    private String requestedToState;

    @Column(name = "requested_to_label", nullable = false, length = 160)
    private String requestedToLabel;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private PacketLifecycleChangeRequestStatus status;

    @Column(name = "decided_by", length = 255)
    private String decidedBy;

    @Column(name = "decided_at")
    private LocalDateTime decidedAt;

    @Column(name = "decision_reason", length = 500)
    private String decisionReason;

    @Version
    @Column(name = "row_version", nullable = false)
    private Long rowVersion;

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UUID getRequestGroupId() {
        return requestGroupId;
    }

    public void setRequestGroupId(UUID requestGroupId) {
        this.requestGroupId = requestGroupId;
    }

    public UUID getPacketItemId() {
        return packetItemId;
    }

    public void setPacketItemId(UUID packetItemId) {
        this.packetItemId = packetItemId;
    }

    public String getDisplayName() {
        return displayName;
    }

    public void setDisplayName(String displayName) {
        this.displayName = displayName;
    }

    public String getItemName() {
        return itemName;
    }

    public void setItemName(String itemName) {
        this.itemName = itemName;
    }

    public String getPacketNumber() {
        return packetNumber;
    }

    public void setPacketNumber(String packetNumber) {
        this.packetNumber = packetNumber;
    }

    public String getSku() {
        return sku;
    }

    public void setSku(String sku) {
        this.sku = sku;
    }

    public String getPdNo() {
        return pdNo;
    }

    public void setPdNo(String pdNo) {
        this.pdNo = pdNo;
    }

    public String getDrawingNo() {
        return drawingNo;
    }

    public void setDrawingNo(String drawingNo) {
        this.drawingNo = drawingNo;
    }

    public String getPlantCode() {
        return plantCode;
    }

    public void setPlantCode(String plantCode) {
        this.plantCode = plantCode;
    }

    public String getSource() {
        return source;
    }

    public void setSource(String source) {
        this.source = source;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }

    public String getRequestedBy() {
        return requestedBy;
    }

    public void setRequestedBy(String requestedBy) {
        this.requestedBy = requestedBy;
    }

    public LocalDateTime getRequestedAt() {
        return requestedAt;
    }

    public void setRequestedAt(LocalDateTime requestedAt) {
        this.requestedAt = requestedAt;
    }

    public String getRequestedFromState() {
        return requestedFromState;
    }

    public void setRequestedFromState(String requestedFromState) {
        this.requestedFromState = requestedFromState;
    }

    public String getRequestedFromLabel() {
        return requestedFromLabel;
    }

    public void setRequestedFromLabel(String requestedFromLabel) {
        this.requestedFromLabel = requestedFromLabel;
    }

    public String getRequestedToState() {
        return requestedToState;
    }

    public void setRequestedToState(String requestedToState) {
        this.requestedToState = requestedToState;
    }

    public String getRequestedToLabel() {
        return requestedToLabel;
    }

    public void setRequestedToLabel(String requestedToLabel) {
        this.requestedToLabel = requestedToLabel;
    }

    public PacketLifecycleChangeRequestStatus getStatus() {
        return status;
    }

    public void setStatus(PacketLifecycleChangeRequestStatus status) {
        this.status = status;
    }

    public String getDecidedBy() {
        return decidedBy;
    }

    public void setDecidedBy(String decidedBy) {
        this.decidedBy = decidedBy;
    }

    public LocalDateTime getDecidedAt() {
        return decidedAt;
    }

    public void setDecidedAt(LocalDateTime decidedAt) {
        this.decidedAt = decidedAt;
    }

    public String getDecisionReason() {
        return decisionReason;
    }

    public void setDecisionReason(String decisionReason) {
        this.decisionReason = decisionReason;
    }

    public Long getRowVersion() {
        return rowVersion;
    }

    public void setRowVersion(Long rowVersion) {
        this.rowVersion = rowVersion;
    }
}
