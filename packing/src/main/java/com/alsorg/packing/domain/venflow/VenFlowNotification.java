package com.alsorg.packing.domain.venflow;

import jakarta.persistence.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(
        name = "ven_flow_notifications",
        indexes = {
                @Index(
                        name = "idx_vf_notification_user_read",
                        columnList = "recipient_username,is_read"
                ),
                @Index(
                        name = "idx_vf_notification_created",
                        columnList = "created_at"
                ),
                @Index(
                        name = "idx_vf_notification_entry",
                        columnList = "entry_id"
                )
        }
)
public class VenFlowNotification {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    public UUID id;

    @Column(name = "entry_id")
    public UUID entryId;

    @Column(name = "recipient_username", nullable = false)
    public String recipientUsername;

    @Column(name = "recipient_role")
    public String recipientRole;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    public VenFlowNotificationType type;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    public VenFlowNotificationSeverity severity;

    @Column(nullable = false, length = 500)
    public String title;

    @Column(nullable = false, length = 4000)
    public String message;

    @Column(name = "action_url", length = 1000)
    public String actionUrl;

    @Column(name = "action_required", nullable = false)
    public boolean actionRequired;

    @Column(name = "is_read", nullable = false)
    public boolean read;

    @Column(name = "read_at")
    public LocalDateTime readAt;

    @Column(name = "created_at", nullable = false)
    public LocalDateTime createdAt;

    @Column(name = "dedup_key", length = 500)
    public String dedupKey;

    @PrePersist
    public void prePersist() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }
}