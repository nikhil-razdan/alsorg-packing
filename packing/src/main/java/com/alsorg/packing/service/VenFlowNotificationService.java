package com.alsorg.packing.service;

import com.alsorg.packing.domain.users.User;
import com.alsorg.packing.domain.venflow.VenFlowEntry;
import com.alsorg.packing.domain.venflow.VenFlowNotification;
import com.alsorg.packing.domain.venflow.VenFlowNotificationSeverity;
import com.alsorg.packing.domain.venflow.VenFlowNotificationType;
import com.alsorg.packing.repository.UserRepository;
import com.alsorg.packing.repository.VenFlowNotificationRepository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;

import org.springframework.http.HttpStatus;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.LinkedHashMap;
import java.util.Map;

@Service
@Transactional
public class VenFlowNotificationService {

        private final VenFlowNotificationRepository notificationRepo;
        private final UserRepository userRepo;
        private final VenFlowAccessService access;

        public VenFlowNotificationService(
                        VenFlowNotificationRepository notificationRepo,
                        UserRepository userRepo,
                        VenFlowAccessService access) {
                this.notificationRepo = notificationRepo;
                this.userRepo = userRepo;
                this.access = access;
        }

        /*
         * Temporary Director mapping:
         *
         * ADMIN users currently receive Director notifications.
         *
         * Later this can be extended to:
         * - ADMIN
         * - VENFLOW_DIRECTOR
         * - selected VENFLOW_MANAGER users
         */
        private List<User> directorUsers() {
                Map<String, User> users = new LinkedHashMap<>();

                for (String role : List.of(
                                "ADMIN",
                                "VENFLOW_DIRECTOR")) {
                        for (User user : userRepo.findAllByRoleIgnoreCase(
                                        role)) {
                                if (user != null
                                                && user.isEnabled()
                                                && hasText(
                                                                user.getUsername())) {
                                        users.put(
                                                        user.getUsername()
                                                                        .trim()
                                                                        .toLowerCase(),
                                                        user);
                                }
                        }
                }

                return List.copyOf(
                                users.values());
        }

        /*
         * =========================================================
         * GENERAL DIRECTOR ACTIVITY
         * =========================================================
         */

        public void publishDirectorActivity(
                        VenFlowEntry entry,
                        String action,
                        Object oldValue,
                        Object newValue,
                        String remarks,
                        String actor) {
                if (!isValidEntry(entry)) {
                        return;
                }

                String title = "VenFlow activity: "
                                + safe(entry.pdNo);

                String message = "PD: " + safe(entry.pdNo)
                                + " | Client: " + safe(entry.clientName)
                                + " | Material: " + safe(entry.materialName)
                                + " | Plant: " + safe(entry.plantCode)
                                + " | Action: " + safe(action)
                                + " | From: " + safe(oldValue)
                                + " | To: " + safe(newValue)
                                + " | Department: "
                                + safe(entry.currentDepartment)
                                + " | By: " + safe(actor)
                                + (hasText(remarks)
                                                ? " | Details: " + remarks.trim()
                                                : "");

                notifyDirectors(
                                entry,
                                VenFlowNotificationType.ACTIVITY,
                                VenFlowNotificationSeverity.INFO,
                                title,
                                message,
                                false,
                                null);
        }

        /*
         * =========================================================
         * DIRECTOR PO APPROVAL
         * =========================================================
         */

        public void publishPoApprovalRequired(
                        VenFlowEntry entry) {
                if (!isValidEntry(entry)) {
                        return;
                }

                String title = "PO approval required: "
                                + safe(entry.poNo);

                String message = "Purchase submitted PO "
                                + safe(entry.poNo)
                                + " for Director approval."
                                + " Vendor: " + safe(entry.vendorName)
                                + ", Amount: " + safe(entry.poAmount)
                                + ", PD: " + safe(entry.pdNo)
                                + ", Client: " + safe(entry.clientName)
                                + ", Material: " + safe(entry.materialName)
                                + ", Quantity: " + safe(entry.orderedQty)
                                + " " + safe(entry.unit)
                                + ", Plant: " + safe(entry.plantCode)
                                + ", Submitted by: "
                                + safe(entry.poApprovalRequestedBy)
                                + ".";

                String dedupKey = "PO_APPROVAL:"
                                + entry.id
                                + ":"
                                + safe(entry.poApprovalRequestedAt);

                notifyDirectors(
                                entry,
                                VenFlowNotificationType.PO_APPROVAL_REQUIRED,
                                VenFlowNotificationSeverity.ACTION_REQUIRED,
                                title,
                                message,
                                true,
                                dedupKey);
        }

        public void publishPoApproved(
                        VenFlowEntry entry) {
                if (!isValidEntry(entry)) {
                        return;
                }

                notifyDirectors(
                                entry,
                                VenFlowNotificationType.PO_APPROVED,
                                VenFlowNotificationSeverity.SUCCESS,
                                "PO approved: "
                                                + safe(entry.poNo),
                                "Director approved PO "
                                                + safe(entry.poNo)
                                                + ". Purchase must now place the approved order with "
                                                + safe(entry.vendorName)
                                                + ". Approved by: "
                                                + safe(entry.directorApprovedBy)
                                                + ".",
                                false,
                                "PO_APPROVED:"
                                                + entry.id
                                                + ":"
                                                + safe(entry.directorApprovedAt));
        }

        public void publishPoRejected(
                        VenFlowEntry entry) {
                if (!isValidEntry(entry)) {
                        return;
                }

                notifyDirectors(
                                entry,
                                VenFlowNotificationType.PO_REJECTED,
                                VenFlowNotificationSeverity.WARNING,
                                "PO returned to Purchase: "
                                                + safe(entry.poNo),
                                "PO "
                                                + safe(entry.poNo)
                                                + " was returned to Purchase."
                                                + " Reason: "
                                                + safe(entry.directorApprovalRemarks)
                                                + ". Returned by: "
                                                + safe(entry.directorRejectedBy)
                                                + ".",
                                false,
                                "PO_REJECTED:"
                                                + entry.id
                                                + ":"
                                                + safe(entry.directorRejectedAt));
        }

        /*
         * =========================================================
         * VENDOR ORDER
         * =========================================================
         */

        public void publishVendorOrderPlaced(
                        VenFlowEntry entry) {
                if (!isValidEntry(entry)) {
                        return;
                }

                notifyDirectors(
                                entry,
                                VenFlowNotificationType.VENDOR_ORDER_PLACED,
                                VenFlowNotificationSeverity.SUCCESS,
                                "Vendor order placed: "
                                                + safe(entry.poNo),
                                "Purchase placed the approved order with "
                                                + safe(entry.vendorName)
                                                + ". Vendor Order Reference: "
                                                + safe(entry.vendorOrderReference)
                                                + ". Expected Delivery: "
                                                + safe(entry.vendorExpectedDate)
                                                + ". Vendor Acknowledgement: "
                                                + safe(entry.vendorAcknowledgementNo)
                                                + ". Placed by: "
                                                + safe(entry.vendorOrderPlacedBy)
                                                + ".",
                                false,
                                "VENDOR_ORDER_PLACED:"
                                                + entry.id
                                                + ":"
                                                + safe(entry.vendorOrderPlacedAt));
        }

        public void publishVendorDelay(
                        VenFlowEntry entry) {
                if (!isValidEntry(entry)) {
                        return;
                }

                String dedupKey = "VENDOR_DELAY:"
                                + entry.id
                                + ":"
                                + safe(entry.vendorExpectedDate);

                String message = "Vendor delivery is overdue for PO "
                                + safe(entry.poNo)
                                + ". Vendor: "
                                + safe(entry.vendorName)
                                + ". Expected Date: "
                                + safe(entry.vendorExpectedDate)
                                + ". PD: "
                                + safe(entry.pdNo)
                                + ". Client: "
                                + safe(entry.clientName)
                                + ". Material: "
                                + safe(entry.materialName)
                                + ". Quantity: "
                                + safe(entry.orderedQty)
                                + " "
                                + safe(entry.unit)
                                + ".";

                notifyDirectors(
                                entry,

                                /*
                                 * Correct enum constant.
                                 */
                                VenFlowNotificationType.VENDOR_DELAYED,

                                VenFlowNotificationSeverity.CRITICAL,

                                "Vendor delivery overdue: "
                                                + safe(entry.poNo),

                                message,
                                true,
                                dedupKey);
        }

        /*
         * =========================================================
         * STORE RECEIVING
         * =========================================================
         */

        public void publishMaterialReceived(
                        VenFlowEntry entry) {
                if (!isValidEntry(entry)) {
                        return;
                }

                notifyDirectors(
                                entry,
                                VenFlowNotificationType.MATERIAL_RECEIVED,
                                VenFlowNotificationSeverity.INFO,
                                "Material received: "
                                                + safe(entry.pdNo),
                                "Store received "
                                                + safe(entry.receivedQty)
                                                + " "
                                                + safe(entry.unit)
                                                + " for PD "
                                                + safe(entry.pdNo)
                                                + ". GRN and QC are now pending."
                                                + " Received by: "
                                                + safe(entry.materialReceivedBy)
                                                + ".",
                                false,
                                "MATERIAL_RECEIVED:"
                                                + entry.id
                                                + ":"
                                                + safe(entry.materialReceivedAt));
        }

        /*
         * =========================================================
         * SLA AND DELAY NOTIFICATIONS
         * =========================================================
         */

        public void publishStageSlaBreach(
                        VenFlowEntry entry,
                        long actualMinutes,
                        long slaMinutes) {
                if (!isValidEntry(entry)
                                || entry.stage == null) {
                        return;
                }

                String dedupKey = "STAGE_SLA:"
                                + entry.id
                                + ":"
                                + entry.stage
                                + ":"
                                + safe(entry.stageEnteredAt);

                String message = "PD "
                                + safe(entry.pdNo)
                                + " has remained at stage "
                                + entry.stage
                                + " in department "
                                + safe(entry.currentDepartment)
                                + " for "
                                + actualMinutes
                                + " minutes."
                                + " Allowed SLA: "
                                + slaMinutes
                                + " minutes."
                                + " Current owner / last actor: "
                                + safe(entry.stageChangedBy)
                                + ".";

                notifyDirectors(
                                entry,

                                /*
                                 * Correct enum constant.
                                 */
                                VenFlowNotificationType.STAGE_SLA_BREACHED,

                                VenFlowNotificationSeverity.ACTION_REQUIRED,

                                "Stage SLA exceeded: "
                                                + safe(entry.pdNo),

                                message,
                                true,
                                dedupKey);
        }

        public void publishMaterialDelay(
                        VenFlowEntry entry) {
                if (!isValidEntry(entry)) {
                        return;
                }

                String dedupKey = "MATERIAL_DELAY:"
                                + entry.id
                                + ":"
                                + safe(entry.expectedDate)
                                + ":"
                                + safe(entry.stage);

                String message = "The overall expected date has crossed for PD "
                                + safe(entry.pdNo)
                                + ". Expected Date: "
                                + safe(entry.expectedDate)
                                + ". Current Stage: "
                                + safe(entry.stage)
                                + ". Current Department: "
                                + safe(entry.currentDepartment)
                                + ". Material: "
                                + safe(entry.materialName)
                                + ". Client: "
                                + safe(entry.clientName)
                                + ".";

                notifyDirectors(
                                entry,

                                /*
                                 * Correct enum constant.
                                 */
                                VenFlowNotificationType.MATERIAL_DELAYED,

                                VenFlowNotificationSeverity.WARNING,

                                "VenFlow requirement delayed: "
                                                + safe(entry.pdNo),

                                message,
                                true,
                                dedupKey);
        }

        /*
         * =========================================================
         * NOTIFICATION PERSISTENCE
         * =========================================================
         */

        private void notifyDirectors(
                        VenFlowEntry entry,
                        VenFlowNotificationType type,
                        VenFlowNotificationSeverity severity,
                        String title,
                        String message,
                        boolean actionRequired,
                        String dedupKey) {
                if (!isValidEntry(entry)) {
                        return;
                }

                for (User user : directorUsers()) {
                        String username = user.getUsername();

                        if (!hasText(username)) {
                                continue;
                        }

                        if (hasText(dedupKey)
                                        && notificationRepo
                                                        .existsByRecipientUsernameIgnoreCaseAndDedupKey(
                                                                        username,
                                                                        dedupKey)) {
                                continue;
                        }

                        VenFlowNotification notification = new VenFlowNotification();

                        notification.entryId = entry.id;

                        notification.recipientUsername = username;

                        /*
                         * Temporary Admin-as-Director implementation.
                         * Later this should use VENFLOW_DIRECTOR.
                         */
                        notification.recipientRole = user.getRole();

                        notification.type = type;

                        notification.severity = severity;

                        notification.title = title;

                        notification.message = message;

                        notification.actionRequired = actionRequired;

                        notification.actionUrl = "/venflow/entries/"
                                        + entry.id;

                        notification.dedupKey = dedupKey;

                        notification.read = false;

                        notification.createdAt = LocalDateTime.now();

                        notificationRepo.save(
                                        notification);
                }
        }

        public void publishQcFailure(
                        VenFlowEntry entry,
                        BigDecimal rejectedQty,
                        BigDecimal holdQty,
                        String reason) {
                if (!isValidEntry(entry)) {
                        return;
                }

                notifyDirectors(
                                entry,
                                VenFlowNotificationType.QC_FAILED,
                                VenFlowNotificationSeverity.WARNING,
                                "QC exception: "
                                                + safe(entry.pdNo),
                                "Rejected Qty: "
                                                + safe(rejectedQty)
                                                + " "
                                                + safe(entry.unit)
                                                + ", Hold Qty: "
                                                + safe(holdQty)
                                                + " "
                                                + safe(entry.unit)
                                                + ", Reason: "
                                                + safe(reason)
                                                + ".",
                                true,
                                "QC_FAILURE:"
                                                + entry.id
                                                + ":"
                                                + safe(entry.qcCheckedAt));
        }

        /*
         * =========================================================
         * CURRENT USER NOTIFICATIONS
         * =========================================================
         */

        @Transactional(readOnly = true)
        public Page<VenFlowNotification> myNotifications(
                        boolean unreadOnly,
                        int page,
                        int size) {
                String username = access.currentUser()
                                .getUsername();

                PageRequest pageable = PageRequest.of(
                                Math.max(page, 0),
                                Math.min(
                                                Math.max(size, 1),
                                                100));

                if (unreadOnly) {
                        return notificationRepo
                                        .findByRecipientUsernameIgnoreCaseAndReadFalseOrderByCreatedAtDesc(
                                                        username,
                                                        pageable);
                }

                return notificationRepo
                                .findByRecipientUsernameIgnoreCaseOrderByCreatedAtDesc(
                                                username,
                                                pageable);
        }

        @Transactional(readOnly = true)
        public long unreadCount() {
                return notificationRepo
                                .countByRecipientUsernameIgnoreCaseAndReadFalse(
                                                access.currentUser()
                                                                .getUsername());
        }

        public VenFlowNotification markRead(
                        UUID id) {
                String username = access.currentUser()
                                .getUsername();

                VenFlowNotification notification = notificationRepo
                                .findByIdAndRecipientUsernameIgnoreCase(
                                                id,
                                                username)
                                .orElseThrow(
                                                () -> new ResponseStatusException(
                                                                HttpStatus.NOT_FOUND,
                                                                "Notification not found."));

                if (!notification.read) {
                        notification.read = true;

                        notification.readAt = LocalDateTime.now();
                }

                return notificationRepo.save(
                                notification);
        }

        /*
         * =========================================================
         * HELPERS
         * =========================================================
         */

        private boolean isValidEntry(
                        VenFlowEntry entry) {
                return entry != null
                                && entry.id != null;
        }

        private boolean hasText(
                        String value) {
                return value != null
                                && !value.trim().isEmpty();
        }

        private String safe(
                        Object value) {
                if (value == null) {
                        return "-";
                }

                String text = String.valueOf(value)
                                .trim();

                return text.isEmpty()
                                ? "-"
                                : text;
        }
}