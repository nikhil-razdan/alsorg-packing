package com.alsorg.packing.service;

import com.alsorg.packing.domain.venflow.VenFlowEntry;
import com.alsorg.packing.domain.venflow.VenFlowStage;
import com.alsorg.packing.repository.VenFlowEntryRepository;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Service
public class VenFlowDelayMonitor {

        private static final Logger log = LoggerFactory.getLogger(
                        VenFlowDelayMonitor.class);

        private final VenFlowEntryRepository entryRepo;
        private final VenFlowNotificationService notificationService;

        public VenFlowDelayMonitor(
                        VenFlowEntryRepository entryRepo,
                        VenFlowNotificationService notificationService) {
                this.entryRepo = entryRepo;
                this.notificationService = notificationService;
        }

        @Scheduled(fixedDelayString = "${venflow.alert-check-ms:3600000}", initialDelayString = "${venflow.alert-initial-delay-ms:60000}")
        public void checkDelays() {

                List<VenFlowEntry> entries = entryRepo.findAll();

                LocalDateTime now = LocalDateTime.now();
                LocalDate today = LocalDate.now();

                for (VenFlowEntry entry : entries) {
                        try {
                                inspectEntry(entry, now, today);
                        } catch (Exception ex) {
                                log.error(
                                                "Unable to inspect VenFlow delay for entry {}",
                                                entry == null ? null : entry.id,
                                                ex);
                        }
                }
        }

        private void inspectEntry(
                        VenFlowEntry entry,
                        LocalDateTime now,
                        LocalDate today) {
                if (entry == null
                                || entry.stage == null
                                || entry.stage == VenFlowStage.READY_FOR_NEXT_STAGE) {
                        return;
                }

                LocalDateTime enteredAt = entry.stageEnteredAt != null
                                ? entry.stageEnteredAt
                                : entry.updatedAt != null
                                                ? entry.updatedAt
                                                : entry.createdAt;

                long actualMinutes = 0L;

                if (enteredAt != null) {
                        actualMinutes = Math.max(
                                        Duration.between(
                                                        enteredAt,
                                                        now).toMinutes(),
                                        0L);
                }

                long allowedMinutes = slaMinutes(entry.stage);

                if (allowedMinutes > 0
                                && actualMinutes > allowedMinutes) {
                        notificationService
                                        .publishStageSlaBreach(
                                                        entry,
                                                        actualMinutes,
                                                        allowedMinutes);
                }

                if (entry.vendorExpectedDate != null
                                && entry.stage == VenFlowStage.ORDER_PLACED_WITH_VENDOR
                                && entry.vendorExpectedDate
                                                .isBefore(today)) {
                        notificationService
                                        .publishVendorDelay(entry);
                }

                if (entry.expectedDate != null
                                && entry.expectedDate
                                                .isBefore(today)) {
                        notificationService
                                        .publishMaterialDelay(entry);
                }
        }

        private long slaMinutes(
                        VenFlowStage stage) {
                if (stage == null) {
                        return 0L;
                }

                return switch (stage) {
                        case INDENT_CREATED ->
                                8 * 60L;

                        case SENT_TO_STORE ->
                                8 * 60L;

                        case STORE_REVIEWED,
                                        STOCK_AVAILABLE ->
                                8 * 60L;

                        case MATERIAL_RESERVED ->
                                8 * 60L;

                        case PURCHASE_REQUEST_RAISED ->
                                24 * 60L;

                        case PO_PENDING_DIRECTOR_APPROVAL ->
                                12 * 60L;

                        case PO_REJECTED_BY_DIRECTOR ->
                                12 * 60L;

                        case PO_APPROVED_BY_DIRECTOR ->
                                8 * 60L;

                        case ORDER_PLACED_WITH_VENDOR ->
                                0L;

                        case MATERIAL_RECEIVED_AT_STORE ->
                                8 * 60L;

                        case GRN_DONE,
                                        QC_PENDING ->
                                8 * 60L;

                        case QC_OK,
                                        MATERIAL_ACCEPTED_IN_STORE ->
                                8 * 60L;

                        case QC_NOT_OK,
                                        MATERIAL_REJECTED_HOLD_RETURN ->
                                24 * 60L;

                        case MATERIAL_ISSUED_TO_PRODUCTION ->
                                8 * 60L;

                        case PROCESSING_STARTED ->
                                24 * 60L;

                        case PROCESS_COMPLETED,
                                        SUPERVISOR_INFORMED ->
                                8 * 60L;

                        default ->
                                0L;
                };
        }
}