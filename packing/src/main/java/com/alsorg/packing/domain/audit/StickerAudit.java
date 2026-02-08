package com.alsorg.packing.domain.audit;

import com.alsorg.packing.domain.packet.Packet;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "sticker_audit")
public class StickerAudit {

    @Id
    @GeneratedValue
    private UUID id;

    private String stickerNumber;

    @ManyToOne
    private Packet packet;

    private String printedBy;
    private LocalDateTime printedAt;

    @PrePersist
    void onPrint() {
        this.setPrintedAt(LocalDateTime.now());
    }

    public String getStickerNumber() {
        return stickerNumber;
    }

    public void setStickerNumber(String stickerNumber) {
        this.stickerNumber = stickerNumber;
    }

    public String getPrintedBy() {
        return printedBy;
    }

    public void setPrintedBy(String printedBy) {
        this.printedBy = printedBy;
    }

    public LocalDateTime getPrintedAt() {
        return printedAt;
    }

    public void setPrintedAt(LocalDateTime printedAt) {
        this.printedAt = printedAt;
    }
}
