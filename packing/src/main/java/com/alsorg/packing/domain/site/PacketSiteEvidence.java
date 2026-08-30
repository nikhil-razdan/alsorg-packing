package com.alsorg.packing.domain.site;

import java.time.LocalDateTime;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

@Entity
@Table(
        name = "packet_site_evidence",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_packet_site_evidence_stage_ordinal",
                        columnNames = { "lifecycle_id", "stage", "ordinal_no" })
        },
        indexes = {
                @Index(
                        name = "idx_packet_site_evidence_lifecycle_stage",
                        columnList = "lifecycle_id,stage")
        })
public class PacketSiteEvidence {

    @Id
    private UUID id;

    @Column(name = "lifecycle_id", nullable = false)
    private UUID lifecycleId;

    @Enumerated(EnumType.STRING)
    @Column(name = "stage", nullable = false, length = 30)
    private SiteEvidenceStage stage;

    @Column(name = "ordinal_no", nullable = false)
    private Integer ordinal;

    @Column(name = "content_type", nullable = false, length = 100)
    private String contentType;

    @Column(name = "original_name", length = 500)
    private String originalName;

    @Column(name = "size_bytes", nullable = false)
    private Long sizeBytes;

    @Column(name = "sha256", nullable = false, length = 64)
    private String sha256;

    /* PostgreSQL bytea: do not use @Lob here because Hibernate may map it to an OID large object. */
    @Column(name = "file_data", nullable = false, columnDefinition = "bytea")
    private byte[] fileData;

    @Column(name = "captured_by", nullable = false, length = 180)
    private String capturedBy;

    @Column(name = "captured_at", nullable = false)
    private LocalDateTime capturedAt;

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getLifecycleId() { return lifecycleId; }
    public void setLifecycleId(UUID lifecycleId) { this.lifecycleId = lifecycleId; }
    public SiteEvidenceStage getStage() { return stage; }
    public void setStage(SiteEvidenceStage stage) { this.stage = stage; }
    public Integer getOrdinal() { return ordinal; }
    public void setOrdinal(Integer ordinal) { this.ordinal = ordinal; }
    public String getContentType() { return contentType; }
    public void setContentType(String contentType) { this.contentType = contentType; }
    public String getOriginalName() { return originalName; }
    public void setOriginalName(String originalName) { this.originalName = originalName; }
    public Long getSizeBytes() { return sizeBytes; }
    public void setSizeBytes(Long sizeBytes) { this.sizeBytes = sizeBytes; }
    public String getSha256() { return sha256; }
    public void setSha256(String sha256) { this.sha256 = sha256; }
    public byte[] getFileData() { return fileData; }
    public void setFileData(byte[] fileData) { this.fileData = fileData; }
    public String getCapturedBy() { return capturedBy; }
    public void setCapturedBy(String capturedBy) { this.capturedBy = capturedBy; }
    public LocalDateTime getCapturedAt() { return capturedAt; }
    public void setCapturedAt(LocalDateTime capturedAt) { this.capturedAt = capturedAt; }
}
