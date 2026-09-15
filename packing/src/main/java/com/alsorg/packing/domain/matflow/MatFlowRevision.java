package com.alsorg.packing.domain.matflow;

import com.alsorg.packing.domain.matflow.MatFlowControlTypes.RevisionStatus;
import com.alsorg.packing.domain.matflow.MatFlowControlTypes.RevisionType;
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
@Table(name = "mf_revisions",
        uniqueConstraints = @UniqueConstraint(name = "uk_mf_revision", columnNames = {"production_file_id", "revision_type", "revision_no"}),
        indexes = {
                @Index(name = "idx_mf_revision_pf", columnList = "production_file_id"),
                @Index(name = "idx_mf_revision_active", columnList = "revision_type, revision_status")
        })
public class MatFlowRevision extends MatFlowBaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "production_file_id", nullable = false)
    private MatFlowProductionFile productionFile;

    @Enumerated(EnumType.STRING)
    @Column(name = "revision_type", nullable = false, length = 40)
    private RevisionType revisionType;

    @Column(name = "revision_no", nullable = false, length = 60)
    private String revisionNo;

    @Enumerated(EnumType.STRING)
    @Column(name = "revision_status", nullable = false, length = 40)
    private RevisionStatus revisionStatus = RevisionStatus.DRAFT;

    @Column(name = "original_file_name", nullable = false, length = 255)
    private String originalFileName;
    @Column(name = "content_type", nullable = false, length = 150)
    private String contentType;
    @Column(name = "storage_path", nullable = false, length = 700)
    private String storagePath;
    @Column(name = "size_bytes", nullable = false)
    private Long sizeBytes;

    @Column(name = "change_summary", columnDefinition = "text")
    private String changeSummary;
    @Column(name = "impact_note", columnDefinition = "text")
    private String impactNote;
    @Column(name = "impact_reviewed_by", length = 150)
    private String impactReviewedBy;
    @Column(name = "impact_reviewed_at")
    private LocalDateTime impactReviewedAt;
    @Column(name = "activated_at")
    private LocalDateTime activatedAt;
    @Column(name = "superseded_at")
    private LocalDateTime supersededAt;

    public MatFlowProductionFile getProductionFile() { return productionFile; }
    public void setProductionFile(MatFlowProductionFile value) { productionFile = value; }
    public RevisionType getRevisionType() { return revisionType; }
    public void setRevisionType(RevisionType value) { revisionType = value; }
    public String getRevisionNo() { return revisionNo; }
    public void setRevisionNo(String value) { revisionNo = cleanUpper(value); }
    public RevisionStatus getRevisionStatus() { return revisionStatus; }
    public void setRevisionStatus(RevisionStatus value) { revisionStatus = value == null ? RevisionStatus.DRAFT : value; }
    public String getOriginalFileName() { return originalFileName; }
    public void setOriginalFileName(String value) { originalFileName = clean(value); }
    public String getContentType() { return contentType; }
    public void setContentType(String value) { contentType = clean(value); }
    public String getStoragePath() { return storagePath; }
    public void setStoragePath(String value) { storagePath = clean(value); }
    public Long getSizeBytes() { return sizeBytes; }
    public void setSizeBytes(Long value) { sizeBytes = value; }
    public String getChangeSummary() { return changeSummary; }
    public void setChangeSummary(String value) { changeSummary = clean(value); }
    public String getImpactNote() { return impactNote; }
    public void setImpactNote(String value) { impactNote = clean(value); }
    public String getImpactReviewedBy() { return impactReviewedBy; }
    public void setImpactReviewedBy(String value) { impactReviewedBy = clean(value); }
    public LocalDateTime getImpactReviewedAt() { return impactReviewedAt; }
    public void setImpactReviewedAt(LocalDateTime value) { impactReviewedAt = value; }
    public LocalDateTime getActivatedAt() { return activatedAt; }
    public void setActivatedAt(LocalDateTime value) { activatedAt = value; }
    public LocalDateTime getSupersededAt() { return supersededAt; }
    public void setSupersededAt(LocalDateTime value) { supersededAt = value; }
}
