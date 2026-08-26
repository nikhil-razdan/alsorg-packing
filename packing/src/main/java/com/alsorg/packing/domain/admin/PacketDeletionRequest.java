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
        name = "packet_deletion_request",
        indexes = {
                @Index(
                        name = "idx_packet_deletion_request_status_time",
                        columnList = "status, requested_at"),
                @Index(
                        name = "idx_packet_deletion_request_target_status",
                        columnList = "target_key, status"),
                @Index(
                        name = "idx_packet_deletion_request_packet_status",
                        columnList = "packet_item_id, status"),
                @Index(
                        name = "idx_packet_deletion_request_group",
                        columnList = "request_group_id")
        })
public class PacketDeletionRequest {

    @Id
    private UUID id;

    @Column(name = "request_group_id", nullable = false)
    private UUID requestGroupId;

    @Column(name = "target_key", nullable = false, length = 400)
    private String targetKey;

    @Column(name = "target_type", nullable = false, length = 40)
    private String targetType;

    @Column(name = "target_id", nullable = false, length = 255)
    private String targetId;

    @Column(name = "packet_item_id")
    private UUID packetItemId;

    @Column(name = "dispatch_item_id", length = 255)
    private String dispatchItemId;

    @Column(name = "source_reference_id", nullable = false, length = 255)
    private String sourceReferenceId;

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

    @Column(name = "requested_status", length = 80)
    private String requestedStatus;

    @Column(name = "requested_location", length = 255)
    private String requestedLocation;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private PacketDeletionRequestStatus status;

    @Column(name = "decided_by", length = 255)
    private String decidedBy;

    @Column(name = "decided_at")
    private LocalDateTime decidedAt;

    @Column(name = "decision_reason", length = 500)
    private String decisionReason;

    @Column(name = "deletion_audit_id")
    private UUID deletionAuditId;

    @Column(name = "deletion_message", length = 1000)
    private String deletionMessage;

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

    public String getTargetKey() {
        return targetKey;
    }

    public void setTargetKey(String targetKey) {
        this.targetKey = targetKey;
    }

    public String getTargetType() {
        return targetType;
    }

    public void setTargetType(String targetType) {
        this.targetType = targetType;
    }

    public String getTargetId() {
        return targetId;
    }

    public void setTargetId(String targetId) {
        this.targetId = targetId;
    }

    public UUID getPacketItemId() {
        return packetItemId;
    }

    public void setPacketItemId(UUID packetItemId) {
        this.packetItemId = packetItemId;
    }

    public String getDispatchItemId() {
        return dispatchItemId;
    }

    public void setDispatchItemId(String dispatchItemId) {
        this.dispatchItemId = dispatchItemId;
    }

    public String getSourceReferenceId() {
        return sourceReferenceId;
    }

    public void setSourceReferenceId(String sourceReferenceId) {
        this.sourceReferenceId = sourceReferenceId;
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

    public String getRequestedStatus() {
        return requestedStatus;
    }

    public void setRequestedStatus(String requestedStatus) {
        this.requestedStatus = requestedStatus;
    }

    public String getRequestedLocation() {
        return requestedLocation;
    }

    public void setRequestedLocation(String requestedLocation) {
        this.requestedLocation = requestedLocation;
    }

    public PacketDeletionRequestStatus getStatus() {
        return status;
    }

    public void setStatus(PacketDeletionRequestStatus status) {
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

    public UUID getDeletionAuditId() {
        return deletionAuditId;
    }

    public void setDeletionAuditId(UUID deletionAuditId) {
        this.deletionAuditId = deletionAuditId;
    }

    public String getDeletionMessage() {
        return deletionMessage;
    }

    public void setDeletionMessage(String deletionMessage) {
        this.deletionMessage = deletionMessage;
    }

    public Long getRowVersion() {
        return rowVersion;
    }

    public void setRowVersion(Long rowVersion) {
        this.rowVersion = rowVersion;
    }
}
