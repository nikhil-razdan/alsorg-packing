package com.alsorg.packing.domain.matflow;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.persistence.Version;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "mat_flow_requisitions", uniqueConstraints = {
        @UniqueConstraint(name = "uk_matflow_requisition_no", columnNames = "requisition_no")
}, indexes = {
        @Index(name = "idx_mfr_release", columnList = "release_id"),
        @Index(name = "idx_mfr_status", columnList = "status"),
        @Index(name = "idx_mfr_plant", columnList = "plant_code"),
        @Index(name = "idx_mfr_pd_no", columnList = "pd_no"),
        @Index(name = "idx_mfr_required_by", columnList = "required_by_date"),
        @Index(name = "idx_mfr_submitted_at", columnList = "submitted_at")
})
public class MatFlowRequisition {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    public UUID id;

    /*
     * Generated business reference such as:
     * MREQ-2026-000001
     */
    @Column(name = "requisition_no", nullable = false, length = 50)
    public String requisitionNo;

    /*
     * The ACTIVE MatFlow release against which Production is
     * requesting materials.
     */
    @Column(name = "release_id", nullable = false)
    public UUID releaseId;

    /*
     * Release header snapshot.
     *
     * These values intentionally remain on the requisition so
     * historical records do not change if the original BOM is
     * revised later.
     */
    @Column(name = "plant_code", nullable = false, length = 100)
    public String plantCode;

    @Column(name = "pd_no", nullable = false, length = 255)
    public String pdNo;

    @Column(name = "drawing_no", length = 255)
    public String drawingNo;

    @Column(name = "project_code", length = 255)
    public String projectCode;

    @Column(name = "client_name", length = 500)
    public String clientName;

    @Column(name = "product_name", length = 500)
    public String productName;

    @Column(name = "product_code", length = 255)
    public String productCode;

    /*
     * The date by which Production requires the materials.
     */
    @Column(name = "required_by_date", nullable = false)
    public LocalDate requiredByDate;

    /*
     * Example:
     * - CARPENTRY
     * - METAL
     * - UPHOLSTERY
     * - ASSEMBLY
     */
    @Column(name = "production_department", nullable = false, length = 255)
    public String productionDepartment;

    /*
     * Responsible person, supervisor, work centre or team.
     */
    @Column(name = "requested_for", nullable = false, length = 255)
    public String requestedFor;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 50)
    public MatFlowRequisitionStatus status = MatFlowRequisitionStatus.DRAFT;

    @Column(name = "created_by", nullable = false, length = 255)
    public String createdBy;

    @Column(name = "created_at", nullable = false)
    public LocalDateTime createdAt;

    @Column(name = "submitted_by", length = 255)
    public String submittedBy;

    @Column(name = "submitted_at")
    public LocalDateTime submittedAt;

    @Column(name = "returned_by", length = 255)
    public String returnedBy;

    @Column(name = "returned_at")
    public LocalDateTime returnedAt;

    @Column(name = "return_remarks", length = 2000)
    public String returnRemarks;

    @Column(name = "cancelled_by", length = 255)
    public String cancelledBy;

    @Column(name = "cancelled_at")
    public LocalDateTime cancelledAt;

    @Column(name = "remarks", length = 2000)
    public String remarks;

    @Column(name = "updated_by", length = 255)
    public String updatedBy;

    @Column(name = "updated_at", nullable = false)
    public LocalDateTime updatedAt;

    @Version
    @Column(name = "row_version", nullable = false)
    public Long rowVersion;

    @PrePersist
    public void prePersist() {
        LocalDateTime now = LocalDateTime.now();

        if (createdAt == null) {
            createdAt = now;
        }

        updatedAt = now;

        if (status == null) {
            status = MatFlowRequisitionStatus.DRAFT;
        }
    }

    @PreUpdate
    public void preUpdate() {
        updatedAt = LocalDateTime.now();
    }
}