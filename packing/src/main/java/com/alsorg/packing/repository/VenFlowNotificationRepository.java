package com.alsorg.packing.repository;

import com.alsorg.packing.domain.venflow.VenFlowNotification;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface VenFlowNotificationRepository
        extends JpaRepository<VenFlowNotification, UUID> {

    Page<VenFlowNotification>
    findByRecipientUsernameIgnoreCaseOrderByCreatedAtDesc(
            String recipientUsername,
            Pageable pageable
    );

    Page<VenFlowNotification>
    findByRecipientUsernameIgnoreCaseAndReadFalseOrderByCreatedAtDesc(
            String recipientUsername,
            Pageable pageable
    );

    long countByRecipientUsernameIgnoreCaseAndReadFalse(
            String recipientUsername
    );

    Optional<VenFlowNotification>
    findByIdAndRecipientUsernameIgnoreCase(
            UUID id,
            String recipientUsername
    );

    boolean existsByRecipientUsernameIgnoreCaseAndDedupKey(
            String recipientUsername,
            String dedupKey
    );
}