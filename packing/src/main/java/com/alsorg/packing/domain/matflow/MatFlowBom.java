package com.alsorg.packing.domain.matflow;

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
import java.util.UUID;

@Entity
@Table(name = "mf_boms", uniqueConstraints = {
        @UniqueConstraint(name = "uk_mf_bom_revision", columnNames = {
                "revision_group_id",
                "revision_no"
        })
}, indexes = {
        @Index(name = "idx_mf_bom_number", columnList = "bom_number"),
        @Index(name = "idx_mf_bom_group", columnList = "revision_group_id"),
        @Index(name = "idx_mf_bom_status", columnList = "status"),
        @Index(name = "idx_mf_bom_latest", columnList = "latest_revision"),
        @Index(name = "idx_mf_bom_effective", columnList = "effective"),
        @Index(name = "idx_mf_bom_project", columnList = "project_drawing_id")
})
public class MatFlowBom extends MatFlowBaseEntity {

    @Column(name = "bom_number", nullable = false, length = 100)
    private String bomNumber;

    @Column(name = "revision_group_id", nullable = false)
    private UUID revisionGroupId;

    @Column(name = "revision_no", nullable = false)
    private Integer revisionNo = 0;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "project_drawing_id", nullable = false)
    private MatFlowProjectDrawing projectDrawing;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 40)
    private MatFlowBomStatus status = MatFlowBomStatus.DRAFT;

    @Column(name = "latest_revision", nullable = false)
    private boolean latestRevision = true;

    @Column(name = "effective", nullable = false)
    private boolean effective = false;

    @Column(name = "remarks", columnDefinition = "text")
    private String remarks;

    @Column(name = "submitted_by", length = 150)
    private String submittedBy;

    @Column(name = "submitted_at")
    private LocalDateTime submittedAt;

    @Column(name = "approved_by", length = 150)
    private String approvedBy;

    @Column(name = "approved_at")
    private LocalDateTime approvedAt;

    @Column(name = "returned_by", length = 150)
    private String returnedBy;

    @Column(name = "returned_at")
    private LocalDateTime returnedAt;

    @Column(name = "return_remarks", columnDefinition = "text")
    private String returnRemarks;

    @Column(name = "hod_approved_by", length = 150)
    private String hodApprovedBy;

    @Column(name = "hod_approved_at")
    private LocalDateTime hodApprovedAt;

    @Column(name = "production_reviewed_by", length = 150)
    private String productionReviewedBy;

    @Column(name = "production_reviewed_at")
    private LocalDateTime productionReviewedAt;

    @Column(name = "production_review_remarks", columnDefinition = "text")
    private String productionReviewRemarks;

    public String getBomNumber() {
        return bomNumber;
    }

    public void setBomNumber(String bomNumber) {
        this.bomNumber = cleanUpper(bomNumber);
    }

    public UUID getRevisionGroupId() {
        return revisionGroupId;
    }

    public void setRevisionGroupId(
            UUID revisionGroupId) {
        this.revisionGroupId = revisionGroupId;
    }

    public Integer getRevisionNo() {
        return revisionNo;
    }

    public void setRevisionNo(
            Integer revisionNo) {
        this.revisionNo = revisionNo == null
                ? 0
                : revisionNo;
    }

    public MatFlowProjectDrawing getProjectDrawing() {
        return projectDrawing;
    }

    public void setProjectDrawing(
            MatFlowProjectDrawing projectDrawing) {
        this.projectDrawing = projectDrawing;
    }

    public MatFlowBomStatus getStatus() {
        return status;
    }

    public void setStatus(
            MatFlowBomStatus status) {
        this.status = status;
    }

    public boolean isLatestRevision() {
        return latestRevision;
    }

    public void setLatestRevision(
            boolean latestRevision) {
        this.latestRevision = latestRevision;
    }

    public boolean isEffective() {
        return effective;
    }

    public void setEffective(boolean effective) {
        this.effective = effective;
    }

    public String getRemarks() {
        return remarks;
    }

    public void setRemarks(String remarks) {
        this.remarks = clean(remarks);
    }

    public String getSubmittedBy() {
        return submittedBy;
    }

    public void setSubmittedBy(
            String submittedBy) {
        this.submittedBy = clean(submittedBy);
    }

    public LocalDateTime getSubmittedAt() {
        return submittedAt;
    }

    public void setSubmittedAt(
            LocalDateTime submittedAt) {
        this.submittedAt = submittedAt;
    }

    public String getApprovedBy() {
        return approvedBy;
    }

    public void setApprovedBy(
            String approvedBy) {
        this.approvedBy = clean(approvedBy);
    }

    public LocalDateTime getApprovedAt() {
        return approvedAt;
    }

    public void setApprovedAt(
            LocalDateTime approvedAt) {
        this.approvedAt = approvedAt;
    }

    public String getReturnedBy() {
        return returnedBy;
    }

    public void setReturnedBy(
            String returnedBy) {
        this.returnedBy = clean(returnedBy);
    }

    public LocalDateTime getReturnedAt() {
        return returnedAt;
    }

    public void setReturnedAt(
            LocalDateTime returnedAt) {
        this.returnedAt = returnedAt;
    }

    public String getReturnRemarks() {
        return returnRemarks;
    }

    public void setReturnRemarks(
            String returnRemarks) {
        this.returnRemarks = clean(returnRemarks);
    }

    public String getHodApprovedBy() {
        return hodApprovedBy;
    }

    public void setHodApprovedBy(String hodApprovedBy) {
        this.hodApprovedBy = hodApprovedBy;
    }

    public LocalDateTime getHodApprovedAt() {
        return hodApprovedAt;
    }

    public void setHodApprovedAt(LocalDateTime hodApprovedAt) {
        this.hodApprovedAt = hodApprovedAt;
    }

    public String getProductionReviewedBy() {
        return productionReviewedBy;
    }

    public void setProductionReviewedBy(String productionReviewedBy) {
        this.productionReviewedBy = productionReviewedBy;
    }

    public LocalDateTime getProductionReviewedAt() {
        return productionReviewedAt;
    }

    public void setProductionReviewedAt(
            LocalDateTime productionReviewedAt) {
        this.productionReviewedAt = productionReviewedAt;
    }

    public String getProductionReviewRemarks() {
        return productionReviewRemarks;
    }

    public void setProductionReviewRemarks(
            String productionReviewRemarks) {
        this.productionReviewRemarks = productionReviewRemarks;
    }
}