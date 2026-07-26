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
@Table(name = "mat_flow_indents", uniqueConstraints = {
        @UniqueConstraint(name = "uk_mat_flow_indent_no", columnNames = "indent_no")
}, indexes = {
        @Index(name = "idx_mfi_requisition", columnList = "requisition_id"),
        @Index(name = "idx_mfi_release", columnList = "release_id"),
        @Index(name = "idx_mfi_plant", columnList = "plant_code"),
        @Index(name = "idx_mfi_status", columnList = "status"),
        @Index(name = "idx_mfi_required_by", columnList = "required_by_date")
})
public class MatFlowIndent {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    public UUID id;

    @Column(name = "indent_no", nullable = false, length = 50)
    public String indentNo;

    @Column(name = "requisition_id", nullable = false)
    public UUID requisitionId;

    @Column(name = "release_id", nullable = false)
    public UUID releaseId;

    /*
     * Historical requisition snapshot.
     */
    @Column(name = "requisition_no", nullable = false, length = 50)
    public String requisitionNo;

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

    @Column(name = "production_department", length = 255)
    public String productionDepartment;

    @Column(name = "required_by_date", nullable = false)
    public LocalDate requiredByDate;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 50)
    public MatFlowIndentStatus status = MatFlowIndentStatus.DRAFT;

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
            status = MatFlowIndentStatus.DRAFT;
        }
    }

    @PreUpdate
    public void preUpdate() {
        updatedAt = LocalDateTime.now();
    }
}