package com.alsorg.packing.service;

import java.util.LinkedHashSet;
import java.util.stream.Collectors;
import java.io.IOException;
import com.alsorg.packing.repository.MasterItemRepository;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeParseException;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.alsorg.packing.config.TimeZoneConfig;
import com.alsorg.packing.controller.dto.CreateItemRequest;
import com.alsorg.packing.controller.dto.PacketItemResponse;
import com.alsorg.packing.controller.dto.UpdatePacketItemRequest;
import com.alsorg.packing.domain.common.Company;
import com.alsorg.packing.domain.common.ItemDispatchStatus;
import com.alsorg.packing.domain.common.PacketItemType;
import com.alsorg.packing.domain.common.PacketStatus;
import com.alsorg.packing.domain.dispatch.DispatchedItem;
import com.alsorg.packing.domain.item.MasterItem;
import com.alsorg.packing.domain.item.PacketItem;
import com.alsorg.packing.domain.packet.Packet;
import com.alsorg.packing.repository.CompanyRepository;
import com.alsorg.packing.repository.DispatchedItemRepository;
import com.alsorg.packing.repository.PacketItemRepository;
import com.alsorg.packing.repository.PacketRepository;
import com.alsorg.packing.service.pdf.PdfStickerService;
import com.alsorg.packing.service.pdf.ProductQrPdfService;
import com.alsorg.packing.service.pdf.dto.StickerPdfData;
import com.alsorg.packing.domain.sticker.StickerHistory;
import com.alsorg.packing.domain.utl.UtlPacketRouting;
import com.alsorg.packing.repository.StickerHistoryRepository;
import java.util.Set;
import java.util.Objects;
import org.springframework.security.access.AccessDeniedException;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.criteria.Expression;
import com.alsorg.packing.domain.users.User;

@Service
public class PacketService {

        private final PacketRepository packetRepository;
        private final PacketItemRepository packetItemRepository;
        private final CompanyRepository companyRepository;
        private final StickerSequenceService stickerSequenceService;
        private final PdfStickerService pdfService;
        private final ProductQrPdfService productQrPdfService;

        /*
         * Optional field injection keeps the existing constructor signatures
         * source-compatible while enabling the additive UTL routing module.
         */
        @org.springframework.beans.factory.annotation.Autowired(required = false)
        private UtlWorkflowService utlWorkflowService;
        private final DispatchedItemService dispatchedItemService;
        private final DispatchedItemRepository dispatchedRepo;
        private final MasterItemRepository masterItemRepository;
        private final StickerHistoryRepository stickerHistoryRepository;
        private final StickerHistoryPdfRefreshService stickerHistoryPdfRefreshService;
        private final PlantLocationService plantLocationService;
        private final CurrentUserService currentUserService;
        private final ActivityLogService activityLogService;

        @PersistenceContext
        private EntityManager entityManager;
        private static final List<String> NORMAL_INVENTORY_CANDIDATE_STATUSES = List.of(
                        "CREATED",
                        "RESTORED",
                        "READY");

        private static final java.time.ZoneId APP_ZONE = TimeZoneConfig.APP_ZONE;
        private static final int MAX_PACKET_PAGE_SIZE = 100;
        private static final long MAX_STICKER_PDF_BYTES = 20L * 1024L * 1024L;

        @Value("${sticker.storage.path}")
        private String stickerStoragePath;

        @org.springframework.beans.factory.annotation.Autowired
        public PacketService(
                        PacketRepository packetRepository,
                        PacketItemRepository packetItemRepository,
                        CurrentUserService currentUserService,
                        CompanyRepository companyRepository,
                        StickerSequenceService stickerSequenceService,
                        PdfStickerService pdfService,
                        ProductQrPdfService productQrPdfService,
                        DispatchedItemService dispatchedItemService,
                        DispatchedItemRepository dispatchedRepo,
                        MasterItemRepository masterItemRepository,
                        StickerHistoryRepository stickerHistoryRepository,
                        StickerHistoryPdfRefreshService stickerHistoryPdfRefreshService,
                        ActivityLogService activityLogService,
                        PlantLocationService plantLocationService) {
                this.packetRepository = packetRepository;
                this.packetItemRepository = packetItemRepository;
                this.companyRepository = companyRepository;
                this.stickerSequenceService = stickerSequenceService;
                this.pdfService = pdfService;
                this.productQrPdfService = productQrPdfService;
                this.dispatchedItemService = dispatchedItemService;
                this.dispatchedRepo = dispatchedRepo;
                this.masterItemRepository = masterItemRepository;
                this.stickerHistoryRepository = stickerHistoryRepository;
                this.stickerHistoryPdfRefreshService = stickerHistoryPdfRefreshService;
                this.plantLocationService = plantLocationService;
                this.activityLogService = activityLogService;
                this.currentUserService = currentUserService;
        }

        /**
         * Source-compatible constructor retained for older tests/tools that
         * instantiate PacketService directly with the pre-WR-38 argument list.
         * Spring uses the @Autowired constructor above in production. The QR
         * renderer is stateless, so a local instance is safe for this legacy path.
         */
        @Deprecated(forRemoval = false)
        public PacketService(
                        PacketRepository packetRepository,
                        PacketItemRepository packetItemRepository,
                        CurrentUserService currentUserService,
                        CompanyRepository companyRepository,
                        StickerSequenceService stickerSequenceService,
                        PdfStickerService pdfService,
                        DispatchedItemService dispatchedItemService,
                        DispatchedItemRepository dispatchedRepo,
                        MasterItemRepository masterItemRepository,
                        StickerHistoryRepository stickerHistoryRepository,
                        StickerHistoryPdfRefreshService stickerHistoryPdfRefreshService,
                        ActivityLogService activityLogService,
                        PlantLocationService plantLocationService) {

                this(
                                packetRepository,
                                packetItemRepository,
                                currentUserService,
                                companyRepository,
                                stickerSequenceService,
                                pdfService,
                                new ProductQrPdfService(),
                                dispatchedItemService,
                                dispatchedRepo,
                                masterItemRepository,
                                stickerHistoryRepository,
                                stickerHistoryPdfRefreshService,
                                activityLogService,
                                plantLocationService);
        }

        private StickerPdfData buildStickerPdfData(
                        PacketItem item,
                        String stickerNumber,
                        String factoryFloor,
                        boolean showCompanyHeader,
                        long iteration,
                        boolean preview) {
                StickerPdfData pdf = new StickerPdfData();

                String finalStickerNumber = preview
                                ? "PREVIEW"
                                : stickerNumber;

                PacketItemType itemType = effectiveItemType(item);

                boolean hardwareSticker = itemType == PacketItemType.HARDWARE;

                pdf.setHardwareSticker(hardwareSticker);

                pdf.setStickerNumber(finalStickerNumber);
                pdf.setBarcodeText(finalStickerNumber);

                pdf.setPacketItemId(item.getId().toString());

                pdf.setQrPayload(
                                preview
                                                ? "ALSORG|PREVIEW|TYPE="
                                                                + itemType
                                                                + "|PI="
                                                                + item.getId()
                                                : "ALSORG|TYPE="
                                                                + itemType
                                                                + "|PI="
                                                                + item.getId()
                                                                + "|SN="
                                                                + stickerNumber);

                pdf.setShowCompanyHeader(showCompanyHeader);

                pdf.setItemName(
                                safeForPdf(item.getItemName())
                                                + " ("
                                                + safeForPdf(item.getSku())
                                                + ")");

                /*
                 * Keep the PACKET header and CODE / SKU identity synchronized.
                 * For legacy/import-reconstructed rows the SKU can be newer than an
                 * old packetNumber value, so prefer the packet encoded in SKU.
                 */
                pdf.setPacketNo(
                                resolveStickerPacketNumber(
                                                item.getPacketNumber(),
                                                item.getSku()));
                pdf.setSku(item.getSku());

                pdf.setDescription(item.getDescription());
                pdf.setLocation(item.getLocation());

                pdf.setFloor(
                                factoryFloor != null
                                                && !factoryFloor.isBlank()
                                                                ? factoryFloor.trim()
                                                                : item.getFloor());

                pdf.setClientName(item.getClientName());
                pdf.setClientAddress(item.getClientAddress());
                pdf.setPdNo(item.getPdNo());
                pdf.setDrawingNo(item.getDrawingNo());
                pdf.setPrintIteration((int) iteration);
                pdf.setQuantity(1);

                /*
                 * The sticker must show the item's real packing date, not the
                 * day on which the PDF happens to be opened/rebuilt.
                 *
                 * Legacy rows without packedAt keep the previous safe behaviour
                 * and fall back to today's India date.
                 */
                java.time.LocalDate stickerPackingDate = item.getPackedAt() != null
                                ? item.getPackedAt().toLocalDate()
                                : java.time.LocalDate.now(APP_ZONE);

                pdf.setDate(stickerPackingDate.toString());

                if (hardwareSticker) {
                        pdf.setDimensions(null);
                        pdf.setWeight(null);
                        pdf.setRemarks(null);
                } else {
                        pdf.setDimensions(
                                        formatDimensionWithVolume(
                                                        item.getDimensions()));
                        pdf.setWeight(
                                        formatWeight(item.getWeight()));
                        pdf.setRemarks(item.getRemarks());
                }

                return pdf;
        }

        private String safeForPdf(String value) {
                return value == null || value.isBlank()
                                ? "-"
                                : value.trim();
        }

        private void assertPlantAccess(
                        String plantCode,
                        Set<String> allowedPlants) {
                if (plantCode == null
                                || plantCode.isBlank()) {
                        throw new RuntimeException(
                                        "Plant code missing");
                }

                if (allowedPlants == null) {
                        return;
                }

                boolean permitted = allowedPlants.stream()
                                .filter(Objects::nonNull)
                                .anyMatch(value -> value.trim()
                                                .equalsIgnoreCase(
                                                                plantCode.trim()));

                if (!permitted) {
                        throw new AccessDeniedException(
                                        "User does not have access to plant: "
                                                        + plantCode);
                }
        }
        // =====================================================
        // PACKET CREATION (NO STICKER / PDF HERE)
        // =====================================================

        @Transactional
        public Packet createPacket(UUID companyId, String createdBy, List<PacketItem> items) {

                Company company = companyRepository.findById(companyId)
                                .orElseThrow(() -> new IllegalArgumentException("Company not found"));

                Packet packet = new Packet();
                packet.setId(UUID.randomUUID());
                packet.setCompany(company);
                packet.setStickerNumber(
                                packetContainerStickerNumber(
                                                firstPacketPlant(items),
                                                packet.getId()));
                packet.setStatus(PacketStatus.CREATED);
                packet.setCreatedBy(createdBy);
                packet.setCreatedAt(LocalDateTime.now(APP_ZONE));
                packet.setStickerGenerated(false);

                packet = packetRepository.save(packet);

                for (PacketItem item : items) {
                        item.setId(UUID.randomUUID());
                        item.setPacket(packet);
                        if (item.getItemType() == null) {
                                item.setItemType(PacketItemType.NORMAL);
                        }
                        packetItemRepository.save(item);
                }

                return packet;
        }

        // =====================================================
        // READ APIs
        // =====================================================

        @Transactional(readOnly = true)
        public List<PacketItemResponse> getVisibleNormalInventoryItems(
                        User user,
                        Set<String> allowedPlants) {

                if (user == null) {
                        throw new AccessDeniedException(
                                        "Authentication is required");
                }

                /*
                 * A user having both PACKING and HARDWARE_PACKING
                 * can still use normal Inventory.
                 *
                 * Only a hardware-only user is rejected.
                 */
                if (currentUserService
                                .isHardwareOnlyPackingUser(user)) {

                        throw new AccessDeniedException(
                                        "Hardware-only packing users cannot access normal inventory");
                }

                /*
                 * ADMIN:
                 *
                 * Preserve the existing behaviour.
                 *
                 * ADMIN may see CREATED, RESTORED and qualifying READY
                 * items according to isVisibleOnNormalInventoryPage().
                 */
                if (currentUserService.isAdmin(user)) {

                        return packetItemRepository
                                        .findAdminNormalInventoryCandidates(
                                                        PacketItemType.NORMAL,
                                                        NORMAL_INVENTORY_CANDIDATE_STATUSES)
                                        .stream()
                                        .filter(
                                                        this::isVisibleOnNormalInventoryPage)
                                        .map(
                                                        this::toInventoryPacketItemResponse)
                                        .toList();
                }

                if (user.getId() == null) {
                        throw new AccessDeniedException(
                                        "Authenticated user ID is missing");
                }

                String username = user.getUsername() == null
                                ? ""
                                : user.getUsername().trim();

                /*
                 * NORMAL USER:
                 *
                 * Only return:
                 * - items owned by this user;
                 * - status CREATED;
                 * - stickerNumber null/blank.
                 *
                 * Do not use NORMAL_INVENTORY_CANDIDATE_STATUSES here,
                 * because that contains READY and RESTORED.
                 */
                return packetItemRepository
                                .findOwnedCreatedUnprintedNormalInventory(
                                                PacketItemType.NORMAL,
                                                user.getId(),
                                                username)
                                .stream()
                                .map(
                                                this::toInventoryPacketItemResponse)
                                .toList();
        }

        /**
         * Server-paged normal Inventory read.
         *
         * This is additive to getVisibleNormalInventoryItems(). The legacy
         * full-list method remains unchanged for existing callers and for
         * explicit full-register operations. This method applies the same
         * visibility/ownership rules before pagination so the browser receives
         * only the rows needed for the current page.
         */
        @Transactional(readOnly = true)
        public InventoryPageResult getVisibleNormalInventoryItemsPaged(
                        User user,
                        Set<String> allowedPlants,
                        String search,
                        String stickerStatus,
                        Pageable pageable) {

                if (user == null) {
                        throw new AccessDeniedException(
                                        "Authentication is required");
                }

                if (currentUserService
                                .isHardwareOnlyPackingUser(user)) {

                        throw new AccessDeniedException(
                                        "Hardware-only packing users cannot access normal inventory");
                }

                if (pageable == null) {
                        throw new IllegalArgumentException(
                                        "Inventory pageable is required");
                }

                Pageable safePageable = PageRequest.of(
                                Math.max(0, pageable.getPageNumber()),
                                Math.max(
                                                1,
                                                Math.min(
                                                                pageable.getPageSize(),
                                                                MAX_PACKET_PAGE_SIZE)),
                                pageable.getSort());

                /*
                 * allowedPlants is intentionally not applied here.
                 *
                 * This preserves the current Inventory rule:
                 * - ADMIN sees the complete normal Inventory candidate set;
                 * - a normal user sees only their own newly created/unprinted rows.
                 *
                 * Plant access continues to be enforced by the existing creation and
                 * mutation workflows exactly as before.
                 */
                Specification<PacketItem> specification = buildNormalInventoryPageSpecification(
                                user,
                                search,
                                stickerStatus);

                Page<PacketItem> entityPage = packetItemRepository.findAll(
                                specification,
                                safePageable);

                Map<String, Integer> maxPacketNumbers = getInventoryMaxPacketNumbersForPage(
                                entityPage.getContent(),
                                user);

                Page<PacketItemResponse> responsePage = entityPage.map(
                                this::toInventoryPacketItemResponse);

                return new InventoryPageResult(
                                responsePage,
                                maxPacketNumbers);
        }

        public record InventoryPageResult(
                        Page<PacketItemResponse> page,
                        Map<String, Integer> maxPacketNumbers) {
        }

        private Specification<PacketItem> buildNormalInventoryPageSpecification(
                        User user,
                        String search,
                        String stickerStatus) {

                final boolean admin = currentUserService.isAdmin(
                                user);

                final Long userId = user.getId();

                final String username = user.getUsername() == null
                                ? ""
                                : user.getUsername().trim();

                final String cleanSearch = cleanInventoryValue(
                                search)
                                .toLowerCase();

                final String cleanStickerStatus = cleanInventoryValue(
                                stickerStatus)
                                .toUpperCase();

                return (root, query, criteriaBuilder) -> {

                        List<Predicate> predicates = new ArrayList<>();

                        /*
                         * NORMAL includes legacy rows where itemType was not
                         * populated yet.
                         */
                        predicates.add(
                                        criteriaBuilder.or(
                                                        criteriaBuilder.isNull(
                                                                        root.get(
                                                                                        "itemType")),
                                                        criteriaBuilder.equal(
                                                                        root.get(
                                                                                        "itemType"),
                                                                        PacketItemType.NORMAL)));

                        Expression<String> statusExpression = criteriaBuilder.upper(
                                        criteriaBuilder.trim(
                                                        criteriaBuilder.coalesce(
                                                                        root.<String>get(
                                                                                        "status"),
                                                                        "")));

                        Expression<String> stickerExpression = criteriaBuilder.trim(
                                        criteriaBuilder.coalesce(
                                                        root.<String>get(
                                                                        "stickerNumber"),
                                                        ""));

                        if (admin) {

                                Expression<String> currentLocation = criteriaBuilder.upper(
                                                criteriaBuilder.trim(
                                                                criteriaBuilder.coalesce(
                                                                                root.<String>get(
                                                                                                "currentLocationCode"),
                                                                                "")));

                                Expression<String> legacyLocation = criteriaBuilder.upper(
                                                criteriaBuilder.trim(
                                                                criteriaBuilder.coalesce(
                                                                                root.<String>get(
                                                                                                "location"),
                                                                                "")));

                                Expression<String> finalLocation = criteriaBuilder.<String>selectCase()
                                                .when(
                                                                criteriaBuilder.notEqual(
                                                                                currentLocation,
                                                                                ""),
                                                                currentLocation)
                                                .otherwise(
                                                                legacyLocation);

                                Expression<String> packedArea = criteriaBuilder.upper(
                                                criteriaBuilder.trim(
                                                                criteriaBuilder.coalesce(
                                                                                root.<String>get(
                                                                                                "packedAreaCode"),
                                                                                "")));

                                Expression<String> fgArea = criteriaBuilder.upper(
                                                criteriaBuilder.trim(
                                                                criteriaBuilder.coalesce(
                                                                                root.<String>get(
                                                                                                "fgAreaCode"),
                                                                                "")));

                                Predicate inFg = criteriaBuilder.and(
                                                criteriaBuilder.notEqual(
                                                                fgArea,
                                                                ""),
                                                criteriaBuilder.or(
                                                                criteriaBuilder.equal(
                                                                                finalLocation,
                                                                                fgArea),
                                                                criteriaBuilder.like(
                                                                                finalLocation,
                                                                                criteriaBuilder.concat(
                                                                                                fgArea,
                                                                                                "-%")),
                                                                criteriaBuilder.like(
                                                                                finalLocation,
                                                                                criteriaBuilder.concat(
                                                                                                fgArea,
                                                                                                " %"))));

                                Predicate inConfiguredPackedArea = criteriaBuilder.and(
                                                criteriaBuilder.notEqual(
                                                                packedArea,
                                                                ""),
                                                criteriaBuilder.or(
                                                                criteriaBuilder.equal(
                                                                                finalLocation,
                                                                                packedArea),
                                                                criteriaBuilder.like(
                                                                                finalLocation,
                                                                                criteriaBuilder.concat(
                                                                                                packedArea,
                                                                                                "-%")),
                                                                criteriaBuilder.like(
                                                                                finalLocation,
                                                                                criteriaBuilder.concat(
                                                                                                packedArea,
                                                                                                " %"))));

                                Predicate inLegacyPackedArea = criteriaBuilder.and(
                                                criteriaBuilder.equal(
                                                                packedArea,
                                                                ""),
                                                criteriaBuilder.like(
                                                                finalLocation,
                                                                "PKD%"));

                                Predicate readyAndStillInPackedArea = criteriaBuilder.and(
                                                criteriaBuilder.equal(
                                                                statusExpression,
                                                                "READY"),
                                                criteriaBuilder.notEqual(
                                                                finalLocation,
                                                                ""),
                                                criteriaBuilder.not(
                                                                inFg),
                                                criteriaBuilder.or(
                                                                inConfiguredPackedArea,
                                                                inLegacyPackedArea));

                                predicates.add(
                                                criteriaBuilder.or(
                                                                criteriaBuilder.equal(
                                                                                statusExpression,
                                                                                "CREATED"),
                                                                criteriaBuilder.equal(
                                                                                statusExpression,
                                                                                "RESTORED"),
                                                                readyAndStillInPackedArea));

                        } else {

                                /*
                                 * Preserve the exact owner-scoped normal-user
                                 * Inventory behaviour from
                                 * findOwnedCreatedUnprintedNormalInventory().
                                 */
                                if (userId == null) {
                                        throw new AccessDeniedException(
                                                        "Authenticated user ID is missing");
                                }

                                predicates.add(
                                                criteriaBuilder.equal(
                                                                statusExpression,
                                                                "CREATED"));

                                predicates.add(
                                                criteriaBuilder.equal(
                                                                stickerExpression,
                                                                ""));

                                Predicate modernOwner = criteriaBuilder.equal(
                                                root.get(
                                                                "createdByUserId"),
                                                userId);

                                Predicate legacyOwner = username.isBlank()
                                                ? criteriaBuilder.disjunction()
                                                : criteriaBuilder.and(
                                                                criteriaBuilder.isNull(
                                                                                root.get(
                                                                                                "createdByUserId")),
                                                                criteriaBuilder.equal(
                                                                                criteriaBuilder.lower(
                                                                                                criteriaBuilder.trim(
                                                                                                                criteriaBuilder.coalesce(
                                                                                                                                root.<String>get(
                                                                                                                                                "createdBy"),
                                                                                                                                ""))),
                                                                                username.toLowerCase()));

                                predicates.add(
                                                criteriaBuilder.or(
                                                                modernOwner,
                                                                legacyOwner));
                        }

                        /*
                         * Existing Admin-only Created / Sticker Printed filter.
                         */
                        if (admin &&
                                        "CREATED".equals(
                                                        cleanStickerStatus)) {

                                predicates.add(
                                                criteriaBuilder.equal(
                                                                stickerExpression,
                                                                ""));

                        } else if (admin &&
                                        "STICKER_PRINTED".equals(
                                                        cleanStickerStatus)) {

                                predicates.add(
                                                criteriaBuilder.notEqual(
                                                                stickerExpression,
                                                                ""));
                        }

                        if (!cleanSearch.isBlank()) {

                                String contains = "%"
                                                + cleanSearch
                                                + "%";

                                List<Predicate> searchPredicates = new ArrayList<>();

                                String[] searchableFields = {
                                                "itemName",
                                                "sku",
                                                "clientName",
                                                "pdNo",
                                                "drawingNo",
                                                "description",
                                                "remarks",
                                                "plantCode",
                                                "packedAreaCode",
                                                "currentLocationCode",
                                                "location"
                                };

                                for (String field : searchableFields) {
                                        searchPredicates.add(
                                                        criteriaBuilder.like(
                                                                        criteriaBuilder.lower(
                                                                                        criteriaBuilder.coalesce(
                                                                                                        root.<String>get(
                                                                                                                        field),
                                                                                                        "")),
                                                                        contains));
                                }

                                /*
                                 * The current React search also searches the
                                 * derived Sticker status label.
                                 */
                                if ("sticker printed".contains(
                                                cleanSearch)) {

                                        searchPredicates.add(
                                                        criteriaBuilder.notEqual(
                                                                        stickerExpression,
                                                                        ""));
                                }

                                if ("created".contains(
                                                cleanSearch)) {

                                        searchPredicates.add(
                                                        criteriaBuilder.equal(
                                                                        stickerExpression,
                                                                        ""));
                                }

                                predicates.add(
                                                criteriaBuilder.or(
                                                                searchPredicates.toArray(
                                                                                Predicate[]::new)));
                        }

                        return criteriaBuilder.and(
                                        predicates.toArray(
                                                        Predicate[]::new));
                };
        }

        /**
         * Highest packet number by master for only the masters represented by the
         * supplied visible page. Used by the frontend to preserve the existing
         * rule that Add / Custom Add is shown only on the final packet.
         *
         * The calculation starts from the entity page itself so it does not depend
         * on any additional DTO accessor. It then batch-loads only those masters
         * and reapplies the exact current Inventory visibility rule before taking
         * the maximum packet number.
         */
        private Map<String, Integer> getInventoryMaxPacketNumbersForPage(
                        List<PacketItem> visiblePageItems,
                        User user) {

                if (visiblePageItems == null ||
                                visiblePageItems.isEmpty()) {
                        return Map.of();
                }

                if (user == null) {
                        throw new AccessDeniedException(
                                        "Authentication is required");
                }

                Set<UUID> masterItemIds = visiblePageItems.stream()
                                .map(
                                                PacketItem::getMasterItem)
                                .filter(
                                                Objects::nonNull)
                                .map(
                                                MasterItem::getId)
                                .filter(
                                                Objects::nonNull)
                                .collect(
                                                Collectors.toCollection(
                                                                LinkedHashSet::new));

                if (masterItemIds.isEmpty()) {
                        return Map.of();
                }

                boolean admin = currentUserService.isAdmin(
                                user);

                Map<String, Integer> result = new LinkedHashMap<>();

                for (PacketItem item : packetItemRepository
                                .findByMasterItemIdsForInventoryPage(
                                                masterItemIds)) {

                        if (item == null ||
                                        item.getMasterItem() == null ||
                                        item.getMasterItem().getId() == null) {
                                continue;
                        }

                        boolean visible;

                        if (admin) {

                                visible = isVisibleOnNormalInventoryPage(
                                                item);

                        } else {

                                String status = cleanInventoryValue(
                                                item.getStatus())
                                                .toUpperCase();

                                boolean stickerMissing = item.getStickerNumber() == null ||
                                                item.getStickerNumber().isBlank();

                                visible = effectiveItemType(
                                                item) != PacketItemType.HARDWARE &&
                                                "CREATED".equals(
                                                                status)
                                                &&
                                                stickerMissing &&
                                                isNormalPacketOwnedByUser(
                                                                item,
                                                                user);
                        }

                        if (!visible) {
                                continue;
                        }

                        int packetNumber = parsePacketNumberSafely(
                                        item.getPacketNumber());

                        if (packetNumber <= 0) {
                                packetNumber = parsePacketNumberSafely(
                                                item.getSku());
                        }

                        if (packetNumber <= 0) {
                                continue;
                        }

                        String masterKey = item.getMasterItem()
                                        .getId()
                                        .toString();

                        result.merge(
                                        masterKey,
                                        packetNumber,
                                        Math::max);
                }

                return result;
        }

        private PacketItemResponse toInventoryPacketItemResponse(
                        PacketItem item) {

                PacketItemResponse dto = new PacketItemResponse();

                dto.setItemId(
                                item.getId());

                dto.setItemName(
                                item.getItemName());

                dto.setSku(
                                resolveSkuForPlantRead(
                                                item.getPlantCode(),
                                                item.getPdNo(),
                                                item.getSku()));

                dto.setLocation(
                                item.getLocation());

                dto.setFloor(
                                item.getFloor());

                dto.setPdNo(
                                item.getPdNo());

                dto.setDrawingNo(
                                item.getDrawingNo());

                dto.setClientName(
                                item.getClientName());

                dto.setClientAddress(
                                item.getClientAddress());

                dto.setQuantity(
                                item.getQuantity() != null
                                                ? item.getQuantity()
                                                : 1);

                dto.setDescription(
                                item.getDescription());

                dto.setDimensions(
                                item.getDimensions());

                dto.setWeight(
                                item.getWeight());

                dto.setRemarks(
                                item.getRemarks());

                dto.setCreatedBy(
                                item.getCreatedBy());

                dto.setStickerNumber(
                                item.getStickerNumber());

                dto.setPlantCode(
                                item.getPlantCode());

                dto.setPackedAreaCode(
                                item.getPackedAreaCode());

                dto.setCurrentLocationCode(
                                item.getCurrentLocationCode());

                dto.setFgAreaCode(
                                item.getFgAreaCode());

                dto.setFgZoneCode(
                                item.getFgZoneCode());

                MasterItem master = item.getMasterItem();

                if (master != null) {
                        dto.setMasterItemId(
                                        master.getId());

                        dto.setTotalPackets(
                                        master.getTotalPackets());
                }

                return dto;
        }

        private boolean isVisibleOnNormalInventoryPage(
                        PacketItem item) {

                if (item == null) {
                        return false;
                }

                if (effectiveItemType(item) == PacketItemType.HARDWARE) {
                        return false;
                }

                String status = cleanInventoryValue(
                                item.getStatus())
                                .toUpperCase();

                if ("CREATED".equals(status)
                                || "RESTORED".equals(status)) {
                        return true;
                }

                if ("READY".equals(status)) {
                        return isPackedPkdInventoryItem(
                                        item);
                }

                return false;
        }

        private boolean isPackedPkdInventoryItem(
                        PacketItem item) {

                String packedAreaCode = cleanInventoryValue(
                                item.getPackedAreaCode());

                String fgAreaCode = cleanInventoryValue(
                                item.getFgAreaCode());

                String currentLocationCode = cleanInventoryValue(
                                item.getCurrentLocationCode());

                String location = cleanInventoryValue(
                                item.getLocation());

                String finalLocation = !currentLocationCode.isBlank()
                                ? currentLocationCode
                                : location;

                if (finalLocation.isBlank()) {
                        return false;
                }

                /*
                 * Already in FG: do not show on Inventory.
                 */
                if (!fgAreaCode.isBlank()
                                && (finalLocation.equalsIgnoreCase(
                                                fgAreaCode)
                                                || startsWithLocationCode(
                                                                finalLocation,
                                                                fgAreaCode))) {
                        return false;
                }

                /*
                 * Assigned PKD location.
                 */
                if (!packedAreaCode.isBlank()) {
                        return finalLocation.equalsIgnoreCase(
                                        packedAreaCode)
                                        || startsWithLocationCode(
                                                        finalLocation,
                                                        packedAreaCode);
                }

                /*
                 * Legacy fallback.
                 */
                return finalLocation
                                .toUpperCase()
                                .startsWith("PKD");
        }

        private boolean startsWithLocationCode(
                        String value,
                        String prefix) {

                if (value == null
                                || prefix == null) {
                        return false;
                }

                String cleanValue = value.trim()
                                .toUpperCase();

                String cleanPrefix = prefix.trim()
                                .toUpperCase();

                return cleanValue.startsWith(
                                cleanPrefix + "-")
                                || cleanValue.startsWith(
                                                cleanPrefix + " ");
        }

        private String cleanInventoryValue(
                        String value) {

                return value == null
                                ? ""
                                : value.trim();
        }

        public Page<Packet> getPackets(
                        UUID companyId,
                        PacketStatus status,
                        Pageable pageable) {

                if (pageable == null) {
                        throw new IllegalArgumentException(
                                        "Packet page request is required");
                }

                Pageable safePageable = PageRequest.of(
                                Math.max(0, pageable.getPageNumber()),
                                Math.max(
                                                1,
                                                Math.min(
                                                                pageable.getPageSize(),
                                                                MAX_PACKET_PAGE_SIZE)),
                                pageable.getSort());

                if (companyId != null && status != null) {
                        return packetRepository.findByCompany_IdAndStatus(
                                        companyId,
                                        status,
                                        safePageable);
                }

                if (companyId != null) {
                        return packetRepository.findByCompany_Id(
                                        companyId,
                                        safePageable);
                }

                if (status != null) {
                        return packetRepository.findByStatus(
                                        status,
                                        safePageable);
                }

                return packetRepository.findAll(
                                safePageable);
        }

        public Packet getPacketById(UUID packetId) {
                return packetRepository.findById(packetId)
                                .orElseThrow(() -> new IllegalArgumentException("Packet not found"));
        }

        @Transactional(readOnly = true)
        public byte[] getExistingStickerPdf(
                        UUID packetId) {

                Packet packet = packetRepository
                                .findById(packetId)
                                .orElseThrow(() -> new IllegalArgumentException(
                                                "Packet not found"));

                if (packet.getStickerPath() == null ||
                                packet.getStickerPath().isBlank()) {

                        throw new IllegalStateException(
                                        "No sticker file path is stored for packet "
                                                        + packet.getStickerNumber());
                }

                Path path = resolveStoredStickerPath(
                                packet.getStickerPath());

                if (!Files.exists(path) ||
                                !Files.isRegularFile(path)) {

                        throw new IllegalStateException(
                                        "Sticker file does not exist on disk for packet "
                                                        + packet.getStickerNumber());
                }

                try {
                        long fileSize = Files.size(path);

                        if (fileSize < 0L ||
                                        fileSize > MAX_STICKER_PDF_BYTES) {
                                throw new IllegalStateException(
                                                "Stored sticker PDF has an invalid file size");
                        }

                        return Files.readAllBytes(path);
                } catch (IOException exception) {
                        throw new RuntimeException(
                                        "Failed to read sticker file",
                                        exception);
                }
        }

        @Transactional(readOnly = true)
        public List<PacketItemResponse> getPacketItems(
                        UUID packetId) {
                return packetItemRepository.findByPacketId(packetId)
                                .stream()
                                .filter(item -> effectiveItemType(item) != PacketItemType.HARDWARE)
                                .map(item -> {
                                        PacketItemResponse dto = new PacketItemResponse();

                                        dto.setItemId(item.getId());
                                        dto.setItemName(item.getItemName());
                                        dto.setFloor(item.getFloor());
                                        dto.setPdNo(item.getPdNo());
                                        dto.setDrawingNo(item.getDrawingNo());
                                        dto.setClientName(item.getClientName());
                                        dto.setClientAddress(item.getClientAddress());

                                        dto.setSku(
                                                        firstNonBlankValue(
                                                                        resolveSkuForPlantRead(
                                                                                        item.getPlantCode(),
                                                                                        item.getPdNo(),
                                                                                        item.getSku()),
                                                                        "-"));

                                        dto.setZohoItemId(
                                                        item.getZohoItemId() != null
                                                                        ? item.getZohoItemId()
                                                                        : "-");

                                        dto.setDescription(
                                                        item.getDescription() != null
                                                                        ? item.getDescription()
                                                                        : "");

                                        dto.setLocation(
                                                        item.getLocation() != null
                                                                        ? item.getLocation()
                                                                        : "");

                                        return dto;
                                })
                                .toList();
        }

        @Transactional
        public List<PacketItem> createItemWithPackets(
                        CreateItemRequest req,
                        User user,
                        String plantCode) {

                assertNormalPackingUser(user);

                if (user.getId() == null) {
                        throw new AccessDeniedException(
                                        "Authenticated user ID is required");
                }

                int packetCount = req == null
                                ? 0
                                : req.getNumberOfPackets();

                validatePacketCreationRequest(
                                req,
                                packetCount);

                String actor = safeActor(
                                user.getUsername());

                Long ownerUserId = user.getId();

                LocalDateTime now = LocalDateTime.now(APP_ZONE);

                /*
                 * Business packing date selected from Inventory creation.
                 *
                 * Backward compatibility:
                 * - missing/blank packingDate => today's existing behaviour;
                 * - previous/today date => preserved on PacketItem.packedAt;
                 * - future date => rejected server-side.
                 *
                 * Packet.createdAt remains the real system creation time.
                 */
                LocalDateTime requestedPackedAt = resolveCreationPackingDateTime(
                                req.getPackingDate(),
                                now);

                PlantLocationService.PlantConfig plant = plantLocationService.getPlantConfig(
                                plantCode);

                Company company = requireCompany();

                MasterItem master = new MasterItem();

                master.setItemName(req.itemName);
                master.setCreatedByUserId(ownerUserId);
                master.setPdNo(req.pdNo);
                master.setDrawingName(req.drawingNo);
                master.setClientName(req.clientName);
                master.setAddress(req.clientAddress);
                master.setTotalPackets(packetCount);
                master.setFloor(req.floor);
                master.setPlantCode(plantCode);
                master.setItemType(PacketItemType.NORMAL);

                master = masterItemRepository.save(master);

                Packet packet = new Packet();

                packet.setId(UUID.randomUUID());
                packet.setCompany(company);
                packet.setStickerNumber(
                                packetContainerStickerNumber(
                                                plantCode,
                                                packet.getId()));
                packet.setStatus(PacketStatus.CREATED);
                packet.setCreatedBy(actor);
                packet.setCreatedAt(now);
                packet.setStickerGenerated(false);

                packet = packetRepository.save(packet);

                List<String> descriptions = req.getDescriptions();

                List<String> weights = req.getWeights();

                List<String> dimensions = req.getDimensionsList();

                List<String> remarks = req.getRemarksList();

                List<PacketItem> items = new ArrayList<>();

                for (int index = 0; index < packetCount; index++) {

                        int packetNo = index + 1;

                        PacketItem item = new PacketItem();

                        item.setId(UUID.randomUUID());
                        item.setCreatedByUserId(ownerUserId);
                        item.setPacket(packet);
                        item.setMasterItem(master);
                        item.setItemType(PacketItemType.NORMAL);

                        item.setItemName(req.itemName);
                        item.setPdNo(req.pdNo);
                        item.setDrawingNo(req.drawingNo);
                        item.setClientName(req.clientName);
                        item.setClientAddress(req.clientAddress);
                        item.setFloor(req.floor);

                        item.setDescription(
                                        getListValue(
                                                        descriptions,
                                                        index));

                        item.setWeight(
                                        getListValue(
                                                        weights,
                                                        index));

                        item.setDimensions(
                                        getListValue(
                                                        dimensions,
                                                        index));

                        item.setRemarks(
                                        getListValue(
                                                        remarks,
                                                        index));

                        item.setPacketNumber(
                                        "Pkt-" + packetNo);

                        item.setSku(
                                        buildSkuForPlant(
                                                        plantCode,
                                                        req.pdNo,
                                                        req.drawingNo,
                                                        packetNo));

                        item.setQuantity(1);
                        item.setPlantCode(plantCode);
                        item.setPackedAreaCode(
                                        plant.packedAreaCode());
                        item.setCurrentLocationCode(null);
                        item.setFgAreaCode(
                                        plant.fgAreaCode());
                        item.setFgZoneCode(null);
                        item.setLocation("FLOOR");
                        item.setStatus("CREATED");
                        item.setCreatedBy(actor);
                        item.setPackedBy(null);
                        item.setPackedAt(requestedPackedAt);

                        items.add(item);
                }

                return packetItemRepository.saveAll(
                                items);
        }

        private String getListValue(
                        List<String> values,
                        int index) {

                if (values == null ||
                                index < 0 ||
                                index >= values.size() ||
                                values.get(index) == null) {
                        return "";
                }

                return values.get(index);
        }

        @Transactional(readOnly = true)
        public byte[] previewStickerForPacketItem(
                        UUID itemId,
                        String factoryFloor,
                        boolean showCompanyHeader,
                        Set<String> allowedPlants) {
                PacketItem item = packetItemRepository.findById(itemId)
                                .orElseThrow(() -> new RuntimeException("Item not found"));

                if (effectiveItemType(item) == PacketItemType.HARDWARE) {
                        throw new AccessDeniedException(
                                        "Hardware sticker preview must use the hardware packet API");
                }

                assertPlantAccess(
                                item.getPlantCode(),
                                allowedPlants);

                return previewStickerInternal(
                                item,
                                factoryFloor,
                                showCompanyHeader);
        }

        private byte[] generateStickerInternal(
                        UUID itemId,
                        String factoryFloor,
                        boolean showCompanyHeader,
                        User user,
                        Set<String> allowedPlants,
                        PacketItemType expectedType,
                        String actorOverride) {
                return generateStickerInternalWithRouting(
                                itemId,
                                factoryFloor,
                                showCompanyHeader,
                                user,
                                allowedPlants,
                                expectedType,
                                actorOverride,
                                null,
                                null,
                                null);
        }

        private byte[] generateStickerInternalWithRouting(
                        UUID itemId,
                        String factoryFloor,
                        boolean showCompanyHeader,
                        User user,
                        Set<String> allowedPlants,
                        PacketItemType expectedType,
                        String actorOverride,
                        String utlDispatchMode,
                        String utlDispatchTargetUsername,
                        String utlDispatchTargetPlantCode) {
                /*
                 * Lock this PacketItem for the complete sticker-generation
                 * transaction.
                 *
                 * This prevents:
                 * - duplicate simultaneous prints;
                 * - Admin Center rollback during print;
                 * - print during permanent deletion.
                 */
                PacketItem item = packetItemRepository
                                .findByIdForStickerGeneration(itemId)
                                .orElseThrow(() -> new RuntimeException("Item not found"));

                if (expectedType == PacketItemType.HARDWARE) {

                        assertHardwarePacketWriteAccess(
                                        item,
                                        user,
                                        allowedPlants);

                } else if (user != null) {

                        /*
                         * Current authenticated normal-packing flow.
                         */
                        assertNormalPacketAccess(
                                        item,
                                        user,
                                        allowedPlants);

                } else {

                        /*
                         * Legacy/internal compatibility flow.
                         *
                         * Keep the old plant-based behaviour for existing
                         * backend callers that do not provide a User.
                         */
                        if (effectiveItemType(item) == PacketItemType.HARDWARE) {

                                throw new AccessDeniedException(
                                                "Hardware packets must use the hardware packet API");
                        }

                        assertLegacyPlantAccess(
                                        item.getPlantCode(),
                                        allowedPlants);
                }

                String plantCode = item.getPlantCode();

                /*
                 * WR-38 has no AL-style composite SKU. Product Code (pdNo) is the
                 * canonical SKU for the complete Wriver flow. Repair older rows
                 * lazily when they are printed/reprinted without touching AL plants.
                 */
                if (isWr38PlantCode(plantCode)) {
                        item.setSku(
                                        requireWr38ProductCode(
                                                        item.getPdNo()));
                }

                PlantLocationService.PlantConfig plant = plantLocationService.getPlantConfig(
                                plantCode);

                java.util.Optional<UtlPacketRouting> utlRouting = java.util.Optional.empty();

                if (user != null && currentUserService.isUtlPacking(user)) {
                        if (utlWorkflowService == null) {
                                throw new IllegalStateException(
                                                "UTL workflow service is not available");
                        }

                        utlRouting = utlWorkflowService.applyRoutingForSticker(
                                        item,
                                        user,
                                        utlDispatchMode,
                                        utlDispatchTargetUsername,
                                        utlDispatchTargetPlantCode);

                        /* UTL full stickers must never render the ALSORG header. */
                        showCompanyHeader = false;
                }

                String authenticatedUsername = user != null
                                && user.getUsername() != null
                                && !user.getUsername().isBlank()
                                                ? user.getUsername().trim()
                                                : null;

                String actor = firstNonBlankValue(
                                actorOverride,
                                authenticatedUsername,
                                "SYSTEM");

                LocalDateTime now = LocalDateTime.now(
                                java.time.ZoneId.of(
                                                "Asia/Kolkata"));

                /*
                 * Preserve an explicit creation/admin-selected packing date.
                 * Legacy PacketItems that never had packedAt keep the old behaviour
                 * and receive the actual sticker-generation timestamp.
                 */
                LocalDateTime effectivePackedAt = item.getPackedAt() != null
                                ? item.getPackedAt()
                                : now;

                String previousStatus = item.getStatus() != null &&
                                !item.getStatus().isBlank()
                                                ? item.getStatus()
                                                : "CREATED";

                /*
                 * Correct print iteration calculation.
                 *
                 * We must check both:
                 * - current PacketItem.printIteration;
                 * - maximum historical StickerHistory iteration.
                 *
                 * This is required after an Admin Center rollback clears the
                 * active sticker but preserves sticker history.
                 */
                Long maximumHistoryIteration = stickerHistoryRepository
                                .findMaximumPrintIteration(
                                                itemId);

                long historyIteration = maximumHistoryIteration == null
                                ? 0L
                                : Math.max(
                                                maximumHistoryIteration,
                                                0L);

                long currentItemIteration = item.getPrintIteration() == null
                                ? 0L
                                : Math.max(
                                                item.getPrintIteration(),
                                                0L);

                long iteration = Math.max(
                                historyIteration,
                                currentItemIteration) + 1L;

                /*
                 * Generate a new unique sticker number for every print.
                 */
                String stickerNumber = stickerSequenceService
                                .generateNextStickerNumberForPlant(plantCode);

                item.setStickerNumber(
                                stickerNumber);

                item.setPrintIteration(
                                iteration);

                item.setStatus("READY");

                item.setLocation(
                                plant.packedAreaCode());

                item.setPackedAreaCode(
                                plant.packedAreaCode());

                item.setCurrentLocationCode(
                                plant.packedAreaCode());

                item.setFgAreaCode(
                                plant.fgAreaCode());

                item.setFgZoneCode(null);

                item.setWarehouseCode(null);
                item.setPackedBy(actor);
                item.setPackedAt(effectivePackedAt);

                packetItemRepository.save(item);

                /*
                 * Synchronize the parent Packet flag.
                 */
                if (item.getPacket() != null) {
                        Packet parentPacket = item.getPacket();

                        parentPacket.setStickerGenerated(
                                        true);

                        packetRepository.save(
                                        parentPacket);
                }

                /*
                 * Create the DispatchedItem only when one does not already exist.
                 */
                dispatchedItemService
                                .createFromPacketItem(item);

                /*
                 * Prefer packetItemId linkage.
                 *
                 * Fall back to your existing primary-key convention:
                 * zohoItemId = PacketItem.id.toString().
                 */
                DispatchedItem dispatchedItem = dispatchedRepo
                                .findByPacketItemId(
                                                item.getId())
                                .or(() -> dispatchedRepo.findById(
                                                item.getId().toString()))
                                .orElseThrow(() -> new RuntimeException(
                                                "Dispatch record was not created for packet item: "
                                                                + item.getId()));

                dispatchedItem.setPacketItemId(
                                item.getId());

                if (item.getPacket() != null) {
                        dispatchedItem.setPacketId(
                                        item.getPacket().getId());
                }

                dispatchedItem.setStatus(
                                ItemDispatchStatus.READY);

                dispatchedItem.setStock(1);

                dispatchedItem.setStickerNumber(
                                stickerNumber);

                dispatchedItem.setPlantCode(
                                plantCode);

                dispatchedItem.setPackedAreaCode(
                                plant.packedAreaCode());

                dispatchedItem.setCurrentLocationCode(
                                plant.packedAreaCode());

                dispatchedItem.setFgAreaCode(
                                plant.fgAreaCode());

                dispatchedItem.setFgZoneCode(null);

                dispatchedItem.setWarehouseCode(null);
                dispatchedItem.setGatePassNumber(null);
                dispatchedItem.setFromLocation(null);
                dispatchedItem.setStoredAt(null);

                dispatchedItem.setLocation(
                                plant.packedAreaCode());

                dispatchedItem.setFloor(
                                item.getFloor());

                dispatchedItem.setPackedAt(effectivePackedAt);
                dispatchedItem.setPackedBy(actor);
                dispatchedItem.setItemType(
                                item.getItemType() != null
                                                ? item.getItemType()
                                                : PacketItemType.NORMAL);

                dispatchedItem.setLinkedPacketItemId(
                                item.getLinkedPacketItemId());

                dispatchedItem.setLinkedMasterItemId(
                                item.getLinkedMasterItemId());

                /*
                 * Do not rewrite the original creation time on every reprint.
                 */
                if (dispatchedItem.getCreatedAt() == null) {
                        dispatchedItem.setCreatedAt(now);
                }

                if (dispatchedItem.getCreatedBy() == null ||
                                dispatchedItem.getCreatedBy().isBlank()) {
                        dispatchedItem.setCreatedBy(
                                        firstNonBlankValue(
                                                        item.getCreatedBy(),
                                                        item.getPackedBy(),
                                                        actor));
                }

                if (utlRouting.isPresent()) {
                        utlWorkflowService.applyOperationalDispatchProjection(
                                        dispatchedItem,
                                        utlRouting.get());
                }

                dispatchedRepo.save(
                                dispatchedItem);

                byte[] pdfBytes;

                if (isWr38Item(item)) {
                        /*
                         * WR-38 keeps its approved Illustrator artwork. Only the
                         * PackFlow QR identity artifact changes; all lifecycle,
                         * history, audit and dispatch synchronization above remains
                         * exactly the same as normal sticker generation.
                         */
                        pdfBytes = productQrPdfService.generate(
                                        item,
                                        stickerNumber,
                                        iteration,
                                        false);
                } else {
                        StickerPdfData pdf = buildStickerPdfData(
                                        item,
                                        stickerNumber,
                                        factoryFloor,
                                        showCompanyHeader,
                                        iteration,
                                        false);

                        pdfBytes = pdfService.generateSticker(pdf);
                }

                StickerHistory history = new StickerHistory();

                history.setPacketItem(item);

                history.setStickerNumber(
                                stickerNumber);

                history.setPdfData(
                                pdfBytes);

                history.setPrintIteration(
                                iteration);

                history.setGeneratedBy(
                                actor);

                history.setReason(
                                iteration > 1
                                                ? "REPRINT"
                                                : "INITIAL");

                history.setGeneratedAt(now);

                stickerHistoryRepository.save(
                                history);

                activityLogService.log(
                                item.getId().toString(),

                                iteration > 1
                                                ? "STICKER REPRINTED"
                                                : "ITEM PACKED",

                                actor,
                                "PACKING",
                                previousStatus,
                                "READY",
                                null);

                return pdfBytes;
        }

        @Transactional
        public PacketItem adminUpdateStickerDetails(
                        UUID itemId,
                        UpdatePacketItemRequest req) {
                PacketItem item = packetItemRepository.findById(itemId)
                                .orElseThrow(() -> new RuntimeException("Item not found"));

                if (effectiveItemType(item) == PacketItemType.HARDWARE) {
                        throw new AccessDeniedException(
                                        "Hardware sticker details must be edited through the hardware packet API");
                }

                item.setItemName(keepExistingIfNull(req.getItemName(), item.getItemName()));
                item.setPdNo(keepExistingIfNull(req.getPdNo(), item.getPdNo()));
                item.setDrawingNo(keepExistingIfNull(req.getDrawingNo(), item.getDrawingNo()));
                item.setClientName(keepExistingIfNull(req.getClientName(), item.getClientName()));
                item.setClientAddress(keepExistingIfNull(req.getClientAddress(), item.getClientAddress()));
                item.setFloor(keepExistingIfNull(req.getFloor(), item.getFloor()));
                item.setDescription(keepExistingIfNull(req.getDescription(), item.getDescription()));
                item.setWeight(keepExistingIfNull(req.getWeight(), item.getWeight()));
                item.setDimensions(keepExistingIfNull(req.getDimensions(), item.getDimensions()));
                item.setRemarks(keepExistingIfNull(req.getRemarks(), item.getRemarks()));
                item.setLocation(keepExistingIfNull(req.getLocation(), item.getLocation()));

                int packetNo = extractPacketNo(
                                item.getPacketNumber(),
                                item.getSku());

                String rebuiltSku = buildSkuForPlant(
                                item.getPlantCode(),
                                item.getPdNo(),
                                item.getDrawingNo(),
                                packetNo);

                item.setSku(rebuiltSku);

                PacketItem saved = packetItemRepository.save(item);

                dispatchedRepo
                                .findByPacketItemId(itemId)
                                .or(() -> dispatchedRepo.findById(
                                                itemId.toString()))
                                .ifPresent(d -> {
                                        d.setName(saved.getItemName());
                                        d.setSku(saved.getSku());
                                        d.setPdNo(saved.getPdNo());
                                        d.setDrawingNo(saved.getDrawingNo());
                                        d.setDescription(saved.getDescription());
                                        d.setClientName(saved.getClientName());
                                        d.setLocation(saved.getLocation());
                                        d.setFloor(saved.getFloor());

                                        dispatchedRepo.save(d);
                                });

                /*
                 * StickerHistory stores immutable-at-print-time PDF bytes.
                 * An Admin correction to current sticker fields must therefore rebuild
                 * those bytes, otherwise the generated-history row can show current
                 * metadata while Open PDF still displays the previous values.
                 * Audit metadata on each StickerHistory row is preserved.
                 */
                stickerHistoryPdfRefreshService.refreshAllForPacketItems(
                                List.of(saved));

                return saved;
        }

        private String keepExistingIfNull(String newValue, String oldValue) {
                return newValue == null ? oldValue : newValue;
        }

        /**
         * ADMIN-only packing-date correction used from the Dispatch page.
         *
         * Business guarantees:
         * - PacketItem.packedAt is the source of truth for sticker packing date.
         * - Matching DispatchedItem.packedAt is kept in sync for reports/UI.
         * - Existing StickerHistory rows keep their original audit metadata, but
         * their stored PDF bytes are rebuilt so opening an old sticker-history
         * entry immediately shows the corrected packing date.
         * - Sticker number, print iteration, generatedBy, generatedAt and reason
         * are never rewritten by a date correction.
         */
        @Transactional
        public PacketItem adminUpdatePackingDateForDispatchedItem(
                        String dispatchedItemId,
                        String packingDate,
                        String updatedBy) {

                if (dispatchedItemId == null || dispatchedItemId.isBlank()) {
                        throw new IllegalArgumentException(
                                        "Dispatch item ID is required");
                }

                String cleanDispatchItemId = dispatchedItemId.trim();

                DispatchedItem dispatchedItem = dispatchedRepo
                                .findById(cleanDispatchItemId)
                                .orElseThrow(() -> new RuntimeException(
                                                "Dispatch item not found"));

                String actor = safeActor(updatedBy);

                /*
                 * IMPORTANT WORKFLOW GUARANTEE
                 * ----------------------------
                 * This Admin-only correction must NEVER create a Packet/PacketItem,
                 * change movement status, location, stock, warehouse state, gate pass,
                 * FG/PKD state, challan state or dispatch state.
                 *
                 * There are two legitimate record origins in the current system:
                 *
                 * 1) PACKING-origin item
                 * PacketItem -> DispatchedItem linkage exists (or can be recovered
                 * from an existing Packet/PacketItem record).
                 *
                 * 2) WAREHOUSE-IMPORT-origin item
                 * Warehouse Excel import created the DispatchedItem directly.
                 * Such a row can legitimately have no PacketItem/Packet linkage.
                 *
                 * For (1), preserve the existing synchronized behaviour:
                 * PacketItem.packedAt + DispatchedItem.packedAt + StickerHistory PDFs.
                 *
                 * For (2), update ONLY DispatchedItem.packedAt. Do not manufacture a
                 * PacketItem merely to support an Admin date override.
                 */
                PacketItem packetItem = resolveExistingPacketItemForAdminPackingDate(
                                dispatchedItem);

                if (packetItem == null) {
                        if (isStandaloneWarehouseImportedDispatchItem(dispatchedItem)) {
                                return adminUpdateStandaloneDispatchedPackingDate(
                                                dispatchedItem,
                                                packingDate,
                                                actor);
                        }

                        /*
                         * A packet-origin row that merely has broken/stale linkage is a
                         * different case. Do not silently downgrade it to standalone,
                         * because doing so could leave an existing sticker history out
                         * of sync. Fail safely for that genuinely inconsistent record.
                         */
                        throw new IllegalStateException(
                                        "Existing PacketItem linkage could not be resolved for this packet-origin Dispatch item. "
                                                        +
                                                        "Packing date was not changed.");
                }

                /*
                 * Repair only existing linkage fields when an original PacketItem was
                 * successfully resolved. No workflow fields are changed here.
                 */
                boolean dispatchLinkChanged = !Objects.equals(
                                dispatchedItem.getPacketItemId(),
                                packetItem.getId());

                if (dispatchLinkChanged) {
                        dispatchedItem.setPacketItemId(packetItem.getId());
                }

                if (packetItem.getPacket() != null &&
                                !Objects.equals(
                                                dispatchedItem.getPacketId(),
                                                packetItem.getPacket().getId())) {
                        dispatchedItem.setPacketId(packetItem.getPacket().getId());
                        dispatchLinkChanged = true;
                }

                if (dispatchLinkChanged) {
                        dispatchedRepo.save(dispatchedItem);
                }

                return adminUpdatePackingDate(
                                packetItem.getId(),
                                packingDate,
                                actor);
        }

        /**
         * Resolve an already-existing PacketItem only.
         *
         * Returning null is intentional: warehouse-imported inventory rows are valid
         * standalone DispatchedItem records and must not be forced into the Packet
         * lifecycle simply because an Admin edits their packing date.
         */
        private PacketItem resolveExistingPacketItemForAdminPackingDate(
                        DispatchedItem dispatchedItem) {

                if (dispatchedItem == null) {
                        throw new IllegalArgumentException(
                                        "Dispatch item is required");
                }

                /* 1) Current explicit relationship, when still valid. */
                if (dispatchedItem.getPacketItemId() != null) {
                        PacketItem linked = packetItemRepository
                                        .findById(dispatchedItem.getPacketItemId())
                                        .orElse(null);

                        if (linked != null) {
                                return linked;
                        }
                }

                /*
                 * 2) Original PackFlow convention:
                 * DispatchedItem.zohoItemId == PacketItem.id.toString().
                 *
                 * Warehouse-import rows also use UUID-looking IDs, so a parseable UUID
                 * alone is not treated as proof of PacketItem origin. The PacketItem
                 * must actually exist.
                 */
                try {
                        UUID originalPacketItemId = UUID.fromString(
                                        dispatchedItem.getZohoItemId());

                        PacketItem original = packetItemRepository
                                        .findById(originalPacketItemId)
                                        .orElse(null);

                        if (original != null) {
                                return original;
                        }
                } catch (Exception ignored) {
                        // Non-UUID legacy/import ID. Try existing packet membership below.
                }

                /*
                 * 3) Existing parent packet membership only. No reconstruction.
                 * Prefer exact sticker number, then SKU, and finally a sole child.
                 */
                if (dispatchedItem.getPacketId() != null) {
                        List<PacketItem> packetItems = packetItemRepository
                                        .findByPacketId(dispatchedItem.getPacketId());

                        if (packetItems != null && !packetItems.isEmpty()) {
                                if (dispatchedItem.getStickerNumber() != null &&
                                                !dispatchedItem.getStickerNumber().isBlank()) {
                                        PacketItem bySticker = packetItems.stream()
                                                        .filter(Objects::nonNull)
                                                        .filter(candidate -> candidate.getStickerNumber() != null &&
                                                                        candidate.getStickerNumber()
                                                                                        .equalsIgnoreCase(
                                                                                                        dispatchedItem.getStickerNumber()))
                                                        .findFirst()
                                                        .orElse(null);

                                        if (bySticker != null) {
                                                return bySticker;
                                        }
                                }

                                if (dispatchedItem.getSku() != null &&
                                                !dispatchedItem.getSku().isBlank()) {
                                        PacketItem bySku = packetItems.stream()
                                                        .filter(Objects::nonNull)
                                                        .filter(candidate -> candidate.getSku() != null &&
                                                                        candidate.getSku()
                                                                                        .equalsIgnoreCase(
                                                                                                        dispatchedItem.getSku()))
                                                        .findFirst()
                                                        .orElse(null);

                                        if (bySku != null) {
                                                return bySku;
                                        }
                                }

                                if (packetItems.size() == 1 &&
                                                packetItems.get(0) != null) {
                                        return packetItems.get(0);
                                }
                        }
                }

                return null;
        }

        private boolean isStandaloneWarehouseImportedDispatchItem(
                        DispatchedItem dispatchedItem) {

                if (dispatchedItem == null) {
                        return false;
                }

                /*
                 * Warehouse CSV import creates a DispatchedItem directly. It does not
                 * create Packet/PacketItem linkage or a packing sticker. These three
                 * conditions therefore distinguish that legitimate origin from a
                 * packet-origin row whose relationship is unexpectedly broken.
                 */
                boolean noPacketLink = dispatchedItem.getPacketId() == null;
                boolean noPacketItemLink = dispatchedItem.getPacketItemId() == null;
                boolean noSticker = dispatchedItem.getStickerNumber() == null ||
                                dispatchedItem.getStickerNumber().isBlank();

                return noPacketLink && noPacketItemLink && noSticker;
        }

        /**
         * Admin packing-date correction for a standalone warehouse-imported row.
         *
         * There is deliberately no PacketItem creation here. The import route created
         * this record directly as a DispatchedItem, so the correction stays within the
         * same persistence model and cannot alter the normal packing workflow.
         */
        private PacketItem adminUpdateStandaloneDispatchedPackingDate(
                        DispatchedItem dispatchedItem,
                        String packingDate,
                        String actor) {

                java.time.LocalDate parsedPackingDate = parseAdminPackingDate(
                                packingDate);

                LocalDateTime previousPackedAt = dispatchedItem.getPackedAt();

                java.time.LocalTime preservedTime;

                if (previousPackedAt != null) {
                        preservedTime = previousPackedAt.toLocalTime();
                } else if (dispatchedItem.getCreatedAt() != null) {
                        /*
                         * Warehouse import already has a creation timestamp. Reusing its
                         * time component gives the standalone row a stable time without
                         * pretending that a Packet packing event occurred.
                         */
                        preservedTime = dispatchedItem.getCreatedAt().toLocalTime();
                } else if (dispatchedItem.getStoredAt() != null) {
                        preservedTime = dispatchedItem.getStoredAt().toLocalTime();
                } else {
                        preservedTime = LocalDateTime.now(APP_ZONE).toLocalTime();
                }

                LocalDateTime correctedPackedAt = parsedPackingDate
                                .atTime(preservedTime);

                /*
                 * ONLY packedAt is changed. Do not touch status/location/stock/etc.
                 */
                dispatchedItem.setPackedAt(correctedPackedAt);
                dispatchedRepo.save(dispatchedItem);

                activityLogService.log(
                                dispatchedItem.getZohoItemId(),
                                "PACKING DATE UPDATED",
                                actor,
                                "ADMIN",
                                previousPackedAt == null
                                                ? null
                                                : previousPackedAt.toLocalDate().toString(),
                                parsedPackingDate.toString(),
                                "Standalone warehouse-imported Dispatch item; no PacketItem linkage created");

                /*
                 * The controller/frontend only require a successful response. Returning
                 * null here is deliberate because no PacketItem exists for this origin.
                 */
                return null;
        }

        private java.time.LocalDate parseAdminPackingDate(
                        String packingDate) {

                if (packingDate == null || packingDate.isBlank()) {
                        throw new IllegalArgumentException(
                                        "Packing date is required");
                }

                try {
                        return java.time.LocalDate.parse(
                                        packingDate.trim());
                } catch (Exception exception) {
                        throw new IllegalArgumentException(
                                        "Packing date must be in yyyy-MM-dd format");
                }
        }

        @Transactional
        public PacketItem adminUpdatePackingDate(
                        UUID itemId,
                        String packingDate,
                        String updatedBy) {

                final java.time.LocalDate parsedPackingDate = parseAdminPackingDate(packingDate);

                PacketItem item = packetItemRepository
                                .findById(itemId)
                                .orElseThrow(() -> new RuntimeException(
                                                "Item not found"));

                LocalDateTime previousPackedAt = item.getPackedAt();

                java.time.LocalTime preservedTime = previousPackedAt != null
                                ? previousPackedAt.toLocalTime()
                                : LocalDateTime.now(APP_ZONE).toLocalTime();

                LocalDateTime correctedPackedAt = parsedPackingDate.atTime(preservedTime);

                item.setPackedAt(correctedPackedAt);

                PacketItem saved = packetItemRepository.save(item);

                /*
                 * Dispatch register/report packing date must change together with
                 * the PacketItem date. Support both the modern packetItemId link
                 * and the legacy id convention.
                 */
                dispatchedRepo
                                .findByPacketItemId(itemId)
                                .or(() -> dispatchedRepo.findById(
                                                itemId.toString()))
                                .ifPresent(dispatchedItem -> {
                                        dispatchedItem.setPackedAt(correctedPackedAt);
                                        dispatchedRepo.save(dispatchedItem);
                                });

                /*
                 * StickerHistoryController serves history.pdfData directly.
                 * Rebuild every stored history PDF so INITIAL, REPRINT and legacy
                 * history downloads all display the corrected packing date.
                 */
                List<StickerHistory> histories = stickerHistoryRepository
                                .findByPacketItem_IdOrderByGeneratedAtDesc(itemId);

                if (histories != null && !histories.isEmpty() && !isWr38Item(saved)) {
                        /*
                         * A WR-38 history PDF is an opaque QR identity artifact, so
                         * product/date edits do not require rewriting it. The scan
                         * resolves the current database values. All other plants keep
                         * the existing self-refreshing sticker-history behavior.
                         */
                        for (StickerHistory history : histories) {
                                if (history == null) {
                                        continue;
                                }

                                String historyStickerNumber = firstNonBlankValue(
                                                history.getStickerNumber(),
                                                saved.getStickerNumber());

                                if (historyStickerNumber == null ||
                                                historyStickerNumber.isBlank()) {
                                        continue;
                                }

                                long historyIteration = history.getPrintIteration() != null &&
                                                history.getPrintIteration() > 0
                                                                ? history.getPrintIteration()
                                                                : saved.getPrintIteration() != null &&
                                                                                saved.getPrintIteration() > 0
                                                                                                ? saved.getPrintIteration()
                                                                                                : 1L;

                                StickerPdfData pdf = buildStickerPdfData(
                                                saved,
                                                historyStickerNumber,
                                                saved.getFloor(),
                                                true,
                                                historyIteration,
                                                false);

                                history.setPdfData(
                                                pdfService.generateSticker(pdf));
                        }

                        stickerHistoryRepository.saveAll(histories);
                }

                String actor = safeActor(updatedBy);

                activityLogService.log(
                                itemId.toString(),
                                "PACKING DATE UPDATED",
                                actor,
                                "ADMIN",
                                previousPackedAt == null
                                                ? null
                                                : previousPackedAt.toLocalDate().toString(),
                                parsedPackingDate.toString(),
                                null);

                return saved;
        }

        @Transactional
        public void deleteNormalItem(
                        UUID itemId,
                        User user,
                        Set<String> allowedPlants) {
                PacketItem item = packetItemRepository.findById(itemId)
                                .orElseThrow(() -> new RuntimeException("Item not found"));

                assertNormalPacketAccess(
                                item,
                                user,
                                allowedPlants);

                /*
                 * Normal user delete rule:
                 * only newly created packet.
                 */
                if (!"CREATED".equalsIgnoreCase(
                                item.getStatus())) {
                        throw new RuntimeException(
                                        "Only newly created items can be deleted");
                }

                /*
                 * Normal user cannot delete a printed item.
                 */
                if (item.getStickerNumber() != null &&
                                !item.getStickerNumber().isBlank()) {
                        throw new RuntimeException(
                                        "Cannot delete printed item");
                }

                UUID masterItemId = item.getMasterItem() == null
                                ? null
                                : item.getMasterItem().getId();

                UUID packetId = item.getPacket() == null
                                ? null
                                : item.getPacket().getId();

                packetItemRepository.delete(item);

                /*
                 * Make sure count queries below see the deletion.
                 */
                packetItemRepository.flush();

                /*
                 * Recalculate master total.
                 */
                if (masterItemId != null) {
                        long remaining = packetItemRepository
                                        .countByMasterItemId(
                                                        masterItemId);

                        masterItemRepository
                                        .findById(masterItemId)
                                        .ifPresent(master -> {
                                                if (remaining == 0) {
                                                        masterItemRepository.delete(
                                                                        master);

                                                        return;
                                                }

                                                master.setTotalPackets(
                                                                Math.toIntExact(remaining));

                                                masterItemRepository.save(
                                                                master);
                                        });
                }

                /*
                 * Delete internal Packet only when no PacketItem
                 * references it.
                 */
                if (packetId != null) {
                        long remainingInPacket = packetItemRepository
                                        .countByPacketId(packetId);

                        if (remainingInPacket == 0) {
                                packetRepository
                                                .findById(packetId)
                                                .ifPresent(
                                                                packetRepository::delete);
                        }
                }
        }

        @Transactional
        public List<PacketItem> addPackets(
                        UUID masterItemId,
                        CreateItemRequest req) {
                return addPackets(masterItemId, req, "SYSTEM", null);
        }

        @Transactional
        public List<PacketItem> addPackets(
                        UUID masterItemId,
                        CreateItemRequest req,
                        String createdBy) {
                return addPackets(masterItemId, req, createdBy, null);
        }

        @Transactional
        public List<PacketItem> addPackets(
                        UUID masterItemId,
                        CreateItemRequest req,
                        String createdBy,
                        Set<String> allowedPlants) {
                String actor = safeActor(createdBy);
                LocalDateTime now = LocalDateTime.now(APP_ZONE);

                MasterItem master = requireMasterForPacketAppend(
                                masterItemId);

                String plantCode = master.getPlantCode();

                assertPlantAccess(plantCode, allowedPlants);

                PlantLocationService.PlantConfig plant = plantLocationService.getPlantConfig(plantCode);

                // ✅ GET COMPANY (same as before)
                Company company = requireCompany();

                if (master.getItemType() == PacketItemType.HARDWARE) {
                        throw new AccessDeniedException(
                                        "Hardware master items must be managed through the hardware packet API");
                }
                // ✅ CREATE NEW PACKET (MANDATORY)
                Packet packet = new Packet();
                packet.setId(UUID.randomUUID());
                packet.setCompany(company);
                packet.setStickerNumber(
                                packetContainerStickerNumber(
                                                plantCode,
                                                packet.getId()));
                packet.setStatus(PacketStatus.CREATED);
                packet.setCreatedBy(actor);
                packet.setCreatedAt(now);
                packet.setStickerGenerated(false);

                packet = packetRepository.save(packet);

                long existingCount = packetItemRepository.countByMasterItemId(masterItemId);

                int start = (int) existingCount + 1;

                List<PacketItem> items = new ArrayList<>();
                List<String> descriptions = req.getDescriptions();
                List<String> weights = req.getWeights();
                List<String> dimensionsList = req.getDimensionsList();
                List<String> remarksList = req.getRemarksList();
                int toCreate = req.numberOfPackets;

                for (int i = 0; i < toCreate; i++) {

                        int packetNo = start + i;

                        PacketItem item = new PacketItem();

                        item.setId(UUID.randomUUID());

                        // ✅ FIXED LINKS
                        item.setMasterItem(master);
                        item.setPacket(packet); // 🔥 THIS WAS MISSING
                        item.setItemType(PacketItemType.NORMAL);
                        item.setItemName(master.getItemName());
                        item.setPdNo(master.getPdNo());
                        item.setDrawingNo(master.getDrawingName());
                        item.setClientName(master.getClientName());
                        item.setClientAddress(master.getAddress());
                        item.setFloor(master.getFloor());
                        item.setPlantCode(plantCode);
                        item.setPackedAreaCode(plant.packedAreaCode());
                        item.setCurrentLocationCode(null);
                        item.setFgAreaCode(plant.fgAreaCode());
                        item.setFgZoneCode(null);
                        item.setPacketNumber("Pkt-" + packetNo);

                        String sku = buildSkuForPlant(
                                        plantCode,
                                        master.getPdNo(),
                                        master.getDrawingName(),
                                        packetNo);

                        String desc = (descriptions != null && descriptions.size() > i)
                                        ? descriptions.get(i)
                                        : "";

                        String weight = (weights != null && weights.size() > i)
                                        ? weights.get(i)
                                        : "";

                        String dim = (dimensionsList != null && dimensionsList.size() > i)
                                        ? dimensionsList.get(i)
                                        : "";

                        String remark = (remarksList != null && remarksList.size() > i)
                                        ? remarksList.get(i)
                                        : "";

                        item.setDescription(desc);
                        item.setWeight(weight);
                        item.setDimensions(dim);
                        item.setRemarks(remark);
                        item.setSku(sku);
                        item.setQuantity(1);
                        item.setLocation("FLOOR");
                        item.setStatus("CREATED");
                        item.setCreatedBy(actor);

                        items.add(item);
                }

                return packetItemRepository.saveAll(items);
        }

        private void assertNormalPacketAccess(
                        PacketItem item,
                        User user,
                        Set<String> allowedPlants) {

                if (item == null) {
                        throw new AccessDeniedException(
                                        "Packet item is missing");
                }

                if (effectiveItemType(item) == PacketItemType.HARDWARE) {

                        throw new AccessDeniedException(
                                        "Hardware packets must be accessed through the hardware packet API");
                }

                assertNormalPackingUser(user);

                if (currentUserService.isAdmin(user)) {
                        return;
                }

                if (!isNormalPacketOwnedByUser(
                                item,
                                user)) {

                        throw new AccessDeniedException(
                                        "You cannot access a packet created by another user");
                }

                /*
                 * Normal inventory read/edit/delete/print is owner-scoped.
                 * Plant access is checked during creation.
                 */
        }

        private boolean isNormalPacketOwnedByUser(
                        PacketItem item,
                        User user) {
                if (item == null || user == null) {
                        return false;
                }

                /*
                 * Preferred modern ownership check.
                 */
                if (item.getCreatedByUserId() != null &&
                                user.getId() != null) {

                        return Objects.equals(
                                        item.getCreatedByUserId(),
                                        user.getId());
                }

                /*
                 * Legacy fallback for rows created before
                 * created_by_user_id was populated.
                 */
                String itemCreator = item.getCreatedBy() == null
                                ? ""
                                : item.getCreatedBy().trim();

                String username = user.getUsername() == null
                                ? ""
                                : user.getUsername().trim();

                return !itemCreator.isBlank() &&
                                !username.isBlank() &&
                                itemCreator.equalsIgnoreCase(
                                                username);
        }

        private void assertHardwarePacketReadAccess(
                        PacketItem item,
                        User user,
                        Set<String> allowedPlants) {
                if (effectiveItemType(item) != PacketItemType.HARDWARE) {
                        throw new AccessDeniedException(
                                        "This is not a hardware packet");
                }

                if (currentUserService.isAdmin(user)) {
                        return;
                }

                /*
                 * Dispatch receives read-only access by assigned plant.
                 */
                if (currentUserService.isDispatch(user)) {
                        assertPlantAccess(
                                        item.getPlantCode(),
                                        allowedPlants);

                        return;
                }

                if (!currentUserService.isHardwarePacking(user)) {
                        throw new AccessDeniedException(
                                        "Hardware packing access required");
                }

                if (!Objects.equals(
                                item.getCreatedByUserId(),
                                user.getId())) {
                        throw new AccessDeniedException(
                                        "You cannot access hardware packets created by another user");
                }

                assertPlantAccess(
                                item.getPlantCode(),
                                allowedPlants);
        }

        private void assertHardwarePacketWriteAccess(
                        PacketItem item,
                        User user,
                        Set<String> allowedPlants) {
                if (effectiveItemType(item) != PacketItemType.HARDWARE) {
                        throw new AccessDeniedException(
                                        "This is not a hardware packet");
                }

                if (currentUserService.isAdmin(user)) {
                        return;
                }

                /*
                 * DISPATCH deliberately does not pass this check.
                 */
                if (!currentUserService.isHardwarePacking(user)) {
                        throw new AccessDeniedException(
                                        "Hardware packing write access required");
                }

                if (!Objects.equals(
                                item.getCreatedByUserId(),
                                user.getId())) {
                        throw new AccessDeniedException(
                                        "You cannot modify hardware packets created by another user");
                }

                assertPlantAccess(
                                item.getPlantCode(),
                                allowedPlants);
        }

        @Transactional
        public List<PacketItem> addPackets(
                        UUID masterItemId,
                        CreateItemRequest req,
                        User user,
                        Set<String> allowedPlants) {

                assertNormalPackingUser(user);

                if (user.getId() == null) {
                        throw new AccessDeniedException(
                                        "Authenticated user ID is required");
                }

                int toCreate = req == null
                                ? 0
                                : req.getNumberOfPackets();

                validatePacketCreationRequest(
                                req,
                                toCreate);

                MasterItem master = requireMasterForPacketAppend(
                                masterItemId);

                if (master.getItemType() == PacketItemType.HARDWARE) {

                        throw new AccessDeniedException(
                                        "Hardware master items must be managed through the hardware packet API");
                }

                assertNormalMasterAccess(
                                master,
                                user);

                String plantCode = master.getPlantCode();

                /*
                 * Creation remains plant-aware even though the
                 * Inventory read is owner-scoped.
                 */
                if (!currentUserService.isAdmin(user)) {
                        assertPlantAccess(
                                        plantCode,
                                        allowedPlants);
                }

                PlantLocationService.PlantConfig plant = plantLocationService.getPlantConfig(
                                plantCode);

                Company company = requireCompany();

                String actor = safeActor(
                                user.getUsername());

                Long ownerUserId = master.getCreatedByUserId() != null
                                ? master.getCreatedByUserId()
                                : user.getId();

                LocalDateTime now = LocalDateTime.now(APP_ZONE);

                Packet packet = new Packet();

                packet.setId(UUID.randomUUID());
                packet.setCompany(company);
                packet.setStickerNumber(
                                packetContainerStickerNumber(
                                                plantCode,
                                                packet.getId()));
                packet.setStatus(PacketStatus.CREATED);
                packet.setCreatedBy(actor);
                packet.setCreatedAt(now);
                packet.setStickerGenerated(false);

                packet = packetRepository.save(packet);

                int startPacketNo = nextPacketNumber(
                                masterItemId);

                List<String> descriptions = req.getDescriptions();

                List<String> weights = req.getWeights();

                List<String> dimensions = req.getDimensionsList();

                List<String> remarks = req.getRemarksList();

                List<PacketItem> items = new ArrayList<>();

                for (int index = 0; index < toCreate; index++) {

                        int packetNo = startPacketNo + index;

                        PacketItem item = new PacketItem();

                        item.setId(UUID.randomUUID());
                        item.setCreatedByUserId(
                                        ownerUserId);
                        item.setMasterItem(master);
                        item.setPacket(packet);
                        item.setItemType(
                                        PacketItemType.NORMAL);

                        item.setItemName(
                                        master.getItemName());
                        item.setPdNo(
                                        master.getPdNo());
                        item.setDrawingNo(
                                        master.getDrawingName());
                        item.setClientName(
                                        master.getClientName());
                        item.setClientAddress(
                                        master.getAddress());
                        item.setFloor(
                                        master.getFloor());

                        item.setPlantCode(
                                        plantCode);
                        item.setPackedAreaCode(
                                        plant.packedAreaCode());
                        item.setCurrentLocationCode(null);
                        item.setFgAreaCode(
                                        plant.fgAreaCode());
                        item.setFgZoneCode(null);

                        item.setPacketNumber(
                                        "Pkt-" + packetNo);

                        item.setSku(
                                        buildSkuForPlant(
                                                        plantCode,
                                                        master.getPdNo(),
                                                        master.getDrawingName(),
                                                        packetNo));

                        item.setDescription(
                                        getListValue(
                                                        descriptions,
                                                        index));

                        item.setWeight(
                                        getListValue(
                                                        weights,
                                                        index));

                        item.setDimensions(
                                        getListValue(
                                                        dimensions,
                                                        index));

                        item.setRemarks(
                                        getListValue(
                                                        remarks,
                                                        index));

                        item.setQuantity(1);
                        item.setLocation("FLOOR");
                        item.setStatus("CREATED");
                        item.setCreatedBy(actor);

                        items.add(item);
                }

                List<PacketItem> saved = packetItemRepository.saveAll(
                                items);

                packetItemRepository.flush();

                long totalPackets = packetItemRepository
                                .countByMasterItemId(
                                                masterItemId);

                master.setTotalPackets(
                                Math.toIntExact(
                                                totalPackets));

                masterItemRepository.save(master);

                return saved;
        }

        @Transactional
        public PacketItem createCustomPacket(
                        CreateItemRequest req,
                        User user) {

                return createCustomPacket(
                                req,
                                user,
                                req.getPlantCode());
        }

        @Transactional
        public PacketItem createCustomPacket(
                        CreateItemRequest req,
                        User user,
                        String plantCode) {

                assertNormalPackingUser(user);

                if (user.getId() == null) {
                        throw new AccessDeniedException(
                                        "Authenticated user ID is required");
                }

                return createCustomPacketInternal(
                                req,
                                user.getId(),
                                safeActor(user.getUsername()),
                                plantCode);
        }

        /*
         * Legacy/internal compatibility overloads.
         *
         * Keep these only for old internal callers.
         * Normal frontend requests must use the User-aware overload.
         */
        @Transactional
        public PacketItem createCustomPacket(
                        CreateItemRequest req) {

                return createCustomPacketInternal(
                                req,
                                null,
                                "SYSTEM",
                                req.getPlantCode());
        }

        @Transactional
        public PacketItem createCustomPacket(
                        CreateItemRequest req,
                        String createdBy) {

                return createCustomPacketInternal(
                                req,
                                null,
                                safeActor(createdBy),
                                req.getPlantCode());
        }

        @Transactional
        public PacketItem createCustomPacket(
                        CreateItemRequest req,
                        String createdBy,
                        String plantCode) {

                return createCustomPacketInternal(
                                req,
                                null,
                                safeActor(createdBy),
                                plantCode);
        }

        private PacketItem createCustomPacketInternal(
                        CreateItemRequest req,
                        Long ownerUserId,
                        String actor,
                        String plantCode) {

                if (req == null) {
                        throw new IllegalArgumentException(
                                        "Custom packet request is required");
                }

                int packetNo = req.getCustomPacketNumber();

                if (packetNo <= 0) {
                        throw new IllegalArgumentException(
                                        "Custom packet number must be greater than zero");
                }

                LocalDateTime now = LocalDateTime.now(APP_ZONE);

                LocalDateTime requestedPackedAt = resolveCreationPackingDateTime(
                                req.getPackingDate(),
                                now);

                Company company = requireCompany();

                PlantLocationService.PlantConfig plant = plantLocationService.getPlantConfig(
                                plantCode);

                MasterItem master = new MasterItem();

                master.setItemType(PacketItemType.NORMAL);
                master.setCreatedByUserId(ownerUserId);
                master.setItemName(req.itemName);
                master.setPdNo(req.pdNo);
                master.setDrawingName(req.drawingNo);
                master.setClientName(req.clientName);
                master.setAddress(req.clientAddress);
                master.setTotalPackets(1);
                master.setFloor(req.floor);
                master.setPlantCode(plantCode);

                master = masterItemRepository.save(master);

                Packet packet = new Packet();

                packet.setId(UUID.randomUUID());
                packet.setCompany(company);
                packet.setStickerNumber(
                                packetContainerStickerNumber(
                                                plantCode,
                                                packet.getId()));
                packet.setStatus(PacketStatus.CREATED);
                packet.setCreatedBy(actor);
                packet.setCreatedAt(now);
                packet.setStickerGenerated(false);

                packet = packetRepository.save(packet);

                /*
                 * No duplicate check is required here.
                 *
                 * A new MasterItem was just created and therefore
                 * cannot already contain the requested packet number.
                 */
                PacketItem item = new PacketItem();

                item.setId(UUID.randomUUID());
                item.setCreatedByUserId(ownerUserId);
                item.setPacket(packet);
                item.setMasterItem(master);
                item.setItemType(PacketItemType.NORMAL);

                item.setDescription(
                                firstListValue(
                                                req.getDescriptions()));

                item.setWeight(
                                firstListValue(
                                                req.getWeights()));

                item.setDimensions(
                                firstListValue(
                                                req.getDimensionsList()));

                item.setRemarks(
                                firstListValue(
                                                req.getRemarksList()));

                item.setItemName(req.itemName);
                item.setPdNo(req.pdNo);
                item.setDrawingNo(req.drawingNo);
                item.setClientName(req.clientName);
                item.setClientAddress(req.clientAddress);
                item.setFloor(req.floor);

                item.setPlantCode(plantCode);
                item.setPackedAreaCode(
                                plant.packedAreaCode());
                item.setCurrentLocationCode(null);
                item.setFgAreaCode(
                                plant.fgAreaCode());
                item.setFgZoneCode(null);

                item.setPacketNumber(
                                "Pkt-" + packetNo);

                item.setSku(
                                buildSkuForPlant(
                                                plantCode,
                                                req.pdNo,
                                                req.drawingNo,
                                                packetNo));

                item.setQuantity(1);
                item.setLocation("FLOOR");
                item.setStatus("CREATED");
                item.setCreatedBy(actor);
                item.setPackedBy(null);
                item.setPackedAt(requestedPackedAt);

                return packetItemRepository.save(item);
        }

        @Transactional
        public PacketItem addCustomPacket(
                        UUID masterItemId,
                        CreateItemRequest req) {
                return addCustomPacket(masterItemId, req, "SYSTEM", null);
        }

        @Transactional
        public PacketItem addCustomPacket(
                        UUID masterItemId,
                        CreateItemRequest req,
                        String createdBy) {
                return addCustomPacket(masterItemId, req, createdBy, null);
        }

        @Transactional
        public PacketItem addCustomPacket(
                        UUID masterItemId,
                        CreateItemRequest req,
                        String createdBy,
                        Set<String> allowedPlants) {

                String actor = safeActor(createdBy);
                LocalDateTime now = LocalDateTime.now(APP_ZONE);

                MasterItem master = requireMasterForPacketAppend(
                                masterItemId);

                if (master.getItemType() == PacketItemType.HARDWARE) {
                        throw new AccessDeniedException(
                                        "Custom normal packets cannot be added to a hardware master item");
                }

                String plantCode = master.getPlantCode();

                assertPlantAccess(plantCode, allowedPlants);

                PlantLocationService.PlantConfig plant = plantLocationService.getPlantConfig(plantCode);

                Company company = requireCompany();

                Packet packet = new Packet();
                packet.setId(UUID.randomUUID());
                packet.setCompany(company);
                packet.setStickerNumber(
                                packetContainerStickerNumber(
                                                plantCode,
                                                packet.getId()));
                packet.setStatus(PacketStatus.CREATED);
                packet.setCreatedBy(actor);
                packet.setCreatedAt(now);
                packet.setStickerGenerated(false);

                packet = packetRepository.save(packet);

                int packetNo = req.getCustomPacketNumber();

                // 🔥 DUPLICATE CHECK
                if (packetItemRepository.existsByMasterItemIdAndPacketNumber(
                                masterItemId, "Pkt-" + packetNo)) {
                        throw new RuntimeException("Packet number already exists");
                }

                PacketItem item = new PacketItem();

                item.setId(UUID.randomUUID());
                item.setPacket(packet);
                item.setMasterItem(master);
                item.setItemType(PacketItemType.NORMAL);
                item.setItemName(master.getItemName());
                item.setPdNo(master.getPdNo());
                item.setDrawingNo(master.getDrawingName());
                item.setClientName(master.getClientName());
                item.setClientAddress(master.getAddress());
                item.setFloor(master.getFloor());
                item.setDescription(req.getDescriptions().get(0));
                item.setWeight(req.getWeights().get(0));
                item.setDimensions(req.getDimensionsList().get(0));
                item.setRemarks(req.getRemarksList().get(0));
                item.setPlantCode(plantCode);
                item.setPackedAreaCode(plant.packedAreaCode());
                item.setCurrentLocationCode(null);
                item.setFgAreaCode(plant.fgAreaCode());
                item.setFgZoneCode(null);
                item.setPacketNumber("Pkt-" + packetNo);

                String sku = buildSkuForPlant(
                                plantCode,
                                master.getPdNo(),
                                master.getDrawingName(),
                                packetNo);

                item.setSku(sku);
                item.setQuantity(1);
                item.setLocation("FLOOR");
                item.setStatus("CREATED");
                item.setCreatedBy(actor);

                return packetItemRepository.save(item);
        }

        @Transactional
        public PacketItem addCustomPacket(
                        UUID masterItemId,
                        CreateItemRequest req,
                        User user,
                        Set<String> allowedPlants) {

                assertNormalPackingUser(user);

                if (user.getId() == null) {
                        throw new AccessDeniedException(
                                        "Authenticated user ID is required");
                }

                if (req == null) {
                        throw new IllegalArgumentException(
                                        "Custom packet request is required");
                }

                int packetNo = req.getCustomPacketNumber();

                if (packetNo <= 0) {
                        throw new IllegalArgumentException(
                                        "Custom packet number must be greater than zero");
                }

                MasterItem master = requireMasterForPacketAppend(
                                masterItemId);

                if (master.getItemType() == PacketItemType.HARDWARE) {

                        throw new AccessDeniedException(
                                        "Custom normal packets cannot be added to a hardware master item");
                }

                assertNormalMasterAccess(
                                master,
                                user);

                String plantCode = master.getPlantCode();

                if (!currentUserService.isAdmin(user)) {
                        assertPlantAccess(
                                        plantCode,
                                        allowedPlants);
                }

                String packetNumber = "Pkt-" + packetNo;

                /*
                 * Perform the duplicate check before creating
                 * the internal Packet row.
                 */
                if (packetItemRepository
                                .existsByMasterItemIdAndPacketNumber(
                                                masterItemId,
                                                packetNumber)) {

                        throw new IllegalArgumentException(
                                        "Packet number already exists");
                }

                PlantLocationService.PlantConfig plant = plantLocationService.getPlantConfig(
                                plantCode);

                Company company = requireCompany();

                String actor = safeActor(
                                user.getUsername());

                Long ownerUserId = master.getCreatedByUserId() != null
                                ? master.getCreatedByUserId()
                                : user.getId();

                LocalDateTime now = LocalDateTime.now(APP_ZONE);

                Packet packet = new Packet();

                packet.setId(UUID.randomUUID());
                packet.setCompany(company);
                packet.setStickerNumber(
                                packetContainerStickerNumber(
                                                plantCode,
                                                packet.getId()));
                packet.setStatus(PacketStatus.CREATED);
                packet.setCreatedBy(actor);
                packet.setCreatedAt(now);
                packet.setStickerGenerated(false);

                packet = packetRepository.save(packet);

                PacketItem item = new PacketItem();

                item.setId(UUID.randomUUID());
                item.setCreatedByUserId(
                                ownerUserId);
                item.setPacket(packet);
                item.setMasterItem(master);
                item.setItemType(
                                PacketItemType.NORMAL);

                item.setItemName(
                                master.getItemName());
                item.setPdNo(
                                master.getPdNo());
                item.setDrawingNo(
                                master.getDrawingName());
                item.setClientName(
                                master.getClientName());
                item.setClientAddress(
                                master.getAddress());
                item.setFloor(
                                master.getFloor());

                item.setDescription(
                                firstListValue(
                                                req.getDescriptions()));

                item.setWeight(
                                firstListValue(
                                                req.getWeights()));

                item.setDimensions(
                                firstListValue(
                                                req.getDimensionsList()));

                item.setRemarks(
                                firstListValue(
                                                req.getRemarksList()));

                item.setPlantCode(
                                plantCode);
                item.setPackedAreaCode(
                                plant.packedAreaCode());
                item.setCurrentLocationCode(null);
                item.setFgAreaCode(
                                plant.fgAreaCode());
                item.setFgZoneCode(null);

                item.setPacketNumber(
                                packetNumber);

                item.setSku(
                                buildSkuForPlant(
                                                plantCode,
                                                master.getPdNo(),
                                                master.getDrawingName(),
                                                packetNo));

                item.setQuantity(1);
                item.setLocation("FLOOR");
                item.setStatus("CREATED");
                item.setCreatedBy(actor);

                PacketItem saved = packetItemRepository.save(item);

                packetItemRepository.flush();

                master.setTotalPackets(
                                Math.toIntExact(
                                                packetItemRepository
                                                                .countByMasterItemId(
                                                                                masterItemId)));

                masterItemRepository.save(master);

                return saved;
        }

        @Transactional
        public PacketItem updateNormalPacketItem(
                        UUID itemId,
                        UpdatePacketItemRequest req,
                        User user,
                        Set<String> allowedPlants) {
                PacketItem item = packetItemRepository.findById(itemId)
                                .orElseThrow(() -> new RuntimeException("Item not found"));

                assertNormalPacketAccess(
                                item,
                                user,
                                allowedPlants);

                // Keep your existing normal update logic here.

                boolean stickerGenerated = item.getStickerNumber() != null &&
                                !item.getStickerNumber().isBlank();

                /*
                 * ALWAYS EDITABLE FIELDS
                 */

                item.setDescription(
                                keepExistingIfNull(
                                                req.getDescription(),
                                                item.getDescription()));

                item.setWeight(
                                keepExistingIfNull(
                                                req.getWeight(),
                                                item.getWeight()));

                item.setDimensions(
                                keepExistingIfNull(
                                                req.getDimensions(),
                                                item.getDimensions()));

                item.setRemarks(
                                keepExistingIfNull(
                                                req.getRemarks(),
                                                item.getRemarks()));

                item.setFloor(
                                keepExistingIfNull(
                                                req.getFloor(),
                                                item.getFloor()));

                item.setLocation(
                                keepExistingIfNull(
                                                req.getLocation(),
                                                item.getLocation()));

                item.setClientAddress(
                                keepExistingIfNull(
                                                req.getClientAddress(),
                                                item.getClientAddress()));

                /*
                 * RESTRICTED FIELDS
                 * ONLY BEFORE STICKER GENERATION
                 */

                if (!stickerGenerated) {

                        item.setItemName(req.getItemName());
                        item.setPdNo(req.getPdNo());
                        item.setDrawingNo(req.getDrawingNo());
                        item.setClientName(req.getClientName());

                        /*
                         * REBUILD SKU
                         * PACKET NUMBER IS IMMUTABLE
                         */

                        int packetNo = extractPacketNo(
                                        item.getPacketNumber(),
                                        item.getSku());

                        String sku = buildSkuForPlant(
                                        item.getPlantCode(),
                                        req.getPdNo(),
                                        req.getDrawingNo(),
                                        packetNo);

                        item.setSku(sku);
                }

                return packetItemRepository.save(item);
        }

        private String safeSkuPart(String value) {
                if (value == null || value.trim().isBlank()) {
                        return "-";
                }

                return value.trim().replaceAll("\\s+", " ");
        }

        private boolean isWr38PlantCode(
                        String plantCode) {

                return plantCode != null
                                && "WR-38".equalsIgnoreCase(
                                                plantCode.trim());
        }

        private String requireWr38ProductCode(
                        String pdNo) {

                if (pdNo == null || pdNo.trim().isBlank()) {
                        throw new IllegalArgumentException(
                                        "Product Code is required for WR-38");
                }

                return pdNo.trim()
                                .replaceAll("\\s+", " ");
        }

        /**
         * AL-P1/P2/P3/P4 keep the existing PD/DWG/Pkt-N SKU convention.
         * WR-38 deliberately does not: its Product Code (pdNo) is its SKU.
         */
        private String buildSkuForPlant(
                        String plantCode,
                        String pdNo,
                        String drawingNo,
                        int packetNo) {

                if (isWr38PlantCode(plantCode)) {
                        return requireWr38ProductCode(
                                        pdNo);
                }

                return buildSku(
                                pdNo,
                                drawingNo,
                                packetNo);
        }

        /**
         * Read paths must remain tolerant of historical WR-38 rows. If a legacy
         * row has Product Code populated, expose it as SKU immediately; otherwise
         * retain the existing stored value until an edit/print can validate it.
         */
        private String resolveSkuForPlantRead(
                        String plantCode,
                        String pdNo,
                        String existingSku) {

                if (isWr38PlantCode(plantCode)
                                && pdNo != null
                                && !pdNo.trim().isBlank()) {
                        return pdNo.trim()
                                        .replaceAll("\\s+", " ");
                }

                return existingSku;
        }

        private String buildSku(String pdNo, String drawingNo, int packetNo) {
                String cleanPdNo = safeSkuPart(pdNo);
                String cleanDwg = safeSkuPart(drawingNo).replace("/", "-");

                return cleanPdNo + "/" + cleanDwg + "/Pkt-" + packetNo;
        }

        private int extractPacketNo(String packetNumber, String sku) {
                if (packetNumber != null && packetNumber.startsWith("Pkt-")) {
                        return Integer.parseInt(
                                        packetNumber.replace("Pkt-", "").trim());
                }

                if (sku != null && sku.contains("Pkt-")) {
                        String pkt = sku.substring(sku.lastIndexOf("Pkt-") + 4)
                                        .replaceAll("[^0-9]", "");

                        if (!pkt.isBlank()) {
                                return Integer.parseInt(pkt);
                        }
                }

                throw new RuntimeException("Packet number missing. Cannot rebuild SKU.");
        }

        /*
         * ============================================================
         * LEGACY NORMAL-STICKER API
         *
         * Keep these methods because older controllers/services may
         * already call them.
         * They remain NORMAL-only and cannot print hardware packets.
         * ============================================================
         */

        @Transactional
        public byte[] generateStickerForPacketItem(
                        UUID itemId,
                        String factoryFloor,
                        boolean showCompanyHeader) {
                return generateStickerInternal(
                                itemId,
                                factoryFloor,
                                showCompanyHeader,
                                null,
                                null,
                                PacketItemType.NORMAL,
                                "SYSTEM");
        }

        @Transactional
        public byte[] generateStickerForPacketItem(
                        UUID itemId,
                        String factoryFloor,
                        boolean showCompanyHeader,
                        String generatedBy) {
                return generateStickerInternal(
                                itemId,
                                factoryFloor,
                                showCompanyHeader,
                                null,
                                null,
                                PacketItemType.NORMAL,
                                generatedBy);
        }

        @Transactional
        public byte[] generateStickerForPacketItem(
                        UUID itemId,
                        String factoryFloor,
                        boolean showCompanyHeader,
                        String generatedBy,
                        Set<String> allowedPlants) {
                return generateStickerInternal(
                                itemId,
                                factoryFloor,
                                showCompanyHeader,
                                null,
                                allowedPlants,
                                PacketItemType.NORMAL,
                                generatedBy);
        }

        /*
         * ============================================================
         * NEW USER-AWARE STICKER API
         * ============================================================
         */

        @Transactional
        public byte[] generateNormalSticker(
                        UUID itemId,
                        String factoryFloor,
                        boolean showCompanyHeader,
                        User user,
                        Set<String> allowedPlants) {
                return generateStickerInternal(
                                itemId,
                                factoryFloor,
                                showCompanyHeader,
                                user,
                                allowedPlants,
                                PacketItemType.NORMAL,
                                null);
        }

        @Transactional
        public byte[] generateUtlNormalSticker(
                        UUID itemId,
                        String factoryFloor,
                        User user,
                        Set<String> allowedPlants,
                        String dispatchMode,
                        String dispatchTargetUsername,
                        String dispatchTargetPlantCode) {
                return generateStickerInternalWithRouting(
                                itemId,
                                factoryFloor,
                                false,
                                user,
                                allowedPlants,
                                PacketItemType.NORMAL,
                                null,
                                dispatchMode,
                                dispatchTargetUsername,
                                dispatchTargetPlantCode);
        }

        @Transactional
        public byte[] generateHardwareSticker(
                        UUID itemId,
                        String factoryFloor,
                        boolean showCompanyHeader,
                        User user,
                        Set<String> allowedPlants) {
                return generateStickerInternal(
                                itemId,
                                factoryFloor,
                                showCompanyHeader,
                                user,
                                allowedPlants,
                                PacketItemType.HARDWARE,
                                null);
        }

        private String formatDimensionWithVolume(String dim) {

                try {
                        String[] parts = dim.split("x");

                        double l = Double.parseDouble(parts[0].replaceAll("[^0-9.]", "").trim());
                        double b = Double.parseDouble(parts[1].replaceAll("[^0-9.]", "").trim());
                        double h = Double.parseDouble(parts[2].replaceAll("[^0-9.]", "").trim());

                        // inches → meters
                        double volume = (l * b * h) / Math.pow(39.3701, 3);

                        return dim + " (" + String.format("%.3f", volume) + " m³)";
                } catch (Exception e) {
                        return dim; // fallback safe
                }
        }

        private String formatWeight(String weight) {

                if (weight == null || weight.trim().isEmpty()) {
                        return "-";
                }

                String clean = weight.trim().toLowerCase();

                // If already contains kg → don't duplicate
                if (clean.contains("kg")) {
                        return weight;
                }

                return weight + " kg";
        }

        /**
         * Resolve the optional yyyy-MM-dd packing date supplied by the Inventory
         * creation forms. The date is interpreted in Asia/Kolkata and combined
         * with the real request time so only the business date is backdated.
         *
         * A missing value intentionally falls back to the current timestamp so
         * older clients/mobile builds continue working without any API change.
         */
        private LocalDateTime resolveCreationPackingDateTime(
                        String packingDate,
                        LocalDateTime requestNow) {

                LocalDateTime safeNow = requestNow != null
                                ? requestNow
                                : LocalDateTime.now(APP_ZONE);

                if (packingDate == null || packingDate.isBlank()) {
                        return safeNow;
                }

                final LocalDate selectedDate;

                try {
                        selectedDate = LocalDate.parse(
                                        packingDate.trim());
                } catch (DateTimeParseException exception) {
                        throw new IllegalArgumentException(
                                        "Packing date must be in yyyy-MM-dd format");
                }

                LocalDate today = LocalDate.now(APP_ZONE);

                if (selectedDate.isAfter(today)) {
                        throw new IllegalArgumentException(
                                        "Future packing dates are not allowed");
                }

                return selectedDate.atTime(
                                safeNow.toLocalTime());
        }

        private MasterItem requireMasterForPacketAppend(
                        UUID masterItemId) {

                if (masterItemId == null) {
                        throw new IllegalArgumentException(
                                        "Master item id is required");
                }

                MasterItem master = entityManager.find(
                                MasterItem.class,
                                masterItemId,
                                LockModeType.PESSIMISTIC_WRITE);

                if (master == null) {
                        throw new RuntimeException(
                                        "Master item not found");
                }

                return master;
        }

        private Company requireCompany() {
                return companyRepository
                                .findAll(
                                                PageRequest.of(0, 1))
                                .stream()
                                .findFirst()
                                .orElseThrow(() -> new RuntimeException(
                                                "No company found"));
        }

        private Path resolveStoredStickerPath(
                        String storedPath) {

                if (storedPath == null ||
                                storedPath.trim().isBlank()) {
                        throw new IllegalStateException(
                                        "Stored sticker path is missing");
                }

                if (stickerStoragePath == null ||
                                stickerStoragePath.trim().isBlank()) {
                        throw new IllegalStateException(
                                        "sticker.storage.path is not configured");
                }

                try {
                        Path configuredRoot = Paths.get(
                                        stickerStoragePath)
                                        .toAbsolutePath()
                                        .normalize();

                        if (configuredRoot.getParent() == null) {
                                throw new IllegalStateException(
                                                "sticker.storage.path cannot be a filesystem root");
                        }

                        Path root = configuredRoot.toRealPath();

                        Path supplied = Paths.get(
                                        storedPath.trim());

                        Path candidate = supplied.isAbsolute()
                                        ? supplied.toAbsolutePath().normalize()
                                        : root.resolve(supplied).normalize();

                        if (!candidate.startsWith(root)) {
                                throw new IllegalStateException(
                                                "Stored sticker path is outside sticker storage");
                        }

                        if (!Files.exists(candidate)) {
                                return candidate;
                        }

                        Path realCandidate = candidate.toRealPath();

                        if (!realCandidate.startsWith(root)) {
                                throw new IllegalStateException(
                                                "Stored sticker path resolves outside sticker storage");
                        }

                        return realCandidate;

                } catch (IOException exception) {
                        throw new IllegalStateException(
                                        "Unable to resolve stored sticker path",
                                        exception);
                }
        }

        private String safeActor(String username) {
                return username != null && !username.isBlank()
                                ? username.trim()
                                : "SYSTEM";
        }

        @Transactional
        public PacketItem assignPlantToPacketItem(
                        UUID itemId,
                        String plantCode) {
                PlantLocationService.PlantConfig plant = plantLocationService.getPlantConfig(plantCode);

                PacketItem item = packetItemRepository.findById(itemId)
                                .orElseThrow(() -> new RuntimeException("Item not found"));

                item.setPlantCode(plantCode);

                if (isWr38PlantCode(plantCode)) {
                        item.setSku(
                                        requireWr38ProductCode(
                                                        item.getPdNo()));
                }

                item.setPackedAreaCode(plant.packedAreaCode());
                item.setFgAreaCode(plant.fgAreaCode());

                if (item.getStickerNumber() == null) {
                        item.setCurrentLocationCode(null);
                        item.setLocation("FLOOR");
                } else {
                        item.setCurrentLocationCode(plant.packedAreaCode());
                        item.setLocation(plant.packedAreaCode());
                }

                if (item.getMasterItem() != null) {
                        item.getMasterItem().setPlantCode(plantCode);
                }

                PacketItem saved = packetItemRepository.save(item);

                dispatchedRepo.findById(itemId.toString()).ifPresent(d -> {
                        d.setPlantCode(plantCode);
                        d.setSku(
                                        resolveSkuForPlantRead(
                                                        plantCode,
                                                        saved.getPdNo(),
                                                        saved.getSku()));
                        d.setPackedAreaCode(plant.packedAreaCode());
                        d.setFgAreaCode(plant.fgAreaCode());

                        if (d.getCurrentLocationCode() == null || d.getCurrentLocationCode().isBlank()) {
                                d.setCurrentLocationCode(plant.packedAreaCode());
                                d.setLocation(plant.packedAreaCode());
                        }

                        dispatchedRepo.save(d);
                });

                return saved;
        }

        private void assertNormalPackingUser(
                        User user) {

                if (user == null) {
                        throw new AccessDeniedException(
                                        "Authentication is required");
                }

                if (currentUserService.isAdmin(user)) {
                        return;
                }

                if (currentUserService
                                .isHardwareOnlyPackingUser(user)) {

                        throw new AccessDeniedException(
                                        "Hardware-only packing users cannot access normal inventory");
                }

                if (!currentUserService.isNormalPacking(user)) {
                        throw new AccessDeniedException(
                                        "Normal packing access is required");
                }
        }

        private void assertNormalMasterAccess(
                        MasterItem master,
                        User user) {

                if (master == null) {
                        throw new AccessDeniedException(
                                        "Master item is missing");
                }

                assertNormalPackingUser(user);

                if (currentUserService.isAdmin(user)) {
                        return;
                }

                if (user.getId() == null) {
                        throw new AccessDeniedException(
                                        "Authenticated user ID is missing");
                }

                /*
                 * Preferred ownership check.
                 */
                if (master.getCreatedByUserId() != null) {
                        if (!Objects.equals(
                                        master.getCreatedByUserId(),
                                        user.getId())) {

                                throw new AccessDeniedException(
                                                "You cannot modify a master item created by another user");
                        }

                        return;
                }

                /*
                 * Legacy ownership check using existing child packets.
                 */
                String username = user.getUsername() == null
                                ? ""
                                : user.getUsername().trim();

                boolean ownsLegacyMaster = packetItemRepository.existsOwnedPacketInMaster(
                                master.getId(),
                                user.getId(),
                                username);

                if (!ownsLegacyMaster) {
                        throw new AccessDeniedException(
                                        "You cannot modify a master item created by another user");
                }
        }

        private int nextPacketNumber(
                        UUID masterItemId) {

                return packetItemRepository
                                .findPacketNumbersByMasterItemId(
                                                masterItemId)
                                .stream()
                                .mapToInt(this::parsePacketNumberSafely)
                                .max()
                                .orElse(0) + 1;
        }

        private int parsePacketNumberSafely(
                        String packetNumber) {

                if (packetNumber == null ||
                                packetNumber.isBlank()) {
                        return 0;
                }

                String digits = packetNumber
                                .replaceAll("[^0-9]", "");

                if (digits.isBlank()) {
                        return 0;
                }

                try {
                        return Integer.parseInt(digits);
                } catch (NumberFormatException exception) {
                        return 0;
                }
        }

        private String firstListValue(
                        List<String> values) {

                if (values == null ||
                                values.isEmpty() ||
                                values.get(0) == null) {
                        return "";
                }

                return values.get(0);
        }

        private void validatePacketCreationRequest(
                        CreateItemRequest req,
                        int packetCount) {

                if (req == null) {
                        throw new IllegalArgumentException(
                                        "Packet request is required");
                }

                if (packetCount <= 0) {
                        throw new IllegalArgumentException(
                                        "Number of packets must be greater than zero");
                }
        }

        @Transactional
        public StickerHistory ensureStickerHistoryForDispatchedItem(
                        String zohoItemId,
                        String generatedBy,
                        Set<String> allowedPlants) {
                if (zohoItemId == null || zohoItemId.trim().isBlank()) {
                        throw new RuntimeException("Dispatched item id missing");
                }

                String actor = safeActor(generatedBy);
                LocalDateTime now = LocalDateTime.now(APP_ZONE);

                DispatchedItem dispatchedItem = dispatchedRepo.findById(zohoItemId)
                                .orElseThrow(() -> new RuntimeException("Dispatched item not found"));

                assertLegacyPlantAccess(
                                dispatchedItem.getPlantCode(),
                                allowedPlants);

                PacketItem packetItem = resolvePacketItemForStickerHistory(
                                dispatchedItem,
                                actor);

                String stickerNumber = firstNonBlankValue(
                                packetItem.getStickerNumber(),
                                dispatchedItem.getStickerNumber());

                if (stickerNumber == null || stickerNumber.isBlank()) {
                        stickerNumber = stickerSequenceService
                                        .generateNextStickerNumberForPlant(
                                                        packetItem.getPlantCode());
                }

                long iteration = packetItem.getPrintIteration() == null ||
                                packetItem.getPrintIteration() <= 0
                                                ? 1
                                                : packetItem.getPrintIteration();

                packetItem.setStickerNumber(stickerNumber);
                packetItem.setPrintIteration(iteration);

                if (packetItem.getStatus() == null || packetItem.getStatus().isBlank()) {
                        packetItem.setStatus("READY");
                }

                if (packetItem.getCreatedBy() == null || packetItem.getCreatedBy().isBlank()) {
                        packetItem.setCreatedBy(actor);
                }

                packetItemRepository.save(packetItem);

                dispatchedItem.setPacketItemId(packetItem.getId());

                if (packetItem.getPacket() != null) {
                        dispatchedItem.setPacketId(packetItem.getPacket().getId());
                }

                dispatchedItem.setStickerNumber(stickerNumber);

                if (dispatchedItem.getCreatedBy() == null || dispatchedItem.getCreatedBy().isBlank()) {
                        dispatchedItem.setCreatedBy(actor);
                }

                dispatchedRepo.save(dispatchedItem);

                List<StickerHistory> existingHistory = stickerHistoryRepository
                                .findByPacketItem_IdOrderByGeneratedAtDesc(
                                                packetItem.getId());

                for (StickerHistory history : existingHistory) {
                        if (history.getPdfData() != null &&
                                        history.getPdfData().length > 0) {
                                return history;
                        }
                }

                boolean utlPacket = utlWorkflowService != null
                                && utlWorkflowService.findRoutingByPacketItemId(packetItem.getId()).isPresent();

                byte[] pdfBytes;

                if (isWr38Item(packetItem)) {
                        /* WR-38 history must remain the QR-only artifact. */
                        pdfBytes = productQrPdfService.generate(
                                        packetItem,
                                        stickerNumber,
                                        iteration,
                                        false);
                } else {
                        StickerPdfData pdf = buildStickerPdfData(
                                        packetItem,
                                        stickerNumber,
                                        packetItem.getFloor(),
                                        !utlPacket,
                                        iteration,
                                        false);

                        pdfBytes = pdfService.generateSticker(pdf);
                }

                StickerHistory rebuiltHistory = new StickerHistory();

                rebuiltHistory.setPacketItem(packetItem);
                rebuiltHistory.setStickerNumber(stickerNumber);
                rebuiltHistory.setPdfData(pdfBytes);
                rebuiltHistory.setPrintIteration(iteration);
                rebuiltHistory.setGeneratedBy(actor);
                rebuiltHistory.setReason("LEGACY_HISTORY_REBUILT");
                rebuiltHistory.setGeneratedAt(now);

                StickerHistory savedHistory = stickerHistoryRepository.save(rebuiltHistory);

                String status = dispatchedItem.getStatus() != null
                                ? dispatchedItem.getStatus().name()
                                : null;

                activityLogService.log(
                                zohoItemId,
                                "STICKER HISTORY REBUILT",
                                actor,
                                "SYSTEM",
                                status,
                                status,
                                null);

                return savedHistory;
        }

        private PacketItem resolvePacketItemForStickerHistory(
                        DispatchedItem dispatchedItem,
                        String actor) {
                PacketItem packetItem = null;

                if (dispatchedItem.getPacketItemId() != null) {
                        packetItem = packetItemRepository.findById(
                                        dispatchedItem.getPacketItemId()).orElse(null);
                }

                if (packetItem == null) {
                        try {
                                UUID possiblePacketItemId = UUID.fromString(
                                                dispatchedItem.getZohoItemId());

                                packetItem = packetItemRepository.findById(
                                                possiblePacketItemId).orElse(null);

                        } catch (Exception ignored) {
                        }
                }

                if (packetItem != null) {
                        syncPacketItemFromDispatchedItem(
                                        packetItem,
                                        dispatchedItem,
                                        actor);

                        return packetItemRepository.save(packetItem);
                }

                return createLegacyPacketItemFromDispatchedItem(
                                dispatchedItem,
                                actor);
        }

        private void syncPacketItemFromDispatchedItem(
                        PacketItem packetItem,
                        DispatchedItem dispatchedItem,
                        String actor) {

                if (packetItem.getItemType() == null) {
                        packetItem.setItemType(
                                        dispatchedItem.getItemType() != null
                                                        ? dispatchedItem.getItemType()
                                                        : PacketItemType.NORMAL);
                }

                if (packetItem.getLinkedPacketItemId() == null) {
                        packetItem.setLinkedPacketItemId(
                                        dispatchedItem.getLinkedPacketItemId());
                }

                if (packetItem.getLinkedMasterItemId() == null) {
                        packetItem.setLinkedMasterItemId(
                                        dispatchedItem.getLinkedMasterItemId());
                }

                packetItem.setItemName(
                                keepExistingIfBlank(
                                                packetItem.getItemName(),
                                                dispatchedItem.getName()));

                packetItem.setSku(
                                keepExistingIfBlank(
                                                packetItem.getSku(),
                                                dispatchedItem.getSku()));

                /*
                 * Repair packet identity for synthetic/legacy PacketItems created
                 * from Dispatch rows. These rows do not have a MasterItem and older
                 * code created them with packetNumber = Pkt-1 regardless of the SKU.
                 *
                 * Do not rewrite normal master-linked PackFlow packets here; their
                 * packetNumber remains canonical and is updated by the Admin edit
                 * workflow itself.
                 */
                if (packetItem.getMasterItem() == null) {
                        String currentSku = firstNonBlankValue(
                                        dispatchedItem.getSku(),
                                        packetItem.getSku());

                        String packetNumberFromSku = packetNumberFromSku(
                                        currentSku);

                        if (packetNumberFromSku != null) {
                                packetItem.setPacketNumber(
                                                packetNumberFromSku);

                                if (dispatchedItem.getSku() != null
                                                && !dispatchedItem.getSku().isBlank()) {
                                        packetItem.setSku(
                                                        dispatchedItem.getSku().trim());
                                }
                        }
                }

                packetItem.setPdNo(
                                keepExistingIfBlank(
                                                packetItem.getPdNo(),
                                                dispatchedItem.getPdNo()));

                packetItem.setDrawingNo(
                                keepExistingIfBlank(
                                                packetItem.getDrawingNo(),
                                                dispatchedItem.getDrawingNo()));

                if (isWr38PlantCode(
                                packetItem.getPlantCode())) {
                        packetItem.setSku(
                                        resolveSkuForPlantRead(
                                                        packetItem.getPlantCode(),
                                                        packetItem.getPdNo(),
                                                        packetItem.getSku()));
                }

                packetItem.setClientName(
                                keepExistingIfBlank(
                                                packetItem.getClientName(),
                                                dispatchedItem.getClientName()));

                packetItem.setClientAddress(
                                keepExistingIfBlank(
                                                packetItem.getClientAddress(),
                                                dispatchedItem.getClientAddress()));

                packetItem.setDescription(
                                keepExistingIfBlank(
                                                packetItem.getDescription(),
                                                dispatchedItem.getDescription()));

                packetItem.setRemarks(
                                keepExistingIfBlank(
                                                packetItem.getRemarks(),
                                                dispatchedItem.getRemarks()));

                packetItem.setWeight(
                                keepExistingIfBlank(
                                                packetItem.getWeight(),
                                                dispatchedItem.getWeight()));

                packetItem.setDimensions(
                                keepExistingIfBlank(
                                                packetItem.getDimensions(),
                                                dispatchedItem.getDimensions()));

                packetItem.setFloor(
                                keepExistingIfBlank(
                                                packetItem.getFloor(),
                                                dispatchedItem.getFloor()));

                packetItem.setPlantCode(
                                keepExistingIfBlank(
                                                packetItem.getPlantCode(),
                                                dispatchedItem.getPlantCode()));

                packetItem.setPackedAreaCode(
                                keepExistingIfBlank(
                                                packetItem.getPackedAreaCode(),
                                                dispatchedItem.getPackedAreaCode()));

                packetItem.setCurrentLocationCode(
                                keepExistingIfBlank(
                                                packetItem.getCurrentLocationCode(),
                                                dispatchedItem.getCurrentLocationCode()));

                packetItem.setFgAreaCode(
                                keepExistingIfBlank(
                                                packetItem.getFgAreaCode(),
                                                dispatchedItem.getFgAreaCode()));

                packetItem.setFgZoneCode(
                                keepExistingIfBlank(
                                                packetItem.getFgZoneCode(),
                                                dispatchedItem.getFgZoneCode()));

                packetItem.setLocation(
                                keepExistingIfBlank(
                                                packetItem.getLocation(),
                                                firstNonBlankValue(
                                                                dispatchedItem.getCurrentLocationCode(),
                                                                dispatchedItem.getLocation())));

                packetItem.setStickerNumber(
                                keepExistingIfBlank(
                                                packetItem.getStickerNumber(),
                                                dispatchedItem.getStickerNumber()));

                /*
                 * Legacy/history repair only: when a standalone Warehouse import was
                 * given an Admin packing-date override before sticker history was ever
                 * rebuilt, carry that existing timestamp into the newly resolved
                 * PacketItem. This does not alter movement state.
                 */
                if (packetItem.getPackedAt() == null &&
                                dispatchedItem.getPackedAt() != null) {
                        packetItem.setPackedAt(dispatchedItem.getPackedAt());
                }

                if (packetItem.getQuantity() == null) {
                        packetItem.setQuantity(1);
                }

                if (packetItem.getCreatedBy() == null || packetItem.getCreatedBy().isBlank()) {
                        packetItem.setCreatedBy(actor);
                }
        }

        private PacketItem createLegacyPacketItemFromDispatchedItem(
                        DispatchedItem dispatchedItem,
                        String actor) {
                Company company = requireCompany();

                Packet packet = new Packet();

                packet.setId(UUID.randomUUID());
                packet.setCompany(company);
                packet.setStickerNumber(
                                packetContainerStickerNumber(
                                                dispatchedItem.getPlantCode(),
                                                packet.getId()));
                packet.setStatus(PacketStatus.CREATED);
                packet.setCreatedBy(actor);
                packet.setCreatedAt(LocalDateTime.now(APP_ZONE));
                packet.setStickerGenerated(false);

                packet = packetRepository.save(packet);

                PacketItem packetItem = new PacketItem();

                packetItem.setId(UUID.randomUUID());
                packetItem.setPacket(packet);
                packetItem.setItemType(
                                dispatchedItem.getItemType() != null
                                                ? dispatchedItem.getItemType()
                                                : PacketItemType.NORMAL);

                packetItem.setLinkedPacketItemId(
                                dispatchedItem.getLinkedPacketItemId());

                packetItem.setLinkedMasterItemId(
                                dispatchedItem.getLinkedMasterItemId());

                packetItem.setItemName(
                                firstNonBlankValue(
                                                dispatchedItem.getName(),
                                                "Legacy Item"));

                String sku;

                if (isWr38PlantCode(
                                dispatchedItem.getPlantCode())) {
                        /*
                         * Historical WR-38 rows may predate the Product Code rule.
                         * Prefer pdNo when available, otherwise retain the stored code
                         * until the operator supplies Product Code on the next edit.
                         */
                        sku = resolveSkuForPlantRead(
                                        dispatchedItem.getPlantCode(),
                                        dispatchedItem.getPdNo(),
                                        dispatchedItem.getSku());
                } else {
                        sku = firstNonBlankValue(
                                        dispatchedItem.getSku(),
                                        buildSku(
                                                        dispatchedItem.getPdNo(),
                                                        dispatchedItem.getDrawingNo(),
                                                        1));
                }

                packetItem.setSku(sku);
                packetItem.setPdNo(dispatchedItem.getPdNo());
                packetItem.setDrawingNo(dispatchedItem.getDrawingNo());
                packetItem.setClientName(dispatchedItem.getClientName());
                packetItem.setClientAddress(dispatchedItem.getClientAddress());
                packetItem.setDescription(dispatchedItem.getDescription());
                packetItem.setRemarks(dispatchedItem.getRemarks());
                packetItem.setWeight(dispatchedItem.getWeight());
                packetItem.setDimensions(dispatchedItem.getDimensions());
                packetItem.setFloor(dispatchedItem.getFloor());

                packetItem.setPlantCode(dispatchedItem.getPlantCode());
                packetItem.setPackedAreaCode(dispatchedItem.getPackedAreaCode());
                packetItem.setCurrentLocationCode(
                                firstNonBlankValue(
                                                dispatchedItem.getCurrentLocationCode(),
                                                dispatchedItem.getLocation(),
                                                dispatchedItem.getPackedAreaCode()));
                packetItem.setFgAreaCode(dispatchedItem.getFgAreaCode());
                packetItem.setFgZoneCode(dispatchedItem.getFgZoneCode());

                /*
                 * Never hard-code Pkt-1 for reconstructed Dispatch rows.
                 * If Admin Edit already changed the SKU to .../Pkt-N, persist the
                 * same packet identity so history metadata and the PDF header agree.
                 */
                packetItem.setPacketNumber(
                                firstNonBlankValue(
                                                packetNumberFromSku(sku),
                                                "Pkt-1"));
                packetItem.setQuantity(1);
                packetItem.setLocation(
                                firstNonBlankValue(
                                                dispatchedItem.getCurrentLocationCode(),
                                                dispatchedItem.getLocation(),
                                                dispatchedItem.getPackedAreaCode(),
                                                "PKD"));

                packetItem.setStatus("READY");
                packetItem.setCreatedBy(actor);
                packetItem.setStickerNumber(dispatchedItem.getStickerNumber());

                /*
                 * If this standalone/imported Dispatch row already has an explicit
                 * Admin-corrected packing timestamp, preserve it when the existing
                 * legacy sticker-history rebuild flow later creates a PacketItem.
                 */
                packetItem.setPackedAt(dispatchedItem.getPackedAt());

                PacketItem saved = packetItemRepository.save(packetItem);

                dispatchedItem.setPacketId(packet.getId());
                dispatchedItem.setPacketItemId(saved.getId());

                dispatchedRepo.save(dispatchedItem);

                return saved;
        }

        /**
         * Resolve the packet number shown on a sticker.
         *
         * Modern rows keep packetNumber and SKU aligned. For legacy/import rows
         * edited from Dispatch, SKU is the authoritative fallback because the
         * Dispatch table has no separate packet-number column.
         */
        private String resolveStickerPacketNumber(
                        String packetNumber,
                        String sku) {

                String fromSku = packetNumberFromSku(
                                sku);

                if (fromSku != null) {
                        return fromSku;
                }

                if (packetNumber != null
                                && !packetNumber.trim().isBlank()) {
                        return packetNumber.trim();
                }

                return packetNumber;
        }

        /**
         * Extract Pkt-N from the current SKU without throwing.
         */
        private String packetNumberFromSku(
                        String sku) {

                if (sku == null || sku.trim().isBlank()) {
                        return null;
                }

                String value = sku.trim();
                String lower = value.toLowerCase(
                                java.util.Locale.ROOT);

                int marker = lower.lastIndexOf(
                                "pkt-");

                if (marker < 0) {
                        return null;
                }

                String suffix = value.substring(
                                marker + 4);

                String digits = suffix.replaceAll(
                                "[^0-9].*$",
                                "")
                                .replaceAll(
                                                "[^0-9]",
                                                "");

                if (digits.isBlank()) {
                        return null;
                }

                try {
                        int number = Integer.parseInt(
                                        digits);

                        if (number <= 0) {
                                return null;
                        }

                        return "Pkt-" + number;
                } catch (NumberFormatException ignored) {
                        return null;
                }
        }

        private String firstNonBlankValue(
                        String... values) {
                if (values == null) {
                        return null;
                }

                for (String value : values) {
                        if (value != null && !value.trim().isBlank()) {
                                return value.trim();
                        }
                }

                return null;
        }

        private String keepExistingIfBlank(
                        String existing,
                        String fallback) {
                if (existing != null && !existing.trim().isBlank()) {
                        return existing.trim();
                }

                if (fallback != null && !fallback.trim().isBlank()) {
                        return fallback.trim();
                }

                return existing;
        }

        private void assertLegacyPlantAccess(
                        String plantCode,
                        Set<String> allowedPlants) {
                /*
                 * null may represent unrestricted internal/Admin access.
                 */
                if (allowedPlants == null) {
                        return;
                }

                /*
                 * Preserve legacy records that genuinely have no plant.
                 */
                if (plantCode == null ||
                                plantCode.isBlank()) {
                        return;
                }

                boolean permitted = allowedPlants.stream()
                                .filter(Objects::nonNull)
                                .map(String::trim)
                                .anyMatch(allowedPlant -> allowedPlant.equalsIgnoreCase(
                                                plantCode.trim()));

                if (!permitted) {
                        throw new AccessDeniedException(
                                        "User does not have access to plant: " +
                                                        plantCode);
                }
        }

        @Transactional(readOnly = true)
        public byte[] previewNormalSticker(
                        UUID itemId,
                        String factoryFloor,
                        boolean showCompanyHeader,
                        User user,
                        Set<String> allowedPlants) {
                PacketItem item = packetItemRepository.findById(itemId)
                                .orElseThrow(() -> new RuntimeException("Item not found"));

                assertNormalPacketAccess(
                                item,
                                user,
                                allowedPlants);

                return previewStickerInternal(
                                item,
                                factoryFloor,
                                currentUserService.isUtlPacking(user)
                                                ? false
                                                : showCompanyHeader);
        }

        @Transactional(readOnly = true)
        public byte[] previewHardwareSticker(
                        UUID itemId,
                        String factoryFloor,
                        boolean showCompanyHeader,
                        User user,
                        Set<String> allowedPlants) {
                PacketItem item = packetItemRepository.findById(itemId)
                                .orElseThrow(() -> new RuntimeException("Hardware packet not found"));

                assertHardwarePacketReadAccess(
                                item,
                                user,
                                allowedPlants);

                return previewStickerInternal(
                                item,
                                factoryFloor,
                                showCompanyHeader);
        }

        @Transactional(readOnly = true)
        public byte[] previewWr38Qr(
                        UUID itemId,
                        User user,
                        Set<String> allowedPlants) {

                PacketItem item = packetItemRepository.findById(itemId)
                                .orElseThrow(() -> new RuntimeException("Packet item not found"));

                assertWr38NormalItem(
                                item,
                                user,
                                allowedPlants);

                return previewStickerInternal(
                                item,
                                item.getFloor(),
                                true);
        }

        @Transactional
        public byte[] generateWr38Qr(
                        UUID itemId,
                        User user,
                        Set<String> allowedPlants) {
                return generateWr38Qr(
                                itemId,
                                user,
                                allowedPlants,
                                null,
                                null,
                                null);
        }

        @Transactional
        public byte[] generateWr38Qr(
                        UUID itemId,
                        User user,
                        Set<String> allowedPlants,
                        String dispatchMode,
                        String dispatchTargetUsername,
                        String dispatchTargetPlantCode) {

                PacketItem item = packetItemRepository
                                .findByIdForStickerGeneration(itemId)
                                .orElseThrow(() -> new RuntimeException("Packet item not found"));

                assertWr38NormalItem(
                                item,
                                user,
                                allowedPlants);

                return generateStickerInternalWithRouting(
                                itemId,
                                item.getFloor(),
                                false,
                                user,
                                allowedPlants,
                                PacketItemType.NORMAL,
                                null,
                                dispatchMode,
                                dispatchTargetUsername,
                                dispatchTargetPlantCode);
        }

        private byte[] previewStickerInternal(
                        PacketItem item,
                        String factoryFloor,
                        boolean showCompanyHeader) {
                long iteration = item.getPrintIteration() == null
                                ? 1
                                : item.getPrintIteration();

                String previewStickerNumber = item.getStickerNumber() != null
                                ? item.getStickerNumber()
                                : "PREVIEW";

                if (isWr38Item(item)) {
                        return productQrPdfService.generate(
                                        item,
                                        previewStickerNumber,
                                        iteration,
                                        true);
                }

                StickerPdfData pdf = buildStickerPdfData(
                                item,
                                previewStickerNumber,
                                factoryFloor,
                                showCompanyHeader,
                                iteration,
                                true);

                return pdfService.generateSticker(pdf);
        }

        @Transactional(readOnly = true)
        public byte[] getLatestHardwareStickerPdf(
                        UUID itemId,
                        User user,
                        Set<String> allowedPlants) {
                PacketItem item = packetItemRepository.findById(itemId)
                                .orElseThrow(() -> new RuntimeException("Hardware packet not found"));

                assertHardwarePacketReadAccess(
                                item,
                                user,
                                allowedPlants);

                return getLatestStickerPdfInternal(item);
        }

        private byte[] getLatestStickerPdfInternal(
                        PacketItem item) {
                String activeStickerNumber = item.getStickerNumber();

                if (activeStickerNumber == null
                                || activeStickerNumber.isBlank()) {
                        throw new RuntimeException(
                                        "This packet item has no active sticker");
                }

                List<StickerHistory> historyList = stickerHistoryRepository
                                .findByPacketItem_IdOrderByGeneratedAtDesc(
                                                item.getId());

                for (StickerHistory history : historyList) {
                        boolean sameSticker = activeStickerNumber.equals(
                                        history.getStickerNumber());

                        boolean hasPdf = history.getPdfData() != null
                                        && history.getPdfData().length > 0;

                        if (sameSticker && hasPdf) {
                                return history.getPdfData();
                        }
                }

                long iteration = item.getPrintIteration() == null
                                || item.getPrintIteration() <= 0
                                                ? 1L
                                                : item.getPrintIteration();

                if (isWr38Item(item)) {
                        return productQrPdfService.generate(
                                        item,
                                        activeStickerNumber,
                                        iteration,
                                        false);
                }

                boolean showCompanyHeader =
                                utlWorkflowService == null
                                                || utlWorkflowService
                                                                .findRoutingByPacketItemId(
                                                                                item.getId())
                                                                .isEmpty();

                StickerPdfData pdf = buildStickerPdfData(
                                item,
                                activeStickerNumber,
                                item.getFloor(),
                                showCompanyHeader,
                                iteration,
                                false);

                return pdfService.generateSticker(pdf);
        }

        @Transactional(readOnly = true)
        public byte[] getLatestStickerPdfForPacketItem(
                        UUID itemId,
                        Set<String> allowedPlants) {
                PacketItem item = packetItemRepository.findById(itemId)
                                .orElseThrow(() -> new RuntimeException(
                                                "Packet item not found"));

                /*
                 * Existing endpoint remains valid for all old NORMAL
                 * packet-item callers, but cannot leak a hardware sticker.
                 */
                if (effectiveItemType(item) == PacketItemType.HARDWARE) {
                        throw new AccessDeniedException(
                                        "Hardware stickers must be accessed through the hardware packet API");
                }

                assertLegacyPlantAccess(
                                item.getPlantCode(),
                                allowedPlants);

                return getLatestStickerPdfInternal(item);
        }

        @Transactional(readOnly = true)
        public byte[] getStickerHistoryPdf(
                        UUID historyId,
                        Set<String> allowedPlants) {
                StickerHistory history = stickerHistoryRepository.findById(historyId)
                                .orElseThrow(() -> new RuntimeException(
                                                "Sticker history not found"));

                PacketItem item = history.getPacketItem();

                if (item == null) {
                        throw new RuntimeException(
                                        "Sticker history has no packet item linked");
                }

                if (effectiveItemType(item) == PacketItemType.HARDWARE) {
                        throw new AccessDeniedException(
                                        "Hardware sticker history must use the hardware packet API");
                }

                assertLegacyPlantAccess(
                                item.getPlantCode(),
                                allowedPlants);

                return getStickerHistoryPdfInternal(
                                history,
                                item);
        }

        @Transactional(readOnly = true)
        public byte[] getHardwareStickerHistoryPdf(
                        UUID historyId,
                        User user,
                        Set<String> allowedPlants) {
                StickerHistory history = stickerHistoryRepository.findById(historyId)
                                .orElseThrow(() -> new RuntimeException(
                                                "Sticker history not found"));

                PacketItem item = history.getPacketItem();

                if (item == null) {
                        throw new RuntimeException(
                                        "Sticker history has no packet item linked");
                }

                assertHardwarePacketReadAccess(
                                item,
                                user,
                                allowedPlants);

                return getStickerHistoryPdfInternal(
                                history,
                                item);
        }

        @Transactional(readOnly = true)
        public PacketItem requireStickerHistoryReadAccess(
                        UUID packetItemId,
                        User user,
                        Set<String> allowedPlants) {
                if (user == null) {
                        throw new AccessDeniedException(
                                        "Authentication is required");
                }

                PacketItem item = packetItemRepository.findById(packetItemId)
                                .orElseThrow(() -> new RuntimeException(
                                                "Packet item not found"));

                /*
                 * UTL routing is intentionally allowed to cross the physical
                 * source-plant / selected-dispatch-plant boundary. The UTL
                 * creator and the exact selected dispatcher must both be able to
                 * open the same sticker history even when their plant codes differ.
                 */
                if (utlWorkflowService != null
                                && utlWorkflowService.findRoutingByPacketItemId(packetItemId).isPresent()) {
                        if (utlWorkflowService.canUserReadPacketItem(item, user)) {
                                return item;
                        }

                        throw new AccessDeniedException(
                                        "This UTL sticker is not assigned to this user");
                }

                if (effectiveItemType(item) == PacketItemType.HARDWARE) {
                        /*
                         * ADMIN:
                         * Can read every hardware sticker.
                         *
                         * DISPATCH:
                         * Can read hardware sticker history for assigned plants.
                         *
                         * HARDWARE_PACKING:
                         * Can read owned hardware packets for assigned plants.
                         */
                        assertHardwarePacketReadAccess(
                                        item,
                                        user,
                                        allowedPlants);
                } else {
                        /*
                         * Normal packet access remains plant-aware.
                         */
                        assertNormalPacketAccess(
                                        item,
                                        user,
                                        allowedPlants);
                }

                return item;
        }

        private byte[] getStickerHistoryPdfInternal(
                        StickerHistory history,
                        PacketItem item) {

                /*
                 * History PDF bytes are snapshots. Rebuild from the current PacketItem
                 * before serving so normal and hardware history downloads both reflect
                 * Admin-corrected packet number / SKU and other sticker-facing fields.
                 */
                byte[] refreshedPdf = stickerHistoryPdfRefreshService.refreshHistory(
                                history);

                if (refreshedPdf != null && refreshedPdf.length > 0) {
                        return refreshedPdf;
                }

                String stickerNumber = history.getStickerNumber() != null
                                && !history.getStickerNumber().isBlank()
                                                ? history.getStickerNumber()
                                                : item.getStickerNumber();

                if (stickerNumber == null
                                || stickerNumber.isBlank()) {
                        throw new RuntimeException(
                                        "Sticker PDF data missing and sticker number not available");
                }

                long iteration = history.getPrintIteration() == null
                                || history.getPrintIteration() <= 0
                                                ? 1L
                                                : history.getPrintIteration();

                if (isWr38Item(item)) {
                        return productQrPdfService.generate(
                                        item,
                                        stickerNumber,
                                        iteration,
                                        false);
                }

                boolean showCompanyHeader = utlWorkflowService == null
                                || utlWorkflowService.findRoutingByPacketItemId(item.getId()).isEmpty();

                StickerPdfData pdf = buildStickerPdfData(
                                item,
                                stickerNumber,
                                item.getFloor(),
                                showCompanyHeader,
                                iteration,
                                false);

                return pdfService.generateSticker(pdf);
        }

        private boolean isWr38Item(PacketItem item) {
                return productQrPdfService.isWr38(item);
        }

        private void assertWr38NormalItem(
                        PacketItem item,
                        User user,
                        Set<String> allowedPlants) {

                if (item == null) {
                        throw new RuntimeException("Packet item not found");
                }

                if (effectiveItemType(item) == PacketItemType.HARDWARE) {
                        throw new AccessDeniedException(
                                        "WR-38 QR is available only for normal product packets");
                }

                assertNormalPacketAccess(
                                item,
                                user,
                                allowedPlants);

                if (!isWr38Item(item)) {
                        throw new IllegalArgumentException(
                                        "WR-38 QR endpoint can only be used for plant WR-38");
                }
        }

        private String packetContainerStickerNumber(
                        String plantCode,
                        UUID packetId) {
                if (plantCode != null
                                && "WR-38".equalsIgnoreCase(plantCode.trim())) {
                        String id = packetId == null
                                        ? UUID.randomUUID().toString()
                                        : packetId.toString();
                        return "WR-PKT-"
                                        + id.substring(0, Math.min(8, id.length()))
                                                        .toUpperCase(Locale.ROOT);
                }

                /* Existing AL packet-container counter behavior is unchanged. */
                return stickerSequenceService.generateNextStickerNumber();
        }

        private String firstPacketPlant(List<PacketItem> items) {
                if (items == null) {
                        return null;
                }
                for (PacketItem item : items) {
                        if (item != null
                                        && item.getPlantCode() != null
                                        && !item.getPlantCode().isBlank()) {
                                return item.getPlantCode();
                        }
                }
                return null;
        }

        private PacketItemType effectiveItemType(
                        PacketItem item) {
                if (item == null || item.getItemType() == null) {
                        return PacketItemType.NORMAL;
                }

                return item.getItemType();
        }

}
