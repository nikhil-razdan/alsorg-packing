package com.alsorg.packing.domain.matflow;

import com.alsorg.packing.config.TimeZoneConfig;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Index;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "mf_audit_logs", indexes = {
        @Index(name = "idx_mf_audit_entity", columnList = "entity_type, entity_id"),
        @Index(name = "idx_mf_audit_pf", columnList = "production_file_id"),
        @Index(name = "idx_mf_audit_action_at", columnList = "action_at")
})
public class MatFlowAuditLog extends MatFlowBaseEntity {
    @Column(name = "entity_type", nullable = false, length = 100)
    private String entityType;
    @Column(name = "entity_id", nullable = false)
    private UUID entityId;
    @Column(name = "production_file_id")
    private UUID productionFileId;
    @Column(name = "action", nullable = false, length = 120)
    private String action;
    @Column(name = "details_json", columnDefinition = "text")
    private String detailsJson;
    @Column(name = "actor", nullable = false, length = 150)
    private String actor;
    @Column(name = "plant_code", length = 100)
    private String plantCode;
    @Column(name = "project_code", length = 150)
    private String projectCode;
    @Column(name = "drawing_no", length = 150)
    private String drawingNo;
    @Column(name = "action_at", nullable = false)
    private LocalDateTime actionAt;

    @PrePersist
    private void timestamp() { if (actionAt == null) actionAt = LocalDateTime.now(TimeZoneConfig.APP_ZONE); }
    public String getEntityType() { return entityType; }
    public void setEntityType(String value) { entityType = cleanUpper(value); }
    public UUID getEntityId() { return entityId; }
    public void setEntityId(UUID value) { entityId = value; }
    public UUID getProductionFileId() { return productionFileId; }
    public void setProductionFileId(UUID value) { productionFileId = value; }
    public String getAction() { return action; }
    public void setAction(String value) { action = cleanUpper(value); }
    public String getDetailsJson() { return detailsJson; }
    public void setDetailsJson(String value) { detailsJson = value; }
    public String getActor() { return actor; }
    public void setActor(String value) { actor = clean(value); }
    public String getPlantCode() { return plantCode; }
    public void setPlantCode(String value) { plantCode = cleanUpper(value); }
    public String getProjectCode() { return projectCode; }
    public void setProjectCode(String value) { projectCode = cleanUpper(value); }
    public String getDrawingNo() { return drawingNo; }
    public void setDrawingNo(String value) { drawingNo = cleanUpper(value); }
    public LocalDateTime getActionAt() { return actionAt; }
    public void setActionAt(LocalDateTime value) { actionAt = value; }
}
