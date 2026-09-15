package com.alsorg.packing.domain.matflow;

import com.alsorg.packing.domain.matflow.MatFlowControlTypes.BomStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.LocalDateTime;

@Entity
@Table(name = "mf_control_boms",
        uniqueConstraints = @UniqueConstraint(name = "uk_mf_control_bom_revision", columnNames = {"production_file_id", "revision_no"}),
        indexes = {
                @Index(name = "idx_mf_control_bom_number", columnList = "bom_number"),
                @Index(name = "idx_mf_control_bom_pf", columnList = "production_file_id"),
                @Index(name = "idx_mf_control_bom_status", columnList = "status")
        })
public class MatFlowBom extends MatFlowBaseEntity {

    @Column(name = "bom_number", nullable = false, length = 120)
    private String bomNumber;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "production_file_id", nullable = false)
    private MatFlowProductionFile productionFile;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "project_drawing_id", nullable = false)
    private MatFlowProjectDrawing projectDrawing;

    @Column(name = "revision_no", nullable = false)
    private Integer revisionNo = 1;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 40)
    private BomStatus status = BomStatus.DRAFT;

    @Column(name = "latest_revision", nullable = false)
    private boolean latestRevision = true;
    @Column(name = "remarks", columnDefinition = "text")
    private String remarks;
    @Column(name = "submitted_by", length = 150)
    private String submittedBy;
    @Column(name = "submitted_at")
    private LocalDateTime submittedAt;
    @Column(name = "released_by", length = 150)
    private String releasedBy;
    @Column(name = "released_at")
    private LocalDateTime releasedAt;

    public String getBomNumber() { return bomNumber; }
    public void setBomNumber(String value) { bomNumber = cleanUpper(value); }
    public MatFlowProductionFile getProductionFile() { return productionFile; }
    public void setProductionFile(MatFlowProductionFile value) { productionFile = value; }
    public MatFlowProjectDrawing getProjectDrawing() { return projectDrawing; }
    public void setProjectDrawing(MatFlowProjectDrawing value) { projectDrawing = value; }
    public Integer getRevisionNo() { return revisionNo; }
    public void setRevisionNo(Integer value) { revisionNo = value == null || value < 1 ? 1 : value; }
    public BomStatus getStatus() { return status; }
    public void setStatus(BomStatus value) { status = value == null ? BomStatus.DRAFT : value; }
    public boolean isLatestRevision() { return latestRevision; }
    public void setLatestRevision(boolean value) { latestRevision = value; }
    public String getRemarks() { return remarks; }
    public void setRemarks(String value) { remarks = clean(value); }
    public String getSubmittedBy() { return submittedBy; }
    public void setSubmittedBy(String value) { submittedBy = clean(value); }
    public LocalDateTime getSubmittedAt() { return submittedAt; }
    public void setSubmittedAt(LocalDateTime value) { submittedAt = value; }
    public String getReleasedBy() { return releasedBy; }
    public void setReleasedBy(String value) { releasedBy = clean(value); }
    public LocalDateTime getReleasedAt() { return releasedAt; }
    public void setReleasedAt(LocalDateTime value) { releasedAt = value; }
}
