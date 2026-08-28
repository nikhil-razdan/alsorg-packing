package com.alsorg.packing.domain.audit;

import com.alsorg.packing.config.TimeZoneConfig;
import com.alsorg.packing.domain.packet.Packet;
import com.fasterxml.jackson.annotation.JsonIgnore;

import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "sticker_audit")
public class StickerAudit {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    private String stickerNumber;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    private Packet packet;

    private String printedBy;
    private LocalDateTime printedAt;

    @PrePersist
    void onPrint() {
        if (printedAt == null) {
            printedAt = LocalDateTime.now(TimeZoneConfig.APP_ZONE);
        }
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public String getStickerNumber() { return stickerNumber; }
    public void setStickerNumber(String stickerNumber) { this.stickerNumber = stickerNumber; }
    public Packet getPacket() { return packet; }
    public void setPacket(Packet packet) { this.packet = packet; }
    public String getPrintedBy() { return printedBy; }
    public void setPrintedBy(String printedBy) { this.printedBy = printedBy; }
    public LocalDateTime getPrintedAt() { return printedAt; }
    public void setPrintedAt(LocalDateTime printedAt) { this.printedAt = printedAt; }
}
