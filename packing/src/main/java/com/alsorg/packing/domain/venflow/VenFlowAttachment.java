package com.alsorg.packing.domain.venflow;

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
import jakarta.persistence.Version;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(
        name = "ven_flow_attachments",
        indexes = {
                @Index(
                        name = "idx_vf_attachment_entry",
                        columnList = "entry_id"),

                @Index(
                        name = "idx_vf_attachment_entry_type",
                        columnList = "entry_id,attachment_type"),

                @Index(
                        name = "idx_vf_attachment_active",
                        columnList = "entry_id,active"),

                @Index(
                        name = "idx_vf_attachment_uploaded",
                        columnList = "uploaded_at")
        })
public class VenFlowAttachment {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    public UUID id;

    /**
     * VenFlow requirement to which this attachment belongs.
     */
    @Column(
            name = "entry_id",
            nullable = false)
    public UUID entryId;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "attachment_type",
            nullable = false,
            length = 100)
    public VenFlowAttachmentType type;

    /**
     * Original user-supplied file name.
     */
    @Column(
            name = "original_file_name",
            nullable = false,
            length = 500)
    public String originalFileName;

    /**
     * Server-generated physical file name.
     */
    @Column(
            name = "stored_file_name",
            nullable = false,
            length = 500)
    public String storedFileName;

    /**
     * Relative storage path.
     *
     * Do not store an absolute server path here.
     */
    @Column(
            name = "storage_key",
            nullable = false,
            length = 1500)
    public String storageKey;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "storage_provider",
            nullable = false,
            length = 100)
    public VenFlowAttachmentStorageProvider storageProvider =
            VenFlowAttachmentStorageProvider.LOCAL_FILESYSTEM;

    @Column(
            name = "content_type",
            length = 255)
    public String contentType;

    @Column(
            name = "file_size",
            nullable = false)
    public long fileSize;

    /**
     * SHA-256 hash of the uploaded file.
     */
    @Column(
            name = "checksum_sha256",
            nullable = false,
            length = 64)
    public String checksumSha256;

    @Column(
            name = "active",
            nullable = false)
    public boolean active = true;

    @Column(
            name = "uploaded_by",
            nullable = false,
            length = 150)
    public String uploadedBy;

    @Column(
            name = "uploaded_at",
            nullable = false)
    public LocalDateTime uploadedAt;

    @Column(
            name = "deactivated_by",
            length = 150)
    public String deactivatedBy;

    @Column(
            name = "deactivated_at")
    public LocalDateTime deactivatedAt;

    @Column(
            name = "deactivation_reason",
            length = 2000)
    public String deactivationReason;

    @Version
    @Column(
            name = "row_version",
            nullable = false)
    public Long rowVersion;

    @PrePersist
    public void prePersist() {
        if (uploadedAt == null) {
            uploadedAt = LocalDateTime.now();
        }

        if (storageProvider == null) {
            storageProvider =
                    VenFlowAttachmentStorageProvider.LOCAL_FILESYSTEM;
        }
    }

    @PreUpdate
    public void preUpdate() {
        if (!active && deactivatedAt == null) {
            deactivatedAt = LocalDateTime.now();
        }
    }
}