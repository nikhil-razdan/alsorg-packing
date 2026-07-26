package com.alsorg.packing.domain.bomflow;

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

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(
        name = "bom_flow_revisions",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_bom_flow_revision_no",
                        columnNames = {
                                "bom_id",
                                "revision_no"
                        })
        },
        indexes = {
                @Index(
                        name = "idx_bom_flow_revision_bom",
                        columnList = "bom_id"),

                @Index(
                        name = "idx_bom_flow_revision_status",
                        columnList = "status"),

                @Index(
                        name = "idx_bom_flow_revision_released",
                        columnList = "released_at")
        })
public class BomFlowRevision {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    public UUID id;

    @Column(
            name = "bom_id",
            nullable = false)
    public UUID bomId;

    @Column(
            name = "revision_no",
            nullable = false)
    public Integer revisionNo;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "status",
            nullable = false,
            length = 50)
    public BomFlowStatus status =
            BomFlowStatus.DRAFT;

    /**
     * Reason for creating this revision.
     *
     * Revision 1 may use:
     * INITIAL_BOM
     */
    @Column(
            name = "revision_reason",
            length = 2000)
    public String revisionReason;

    @Column(
            name = "engineering_remarks",
            length = 3000)
    public String engineeringRemarks;

    /**
     * Optional generated or uploaded BOM document.
     */
    @Column(
            name = "bom_document_attachment_id")
    public UUID bomDocumentAttachmentId;

    /**
     * Optional drawing/document attachment.
     */
    @Column(
            name = "drawing_attachment_id")
    public UUID drawingAttachmentId;

    /**
     * Optional approved sample/reference attachment.
     */
    @Column(
            name = "sample_attachment_id")
    public UUID sampleAttachmentId;

    @Column(
            name = "prepared_by",
            nullable = false,
            length = 150)
    public String preparedBy;

    @Column(
            name = "prepared_at",
            nullable = false)
    public LocalDateTime preparedAt;

    @Column(
            name = "submitted_by",
            length = 150)
    public String submittedBy;

    @Column(
            name = "submitted_at")
    public LocalDateTime submittedAt;

    @Column(
            name = "approved_by",
            length = 150)
    public String approvedBy;

    @Column(
            name = "approved_at")
    public LocalDateTime approvedAt;

    @Column(
            name = "returned_by",
            length = 150)
    public String returnedBy;

    @Column(
            name = "returned_at")
    public LocalDateTime returnedAt;

    @Column(
            name = "return_remarks",
            length = 3000)
    public String returnRemarks;

    @Column(
            name = "released_by",
            length = 150)
    public String releasedBy;

    @Column(
            name = "released_at")
    public LocalDateTime releasedAt;

    @Column(
            name = "created_by",
            nullable = false,
            length = 150)
    public String createdBy;

    @Column(
            name = "created_at",
            nullable = false)
    public LocalDateTime createdAt;

    @Column(
            name = "updated_by",
            length = 150)
    public String updatedBy;

    @Column(
            name = "updated_at",
            nullable = false)
    public LocalDateTime updatedAt;

    @Version
    @Column(
            name = "row_version",
            nullable = false)
    public Long rowVersion;

    @PrePersist
    public void prePersist() {
        LocalDateTime now =
                LocalDateTime.now();

        if (preparedAt == null) {
            preparedAt = now;
        }

        if (createdAt == null) {
            createdAt = now;
        }

        updatedAt = now;

        if (revisionNo == null
                || revisionNo < 1) {

            revisionNo = 1;
        }

        if (status == null) {
            status = BomFlowStatus.DRAFT;
        }
    }

    @PreUpdate
    public void preUpdate() {
        updatedAt = LocalDateTime.now();
    }
}