package com.alsorg.packing.domain.packet;

import com.alsorg.packing.domain.common.Company;
import com.alsorg.packing.domain.common.PacketStatus;
import com.alsorg.packing.domain.item.PacketItem;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;

@Entity
@Table(name = "packets")
public class Packet {

    @Id
    private UUID id;

    @ManyToOne
    @JoinColumn(name = "company_id", nullable = false)
    private Company company;

    @Column(nullable = false, unique = true)
    private String stickerNumber;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PacketStatus status;

    private String createdBy;
    private LocalDateTime createdAt;

    @OneToMany(
            mappedBy = "packet",
            cascade = CascadeType.ALL,
            orphanRemoval = true,
            fetch = FetchType.LAZY)
    private List<PacketItem> items = new ArrayList<>();

    @Column(nullable = false)
    private Boolean stickerGenerated = false;

    @Column(name = "sticker_path")
    private String stickerPath;

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public Company getCompany() { return company; }
    public void setCompany(Company company) { this.company = company; }
    public String getStickerNumber() { return stickerNumber; }
    public void setStickerNumber(String stickerNumber) { this.stickerNumber = stickerNumber; }
    public PacketStatus getStatus() { return status; }
    public void setStatus(PacketStatus status) { this.status = status; }
    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public List<PacketItem> getItems() {
        if (items == null) items = new ArrayList<>();
        return items;
    }

    public void setItems(List<PacketItem> items) {
        List<PacketItem> incoming = items == null
                ? List.of()
                : new ArrayList<>(items);

        List<PacketItem> target = getItems();
        target.clear();

        for (PacketItem item : incoming) {
            addItem(item);
        }
    }

    public void addItem(PacketItem item) {
        if (item == null) return;
        item.setPacket(this);
        getItems().add(item);
    }

    public int getTotalQuantity() {
        return getItems().stream()
                .filter(java.util.Objects::nonNull)
                .map(PacketItem::getQuantity)
                .filter(java.util.Objects::nonNull)
                .mapToInt(Integer::intValue)
                .sum();
    }

    public Boolean getStickerGenerated() { return stickerGenerated; }
    public void setStickerGenerated(boolean stickerGenerated) { this.stickerGenerated = stickerGenerated; }
    public void setStickerGenerated(Boolean stickerGenerated) { this.stickerGenerated = Boolean.TRUE.equals(stickerGenerated); }
    public String getStickerPath() { return stickerPath; }
    public void setStickerPath(String stickerPath) { this.stickerPath = stickerPath; }
}
