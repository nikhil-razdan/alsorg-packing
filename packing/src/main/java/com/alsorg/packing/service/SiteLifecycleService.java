package com.alsorg.packing.service;

import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import com.alsorg.packing.config.TimeZoneConfig;
import com.alsorg.packing.controller.dto.site.SiteLifecycleMetadataRow;
import com.alsorg.packing.controller.dto.site.SiteLifecycleRow;
import com.alsorg.packing.domain.common.ItemDispatchStatus;
import com.alsorg.packing.domain.dispatch.DispatchedItem;
import com.alsorg.packing.domain.item.PacketItem;
import com.alsorg.packing.domain.site.PacketSiteEvidence;
import com.alsorg.packing.domain.site.PacketSiteLifecycle;
import com.alsorg.packing.domain.site.SiteEvidenceStage;
import com.alsorg.packing.domain.site.SiteLifecycleStatus;
import com.alsorg.packing.domain.users.User;
import com.alsorg.packing.repository.DispatchedItemRepository;
import com.alsorg.packing.repository.PacketItemRepository;
import com.alsorg.packing.repository.PacketSiteEvidenceRepository;
import com.alsorg.packing.repository.PacketSiteLifecycleRepository;

import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import jakarta.persistence.PersistenceContext;

@Service
public class SiteLifecycleService {

    private static final java.time.ZoneId APP_ZONE = TimeZoneConfig.APP_ZONE;
    /*
     * Keep evidence payloads below the application's existing 10 MB multipart
     * request ceiling, leaving headroom for multipart boundaries/form fields.
     */
    private static final long MAX_IMAGE_BYTES = 4L * 1024L * 1024L;
    private static final long MAX_DELIVERY_TOTAL_BYTES = 8L * 1024L * 1024L;
    private static final long MAX_OPENING_TOTAL_BYTES = 6L * 1024L * 1024L;
    private static final int MAX_DELIVERY_PHOTOS = 4;
    private static final int MAX_OPENING_PHOTOS = 2;
    private static final int MAX_METADATA_IDS = 500;
    private static final int MAX_REGISTER_PAGE_SIZE = 100;
    private static final double MAX_ACCEPTABLE_ACCURACY_METRES = 500.0d;

    private final PacketSiteLifecycleRepository lifecycleRepository;
    private final PacketSiteEvidenceRepository evidenceRepository;
    private final PacketItemRepository packetItemRepository;
    private final DispatchedItemRepository dispatchedItemRepository;
    private final ScannerDispatchService scannerDispatchService;
    private final DispatchedItemService dispatchedItemService;
    private final CurrentUserService currentUserService;
    private final AuditLogService auditLogService;
    private final ActivityLogService activityLogService;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private UtlWorkflowService utlWorkflowService;

    @PersistenceContext
    private EntityManager entityManager;

    public SiteLifecycleService(
            PacketSiteLifecycleRepository lifecycleRepository,
            PacketSiteEvidenceRepository evidenceRepository,
            PacketItemRepository packetItemRepository,
            DispatchedItemRepository dispatchedItemRepository,
            ScannerDispatchService scannerDispatchService,
            DispatchedItemService dispatchedItemService,
            CurrentUserService currentUserService,
            AuditLogService auditLogService,
            ActivityLogService activityLogService) {
        this.lifecycleRepository = lifecycleRepository;
        this.evidenceRepository = evidenceRepository;
        this.packetItemRepository = packetItemRepository;
        this.dispatchedItemRepository = dispatchedItemRepository;
        this.scannerDispatchService = scannerDispatchService;
        this.dispatchedItemService = dispatchedItemService;
        this.currentUserService = currentUserService;
        this.auditLogService = auditLogService;
        this.activityLogService = activityLogService;
    }

    @Transactional(readOnly = true)
    public SiteLifecycleRow resolve(
            String rawScanText,
            String mode,
            User user) {
        User actor = requireUser(user);
        ScannerDispatchService.SiteScanResolution scan =
                scannerDispatchService.resolveForSiteLifecycle(rawScanText);
        DispatchedItem item = dispatchedItemRepository.findById(scan.zohoItemId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Dispatch record not found for scanned packet"));
        PacketItem packetItem = packetItemRepository.findById(scan.packetItemId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Packet item not found"));

        assertSiteLifecycleEligible(item);
        assertResolvePermission(actor, item, mode);

        PacketSiteLifecycle lifecycle = lifecycleRepository
                .findByPacketItemId(packetItem.getId())
                .orElse(null);

        return toRow(item, packetItem, lifecycle, true);
    }

    @Transactional
    public SiteLifecycleRow deliver(
            String rawScanText,
            Double latitude,
            Double longitude,
            Double accuracy,
            String receiverName,
            String receiverPhone,
            String remarks,
            List<MultipartFile> photos,
            User user) {
        User actor = requireUser(user);

        if (!currentUserService.isDriver(actor) && !currentUserService.isAdmin(actor)) {
            throw new AccessDeniedException(
                    "Site delivery proof requires the assigned DRIVER account");
        }

        ScannerDispatchService.SiteScanResolution scan =
                scannerDispatchService.resolveForSiteLifecycle(rawScanText);

        DispatchedItem item = dispatchedItemRepository
                .findByIdForLifecycleUpdate(scan.zohoItemId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Dispatch record not found for scanned packet"));

        PacketItem packetItem = packetItemRepository.findById(scan.packetItemId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Packet item not found"));

        assertSiteLifecycleEligible(item);
        assertDriverAssignment(actor, item);

        PacketSiteLifecycle existing = lifecycleRepository
                .findByPacketItemId(packetItem.getId())
                .orElse(null);

        /*
         * Network-safe idempotency: once delivery proof committed, a mobile retry
         * returns the existing proof rather than duplicating evidence or timestamps.
         */
        if (existing != null && existing.getDeliveredAt() != null) {
            return toRow(item, packetItem, existing, true);
        }

        validateCoordinates(latitude, longitude, accuracy);
        List<ValidatedImage> images = validateImages(
                photos,
                1,
                MAX_DELIVERY_PHOTOS,
                MAX_DELIVERY_TOTAL_BYTES,
                "Delivery");

        LocalDateTime now = LocalDateTime.now(APP_ZONE);
        String username = safeActor(actor.getUsername());

        PacketSiteLifecycle lifecycle = existing != null
                ? existing
                : new PacketSiteLifecycle();

        if (lifecycle.getId() == null) {
            lifecycle.setId(UUID.randomUUID());
            lifecycle.setPacketItemId(packetItem.getId());
            lifecycle.setZohoItemId(item.getZohoItemId());
            lifecycle.setCreatedAt(now);
        }

        lifecycle.setChallanNumber(clean(item.getChalaanNumber(), 255));
        lifecycle.setSiteStatus(SiteLifecycleStatus.DELIVERED);
        lifecycle.setDeliveredAt(now);
        lifecycle.setDeliveredBy(username);
        lifecycle.setDeliveryLatitude(latitude);
        lifecycle.setDeliveryLongitude(longitude);
        lifecycle.setDeliveryAccuracy(accuracy);
        lifecycle.setReceiverName(clean(receiverName, 300));
        lifecycle.setReceiverPhone(clean(receiverPhone, 100));
        lifecycle.setDeliveryRemarks(clean(remarks, 2000));
        lifecycle.setUpdatedAt(now);
        lifecycle = lifecycleRepository.saveAndFlush(lifecycle);

        saveEvidence(lifecycle, SiteEvidenceStage.DELIVERY, images, username, now);

        /*
         * Compatibility fields remain useful to existing reports/admin tools.
         * IMPORTANT: core status remains DISPATCHED. Existing challan history and
         * outbound registers key off that status, so site proof is deliberately
         * modeled as an additive siteStatus rather than a replacement factory state.
         */
        item.setDeliveredAt(now);
        item.setReceiverName(clean(receiverName, 300));
        item.setReceiverPhone(clean(receiverPhone, 100));
        item.setDeliveryLatitude(latitude);
        item.setDeliveryLongitude(longitude);
        item.setDeliveryLocationAccuracy(accuracy);
        item.setDeliveryRemarks(clean(remarks, 1500));
        dispatchedItemRepository.save(item);

        auditLogService.log(
                item.getZohoItemId(),
                "Packet delivered on site with QR + photo + GPS proof | Challan: "
                        + safe(item.getChalaanNumber()),
                username,
                "SITE_DELIVERY");

        activityLogService.log(
                item.getZohoItemId(),
                "SITE DELIVERED",
                username,
                "DRIVER",
                "DISPATCHED",
                "DELIVERED_ON_SITE",
                item.getChalaanNumber());

        closeChallanWhenEveryPacketDelivered(item.getChalaanNumber(), now);

        return toRow(item, packetItem, lifecycle, true);
    }

    @Transactional
    public SiteLifecycleRow openOnSite(
            String rawScanText,
            Double latitude,
            Double longitude,
            Double accuracy,
            String remarks,
            List<MultipartFile> photos,
            User user) {
        User actor = requireUser(user);

        if (!currentUserService.isOnsite(actor)
                && !currentUserService.isLogistics(actor)
                && !currentUserService.isAdmin(actor)) {
            throw new AccessDeniedException(
                    "On-site packet opening requires ONSITE, LOGISTICS or ADMIN access");
        }

        ScannerDispatchService.SiteScanResolution scan =
                scannerDispatchService.resolveForSiteLifecycle(rawScanText);

        DispatchedItem item = dispatchedItemRepository
                .findByIdForLifecycleUpdate(scan.zohoItemId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Dispatch record not found for scanned packet"));

        PacketItem packetItem = packetItemRepository.findById(scan.packetItemId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Packet item not found"));

        assertSiteLifecycleEligible(item);

        PacketSiteLifecycle lifecycle = lifecycleRepository
                .findByPacketItemId(packetItem.getId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "Packet has not been physically delivered on site yet"));

        if (lifecycle.getDeliveredAt() == null) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Packet has not been physically delivered on site yet");
        }

        if (lifecycle.getOpenedAt() != null
                || lifecycle.getSiteStatus() == SiteLifecycleStatus.OPENED_ON_SITE) {
            return toRow(item, packetItem, lifecycle, true);
        }

        validateCoordinates(latitude, longitude, accuracy);
        List<ValidatedImage> images = validateImages(
                photos,
                0,
                MAX_OPENING_PHOTOS,
                MAX_OPENING_TOTAL_BYTES,
                "Opening");

        LocalDateTime now = LocalDateTime.now(APP_ZONE);
        String username = safeActor(actor.getUsername());

        lifecycle.setSiteStatus(SiteLifecycleStatus.OPENED_ON_SITE);
        lifecycle.setOpenedAt(now);
        lifecycle.setOpenedBy(username);
        lifecycle.setOpeningLatitude(latitude);
        lifecycle.setOpeningLongitude(longitude);
        lifecycle.setOpeningAccuracy(accuracy);
        lifecycle.setOpeningRemarks(clean(remarks, 2000));
        lifecycle.setUpdatedAt(now);
        lifecycle = lifecycleRepository.saveAndFlush(lifecycle);

        saveEvidence(lifecycle, SiteEvidenceStage.OPENING, images, username, now);

        auditLogService.log(
                item.getZohoItemId(),
                "Packet opened on site after verified QR scan | Challan: "
                        + safe(item.getChalaanNumber()),
                username,
                "SITE_OPENING");

        activityLogService.log(
                item.getZohoItemId(),
                "OPENED ON SITE",
                username,
                currentUserService.isOnsite(actor) ? "ONSITE" : "LOGISTICS",
                "DELIVERED_ON_SITE",
                "OPENED_ON_SITE",
                item.getChalaanNumber());

        return toRow(item, packetItem, lifecycle, true);
    }

    @Transactional(readOnly = true)
    public RegisterResult register(
            int page,
            int size,
            String search,
            String plant,
            User user) {
        User actor = requireUser(user);

        if (!currentUserService.isAdmin(actor) && !currentUserService.isLogistics(actor)) {
            throw new AccessDeniedException(
                    "Site delivery register requires ADMIN or LOGISTICS access");
        }

        int safePage = Math.max(page, 0);
        int safeSize = Math.min(Math.max(size, 1), MAX_REGISTER_PAGE_SIZE);

        Pageable pageable = PageRequest.of(
                safePage,
                safeSize,
                Sort.by(Sort.Direction.DESC, "dispatchedAt")
                        .and(Sort.by(Sort.Direction.ASC, "zohoItemId")));

        boolean completeAccess = currentUserService.isAdmin(actor)
                || currentUserService.isLogistics(actor);

        Set<String> allowedPlants = completeAccess
                ? Set.of()
                : currentUserService.allowedPlants(actor);

        Page<DispatchedItem> dispatchPage = dispatchedItemService.searchDispatchRegister(
                pageable,
                clean(search, 300),
                List.of(ItemDispatchStatus.DISPATCHED),
                clean(plant, 100),
                "ACTIVITY",
                null,
                null,
                null,
                null,
                completeAccess,
                allowedPlants);

        List<DispatchedItem> items = dispatchPage.getContent();
        Map<UUID, PacketItem> packetItems = loadPacketItems(items);
        Map<UUID, PacketSiteLifecycle> lifecycles = loadLifecycles(items);
        EvidenceAggregate evidence = loadEvidenceAggregate(lifecycles.values());

        List<SiteLifecycleRow> rows = new ArrayList<>();
        for (DispatchedItem item : items) {
            PacketItem packetItem = item.getPacketItemId() == null
                    ? null
                    : packetItems.get(item.getPacketItemId());
            PacketSiteLifecycle lifecycle = item.getPacketItemId() == null
                    ? null
                    : lifecycles.get(item.getPacketItemId());
            rows.add(toRow(item, packetItem, lifecycle, evidence));
        }

        return new RegisterResult(
                rows,
                dispatchPage.getNumber(),
                dispatchPage.getSize(),
                dispatchPage.getTotalPages(),
                dispatchPage.getTotalElements(),
                dispatchPage.hasNext());
    }

    @Transactional(readOnly = true)
    public List<SiteLifecycleMetadataRow> metadata(
            Collection<UUID> rawPacketItemIds,
            User user) {
        User actor = requireUser(user);
        assertMetadataRole(actor);

        LinkedHashSet<UUID> ids = new LinkedHashSet<>();
        if (rawPacketItemIds != null) {
            for (UUID id : rawPacketItemIds) {
                if (id != null) ids.add(id);
                if (ids.size() > MAX_METADATA_IDS) {
                    throw new ResponseStatusException(
                            HttpStatus.PAYLOAD_TOO_LARGE,
                            "A maximum of " + MAX_METADATA_IDS + " packet IDs can be requested");
                }
            }
        }

        if (ids.isEmpty()) return List.of();

        List<DispatchedItem> dispatchRows = entityManager.createQuery(
                        "SELECT d FROM DispatchedItem d WHERE d.packetItemId IN :ids",
                        DispatchedItem.class)
                .setParameter("ids", ids)
                .getResultList();

        Set<UUID> authorizedIds = new LinkedHashSet<>();
        for (DispatchedItem item : dispatchRows) {
            if (item.getPacketItemId() == null) continue;
            if (metadataRowAllowed(actor, item)) {
                authorizedIds.add(item.getPacketItemId());
            }
        }

        if (authorizedIds.isEmpty()) return List.of();

        List<PacketSiteLifecycle> lifecycles = lifecycleRepository
                .findByPacketItemIdIn(authorizedIds);
        EvidenceAggregate evidence = loadEvidenceAggregate(lifecycles);

        List<SiteLifecycleMetadataRow> result = new ArrayList<>();
        for (UUID id : authorizedIds) {
            PacketSiteLifecycle lifecycle = lifecycles.stream()
                    .filter(row -> id.equals(row.getPacketItemId()))
                    .findFirst()
                    .orElse(null);

            if (lifecycle == null) {
                result.add(new SiteLifecycleMetadataRow(
                        id,
                        "AWAITING_DELIVERY",
                        null,
                        null,
                        0,
                        0));
            } else {
                result.add(new SiteLifecycleMetadataRow(
                        id,
                        lifecycle.getSiteStatus() == null
                                ? "AWAITING_DELIVERY"
                                : lifecycle.getSiteStatus().name(),
                        lifecycle.getDeliveredAt(),
                        lifecycle.getOpenedAt(),
                        evidence.count(lifecycle.getId(), SiteEvidenceStage.DELIVERY),
                        evidence.count(lifecycle.getId(), SiteEvidenceStage.OPENING)));
            }
        }
        return result;
    }

    @Transactional(readOnly = true)
    public PacketSiteEvidence requireEvidence(UUID evidenceId, User user) {
        User actor = requireUser(user);
        if (!currentUserService.isAdmin(actor) && !currentUserService.isLogistics(actor)) {
            throw new AccessDeniedException(
                    "Site evidence requires ADMIN or LOGISTICS access");
        }

        return evidenceRepository.findById(evidenceId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Site evidence not found"));
    }

    private void assertResolvePermission(User user, DispatchedItem item, String rawMode) {
        String mode = normalizeMode(rawMode);

        if ("DELIVERY".equals(mode)) {
            if (!currentUserService.isDriver(user) && !currentUserService.isAdmin(user)) {
                throw new AccessDeniedException("Delivery scan requires DRIVER access");
            }
            assertDriverAssignment(user, item);
            return;
        }

        if ("OPENING".equals(mode)) {
            if (!currentUserService.isOnsite(user)
                    && !currentUserService.isLogistics(user)
                    && !currentUserService.isAdmin(user)) {
                throw new AccessDeniedException("Opening scan requires ONSITE access");
            }
            PacketSiteLifecycle lifecycle = item.getPacketItemId() == null
                    ? null
                    : lifecycleRepository.findByPacketItemId(item.getPacketItemId()).orElse(null);
            if (lifecycle == null || lifecycle.getDeliveredAt() == null) {
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "Packet has not been physically delivered on site yet");
            }
            return;
        }

        throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Mode must be DELIVERY or OPENING");
    }

    private void assertDriverAssignment(User user, DispatchedItem item) {
        if (currentUserService.isAdmin(user)) return;

        if (user.getDriverId() == null) {
            throw new AccessDeniedException(
                    "Your DRIVER account is not linked to a Driver master profile");
        }

        if (item.getDriverId() == null) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "No driver is assigned to this dispatched packet. Assign a driver before site delivery proof.");
        }

        if (!user.getDriverId().equals(item.getDriverId())) {
            throw new AccessDeniedException(
                    "This packet is assigned to a different driver");
        }
    }

    private void assertSiteLifecycleEligible(DispatchedItem item) {
        if (item == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Dispatch item not found");
        }

        if (item.getPacketItemId() == null) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "This legacy dispatch row is not linked to a physical packet QR");
        }

        if (item.getStatus() != ItemDispatchStatus.DISPATCHED) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Packet must be DISPATCHED before site lifecycle proof. Current status: "
                            + (item.getStatus() == null ? "UNKNOWN" : item.getStatus().name()));
        }

        if (item.getChalaanNumber() == null || item.getChalaanNumber().isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Packet has no dispatch challan and cannot receive site delivery proof");
        }
    }

    private void assertMetadataRole(User user) {
        if (currentUserService.isAdmin(user)
                || currentUserService.isDispatch(user)
                || currentUserService.isUtlDispatch(user)
                || currentUserService.isLogistics(user)
                || currentUserService.isWarehouse(user)
                || currentUserService.isPacking(user)
                || currentUserService.isHardwarePacking(user)
                || currentUserService.isUtlPacking(user)
                || currentUserService.isOnsite(user)) {
            return;
        }
        throw new AccessDeniedException("PackFlow site lifecycle metadata access denied");
    }

    private boolean metadataRowAllowed(User user, DispatchedItem item) {
        if (currentUserService.isAdmin(user) || currentUserService.isLogistics(user)) {
            return true;
        }

        if (currentUserService.isUtlDispatch(user) || currentUserService.isUtlPacking(user)) {
            if (utlWorkflowService == null) return false;
            try {
                utlWorkflowService.assertCurrentUserCanOperate(item);
                return true;
            } catch (RuntimeException exception) {
                return false;
            }
        }

        String plant = item.getPlantCode();
        return plant == null || plant.isBlank() || currentUserService.canAccessPlant(user, plant);
    }

    private void validateCoordinates(Double latitude, Double longitude, Double accuracy) {
        if (latitude == null || !Double.isFinite(latitude) || latitude < -90 || latitude > 90) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Valid current latitude is required");
        }
        if (longitude == null || !Double.isFinite(longitude) || longitude < -180 || longitude > 180) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Valid current longitude is required");
        }
        if (accuracy == null || !Double.isFinite(accuracy) || accuracy <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Location accuracy is required");
        }
        if (accuracy > MAX_ACCEPTABLE_ACCURACY_METRES) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "GPS accuracy is too low (" + Math.round(accuracy)
                            + " m). Move to a clearer location and capture again.");
        }
    }

    private List<ValidatedImage> validateImages(
            List<MultipartFile> rawFiles,
            int minimum,
            int maximum,
            long maximumTotalBytes,
            String stageLabel) {
        List<MultipartFile> files = rawFiles == null
                ? List.of()
                : rawFiles.stream()
                        .filter(file -> file != null && !file.isEmpty())
                        .toList();

        if (files.size() < minimum) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    stageLabel + " requires at least " + minimum + " photo");
        }
        if (files.size() > maximum) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    stageLabel + " supports at most " + maximum + " photos");
        }

        long total = 0;
        List<ValidatedImage> result = new ArrayList<>();

        for (MultipartFile file : files) {
            if (file.getSize() <= 0 || file.getSize() > MAX_IMAGE_BYTES) {
                throw new ResponseStatusException(
                        HttpStatus.PAYLOAD_TOO_LARGE,
                        "Each site evidence photo must be 4 MB or smaller");
            }

            total += file.getSize();
            if (total > maximumTotalBytes) {
                throw new ResponseStatusException(
                        HttpStatus.PAYLOAD_TOO_LARGE,
                        stageLabel + " photo upload is too large");
            }

            try {
                byte[] data = file.getBytes();
                String contentType = detectImageType(data);
                String hash = sha256(data);
                result.add(new ValidatedImage(
                        data,
                        contentType,
                        clean(file.getOriginalFilename(), 500),
                        hash));
            } catch (ResponseStatusException exception) {
                throw exception;
            } catch (Exception exception) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Unable to read site evidence photo");
            }
        }

        return result;
    }

    private String detectImageType(byte[] data) {
        if (data == null || data.length < 12) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid evidence image");
        }

        if ((data[0] & 0xFF) == 0xFF
                && (data[1] & 0xFF) == 0xD8
                && (data[2] & 0xFF) == 0xFF) {
            return "image/jpeg";
        }

        byte[] png = new byte[] {
                (byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A
        };
        boolean pngMatch = true;
        for (int index = 0; index < png.length; index++) {
            if (data[index] != png[index]) {
                pngMatch = false;
                break;
            }
        }
        if (pngMatch) return "image/png";

        boolean riff = data[0] == 'R' && data[1] == 'I' && data[2] == 'F' && data[3] == 'F';
        boolean webp = data[8] == 'W' && data[9] == 'E' && data[10] == 'B' && data[11] == 'P';
        if (riff && webp) return "image/webp";

        throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Site evidence must be a real JPEG, PNG or WebP image");
    }

    private String sha256(byte[] data) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        byte[] hashed = digest.digest(data);
        StringBuilder builder = new StringBuilder(64);
        for (byte value : hashed) builder.append(String.format("%02x", value));
        return builder.toString();
    }

    private void saveEvidence(
            PacketSiteLifecycle lifecycle,
            SiteEvidenceStage stage,
            List<ValidatedImage> images,
            String username,
            LocalDateTime capturedAt) {
        int ordinal = 1;
        for (ValidatedImage image : images) {
            PacketSiteEvidence evidence = new PacketSiteEvidence();
            evidence.setId(UUID.randomUUID());
            evidence.setLifecycleId(lifecycle.getId());
            evidence.setStage(stage);
            evidence.setOrdinal(ordinal++);
            evidence.setContentType(image.contentType());
            evidence.setOriginalName(image.originalName());
            evidence.setSizeBytes((long) image.data().length);
            evidence.setSha256(image.sha256());
            evidence.setFileData(image.data());
            evidence.setCapturedBy(username);
            evidence.setCapturedAt(capturedAt);
            evidenceRepository.save(evidence);
        }
    }

    private void closeChallanWhenEveryPacketDelivered(String rawChallanNumber, LocalDateTime completedAt) {
        String challan = clean(rawChallanNumber, 255);
        if (challan == null) return;

        List<DispatchedItem> challanItems = entityManager.createQuery(
                        "SELECT d FROM DispatchedItem d "
                                + "WHERE d.chalaanNumber = :challan "
                                + "AND d.status = :status ORDER BY d.zohoItemId ASC",
                        DispatchedItem.class)
                .setParameter("challan", challan)
                .setParameter("status", ItemDispatchStatus.DISPATCHED)
                .setLockMode(LockModeType.PESSIMISTIC_WRITE)
                .getResultList();

        if (challanItems.isEmpty()) return;

        LinkedHashSet<UUID> packetIds = new LinkedHashSet<>();
        for (DispatchedItem row : challanItems) {
            if (row.getPacketItemId() == null) {
                return;
            }
            packetIds.add(row.getPacketItemId());
        }

        List<PacketSiteLifecycle> lifecycleRows = lifecycleRepository.findByPacketItemIdIn(packetIds);
        if (lifecycleRows.size() != packetIds.size()) return;

        Set<UUID> completedPacketIds = new LinkedHashSet<>();
        for (PacketSiteLifecycle lifecycle : lifecycleRows) {
            if (lifecycle.getDeliveredAt() != null
                    && (lifecycle.getSiteStatus() == SiteLifecycleStatus.DELIVERED
                            || lifecycle.getSiteStatus() == SiteLifecycleStatus.OPENED_ON_SITE)) {
                completedPacketIds.add(lifecycle.getPacketItemId());
            }
        }

        if (!completedPacketIds.containsAll(packetIds)) return;

        boolean changed = false;
        for (DispatchedItem row : challanItems) {
            if (row.getTripEndedAt() == null) {
                row.setTripEndedAt(completedAt);
                changed = true;
            }
        }

        if (changed) {
            dispatchedItemRepository.saveAll(challanItems);
        }
    }

    private Map<UUID, PacketItem> loadPacketItems(List<DispatchedItem> items) {
        LinkedHashSet<UUID> ids = new LinkedHashSet<>();
        for (DispatchedItem item : items) {
            if (item.getPacketItemId() != null) ids.add(item.getPacketItemId());
        }
        Map<UUID, PacketItem> result = new LinkedHashMap<>();
        if (ids.isEmpty()) return result;
        for (PacketItem packetItem : packetItemRepository.findAllById(ids)) {
            result.put(packetItem.getId(), packetItem);
        }
        return result;
    }

    private Map<UUID, PacketSiteLifecycle> loadLifecycles(List<DispatchedItem> items) {
        LinkedHashSet<UUID> ids = new LinkedHashSet<>();
        for (DispatchedItem item : items) {
            if (item.getPacketItemId() != null) ids.add(item.getPacketItemId());
        }
        Map<UUID, PacketSiteLifecycle> result = new LinkedHashMap<>();
        if (ids.isEmpty()) return result;
        for (PacketSiteLifecycle lifecycle : lifecycleRepository.findByPacketItemIdIn(ids)) {
            result.put(lifecycle.getPacketItemId(), lifecycle);
        }
        return result;
    }

    private EvidenceAggregate loadEvidenceAggregate(Collection<PacketSiteLifecycle> lifecycles) {
        LinkedHashSet<UUID> lifecycleIds = new LinkedHashSet<>();
        if (lifecycles != null) {
            for (PacketSiteLifecycle lifecycle : lifecycles) {
                if (lifecycle != null && lifecycle.getId() != null) lifecycleIds.add(lifecycle.getId());
            }
        }
        if (lifecycleIds.isEmpty()) return new EvidenceAggregate(Map.of(), Map.of());

        Map<String, Long> counts = new HashMap<>();
        for (Object[] row : evidenceRepository.countByLifecycleIdsGrouped(lifecycleIds)) {
            if (row == null || row.length < 3) continue;
            UUID id = (UUID) row[0];
            SiteEvidenceStage stage = (SiteEvidenceStage) row[1];
            Number count = (Number) row[2];
            counts.put(evidenceKey(id, stage), count == null ? 0L : count.longValue());
        }

        Map<UUID, List<UUID>> ids = new HashMap<>();
        for (Object[] row : evidenceRepository.findEvidenceIdsByLifecycleIds(lifecycleIds)) {
            if (row == null || row.length < 2) continue;
            UUID lifecycleId = (UUID) row[0];
            UUID evidenceId = (UUID) row[1];
            ids.computeIfAbsent(lifecycleId, ignored -> new ArrayList<>()).add(evidenceId);
        }
        return new EvidenceAggregate(counts, ids);
    }

    private SiteLifecycleRow toRow(
            DispatchedItem item,
            PacketItem packetItem,
            PacketSiteLifecycle lifecycle,
            boolean loadEvidence) {
        EvidenceAggregate evidence = loadEvidence
                ? loadEvidenceAggregate(lifecycle == null ? List.of() : List.of(lifecycle))
                : new EvidenceAggregate(Map.of(), Map.of());
        return toRow(item, packetItem, lifecycle, evidence);
    }

    private SiteLifecycleRow toRow(
            DispatchedItem item,
            PacketItem packetItem,
            PacketSiteLifecycle lifecycle,
            EvidenceAggregate evidence) {
        UUID lifecycleId = lifecycle == null ? null : lifecycle.getId();
        String siteStatus = lifecycle == null || lifecycle.getSiteStatus() == null
                ? "AWAITING_DELIVERY"
                : lifecycle.getSiteStatus().name();

        return new SiteLifecycleRow(
                item.getPacketItemId(),
                item.getZohoItemId(),
                packetItem != null && hasText(packetItem.getItemName()) ? packetItem.getItemName() : item.getName(),
                packetItem == null ? null : packetItem.getPacketNumber(),
                packetItem != null && hasText(packetItem.getStickerNumber()) ? packetItem.getStickerNumber() : item.getStickerNumber(),
                packetItem != null && hasText(packetItem.getSku()) ? packetItem.getSku() : item.getSku(),
                packetItem != null && hasText(packetItem.getPdNo()) ? packetItem.getPdNo() : item.getPdNo(),
                packetItem != null && hasText(packetItem.getDrawingNo()) ? packetItem.getDrawingNo() : item.getDrawingNo(),
                packetItem != null && hasText(packetItem.getDescription()) ? packetItem.getDescription() : item.getDescription(),
                packetItem != null && hasText(packetItem.getClientName()) ? packetItem.getClientName() : item.getClientName(),
                item.getPlantCode(),
                item.getCurrentLocationCode(),
                item.getChalaanNumber(),
                item.getDriverName(),
                item.getVehicleNumber(),
                item.getDispatchedAt(),
                item.getStatus() == null ? null : item.getStatus().name(),
                siteStatus,
                lifecycle == null ? item.getDeliveredAt() : lifecycle.getDeliveredAt(),
                lifecycle == null ? null : lifecycle.getDeliveredBy(),
                lifecycle == null ? item.getDeliveryLatitude() : lifecycle.getDeliveryLatitude(),
                lifecycle == null ? item.getDeliveryLongitude() : lifecycle.getDeliveryLongitude(),
                lifecycle == null ? item.getDeliveryLocationAccuracy() : lifecycle.getDeliveryAccuracy(),
                lifecycle == null ? item.getReceiverName() : lifecycle.getReceiverName(),
                lifecycle == null ? item.getReceiverPhone() : lifecycle.getReceiverPhone(),
                lifecycle == null ? item.getDeliveryRemarks() : lifecycle.getDeliveryRemarks(),
                lifecycle == null ? null : lifecycle.getOpenedAt(),
                lifecycle == null ? null : lifecycle.getOpenedBy(),
                lifecycle == null ? null : lifecycle.getOpeningLatitude(),
                lifecycle == null ? null : lifecycle.getOpeningLongitude(),
                lifecycle == null ? null : lifecycle.getOpeningAccuracy(),
                lifecycle == null ? null : lifecycle.getOpeningRemarks(),
                lifecycleId == null ? 0L : evidence.count(lifecycleId, SiteEvidenceStage.DELIVERY),
                lifecycleId == null ? 0L : evidence.count(lifecycleId, SiteEvidenceStage.OPENING),
                lifecycleId == null ? List.of() : evidence.ids(lifecycleId));
    }

    private User requireUser(User user) {
        if (user == null) throw new AccessDeniedException("Authentication is required");
        return user;
    }

    private String normalizeMode(String raw) {
        return String.valueOf(raw == null ? "" : raw)
                .trim()
                .toUpperCase(Locale.ROOT);
    }

    private String clean(String value, int maxLength) {
        if (value == null) return null;
        String text = value.trim().replace('\u0000', ' ');
        if (text.isBlank()) return null;
        return text.length() <= maxLength ? text : text.substring(0, maxLength);
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private String safe(String value) {
        return value == null || value.isBlank() ? "-" : value.trim();
    }

    private String safeActor(String value) {
        String clean = clean(value, 180);
        return clean == null ? "SYSTEM" : clean;
    }

    private static String evidenceKey(UUID id, SiteEvidenceStage stage) {
        return id + "|" + stage.name();
    }

    private record ValidatedImage(
            byte[] data,
            String contentType,
            String originalName,
            String sha256) {
    }

    private record EvidenceAggregate(
            Map<String, Long> counts,
            Map<UUID, List<UUID>> evidenceIds) {
        long count(UUID lifecycleId, SiteEvidenceStage stage) {
            return counts.getOrDefault(evidenceKey(lifecycleId, stage), 0L);
        }

        List<UUID> ids(UUID lifecycleId) {
            return evidenceIds.getOrDefault(lifecycleId, List.of());
        }
    }

    public record RegisterResult(
            List<SiteLifecycleRow> rows,
            int pageNumber,
            int pageSize,
            int totalPages,
            long totalElements,
            boolean hasNext) {
    }
}
