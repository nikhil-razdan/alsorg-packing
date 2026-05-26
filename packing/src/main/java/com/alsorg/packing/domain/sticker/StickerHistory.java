package com.alsorg.packing.domain.sticker;

import java.time.LocalDateTime;
import java.util.UUID;

import com.alsorg.packing.domain.item.PacketItem;

import jakarta.persistence.*;

@Entity
@Table(
    name = "sticker_history",
    indexes = {
        @Index(
            name = "idx_sticker_packet_item",
            columnList = "packet_item_id"
        ),
        @Index(
            name = "idx_sticker_generated_at",
            columnList = "generated_at"
        )
    }
)
public class StickerHistory {
    @Id
    @GeneratedValue
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "packet_item_id")
    private PacketItem packetItem;

    @Column(nullable = false)
    private String stickerNumber;

    @Lob
    @Basic(fetch = FetchType.LAZY)
    @Column(name = "pdf_data")
    private byte[] pdfData;

    private Long printIteration;

    private String generatedBy;

    private String reason;

    private LocalDateTime generatedAt;

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public PacketItem getPacketItem() {
        return packetItem;
    }

    public void setPacketItem(PacketItem packetItem) {
        this.packetItem = packetItem;
    }

    public String getStickerNumber() {
        return stickerNumber;
    }

    public void setStickerNumber(String stickerNumber) {
        this.stickerNumber = stickerNumber;
    }

    public byte[] getPdfData() {
        return pdfData;
    }

    public void setPdfData(byte[] pdfData) {
        this.pdfData = pdfData;
    }

    public Long getPrintIteration() {
        return printIteration;
    }

    public void setPrintIteration(Long printIteration) {
        this.printIteration = printIteration;
    }

    public String getGeneratedBy() {
        return generatedBy;
    }

    public void setGeneratedBy(String generatedBy) {
        this.generatedBy = generatedBy;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }

    public LocalDateTime getGeneratedAt() {
        return generatedAt;
    }

    public void setGeneratedAt(LocalDateTime generatedAt) {
        this.generatedAt = generatedAt;
    }
}