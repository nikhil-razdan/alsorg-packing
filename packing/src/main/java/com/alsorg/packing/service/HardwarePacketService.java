package com.alsorg.packing.service;

import static com.alsorg.packing.controller.dto.hardware.HardwarePacketDtos.*;
import java.util.Comparator;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.alsorg.packing.controller.dto.hardware.HardwarePacketDtos.HardwareLineRequest;
import com.alsorg.packing.controller.dto.hardware.HardwarePacketDtos.HardwareLineResponse;
import com.alsorg.packing.controller.dto.hardware.HardwarePacketDtos.HardwarePacketAddRequest;
import com.alsorg.packing.controller.dto.hardware.HardwarePacketDtos.HardwarePacketCreateRequest;
import com.alsorg.packing.controller.dto.hardware.HardwarePacketDtos.HardwarePacketDraftRequest;
import com.alsorg.packing.controller.dto.hardware.HardwarePacketDtos.HardwarePacketResponse;
import com.alsorg.packing.controller.dto.hardware.HardwarePacketDtos.HardwarePacketUpdateRequest;
import com.alsorg.packing.domain.common.Company;
import com.alsorg.packing.domain.common.PacketItemType;
import com.alsorg.packing.domain.common.PacketStatus;
import com.alsorg.packing.domain.item.HardwarePacketLine;
import com.alsorg.packing.domain.item.MasterItem;
import com.alsorg.packing.domain.item.PacketItem;
import com.alsorg.packing.domain.packet.Packet;
import com.alsorg.packing.domain.users.User;
import com.alsorg.packing.repository.CompanyRepository;
import com.alsorg.packing.repository.MasterItemRepository;
import com.alsorg.packing.repository.PacketItemRepository;
import com.alsorg.packing.repository.PacketRepository;

@Service
public class HardwarePacketService {

        private static final ZoneId APP_ZONE = ZoneId.of("Asia/Kolkata");

        /*
         * Fixed sticker size cannot carry an unlimited item list legibly.
         * User must make another hardware packet after eight rows.
         */
        private static final int MAX_LINES_PER_PACKET = 8;

        private static final int MAX_PACKETS_PER_REQUEST = 50;

        private final PacketRepository packetRepository;
        private final PacketItemRepository packetItemRepository;
        private final MasterItemRepository masterItemRepository;
        private final CompanyRepository companyRepository;
        private final StickerSequenceService stickerSequenceService;
        private final PlantLocationService plantLocationService;
        private final CurrentUserService currentUserService;
        private final PacketService packetService;

        public HardwarePacketService(
                        PacketRepository packetRepository,
                        PacketItemRepository packetItemRepository,
                        MasterItemRepository masterItemRepository,
                        CompanyRepository companyRepository,
                        StickerSequenceService stickerSequenceService,
                        PlantLocationService plantLocationService,
                        CurrentUserService currentUserService,
                        PacketService packetService) {
                this.packetRepository = packetRepository;
                this.packetItemRepository = packetItemRepository;
                this.masterItemRepository = masterItemRepository;
                this.companyRepository = companyRepository;
                this.stickerSequenceService = stickerSequenceService;
                this.plantLocationService = plantLocationService;
                this.currentUserService = currentUserService;
                this.packetService = packetService;
        }

        @Transactional
        public List<HardwarePacketResponse> createPackets(
                        HardwarePacketCreateRequest request,
                        User user) {
                currentUserService.requireHardwarePackingOrAdmin(user);

                validateCreateRequest(request);

                String plantCode = currentUserService.resolvePlantForWrite(
                                user,
                                request.plantCode());

                PlantLocationService.PlantConfig plant = plantLocationService.getPlantConfig(plantCode);

                Company company = companyRepository.findAll()
                                .stream()
                                .findFirst()
                                .orElseThrow(() -> new RuntimeException("No company found"));

                LocalDateTime now = LocalDateTime.now(APP_ZONE);

                String actor = safeActor(user);

                MasterItem master = new MasterItem();

                master.setItemName(cleanRequired(
                                request.itemName(),
                                "Hardware packet title is required"));
                master.setPdNo(cleanOptional(request.pdNo()));
                master.setDrawingName(cleanOptional(request.drawingNo()));
                master.setClientName(cleanOptional(request.clientName()));
                master.setAddress(cleanOptional(request.clientAddress()));
                master.setFloor(cleanOptional(request.floor()));
                master.setPlantCode(plantCode);
                master.setTotalPackets(request.packets().size());

                master.setItemType(PacketItemType.HARDWARE);
                master.setCreatedByUserId(user.getId());

                master = masterItemRepository.save(master);

                Packet packet = new Packet();

                packet.setId(UUID.randomUUID());
                packet.setCompany(company);
                packet.setStickerNumber(
                                stickerSequenceService.generateNextStickerNumber());
                packet.setStatus(PacketStatus.CREATED);
                packet.setCreatedBy(actor);
                packet.setCreatedAt(now);
                packet.setStickerGenerated(false);

                packet = packetRepository.save(packet);

                List<PacketItem> packetItems = new ArrayList<>();

                for (int packetIndex = 0; packetIndex < request.packets().size(); packetIndex++) {

                        HardwarePacketDraftRequest packetDraft = request.packets().get(packetIndex);

                        int packetNumber = packetIndex + 1;

                        PacketItem item = new PacketItem();

                        item.setId(UUID.randomUUID());
                        item.setPacket(packet);
                        item.setMasterItem(master);

                        item.setItemType(PacketItemType.HARDWARE);
                        item.setCreatedByUserId(user.getId());

                        item.setItemName(master.getItemName());
                        item.setPdNo(master.getPdNo());
                        item.setDrawingNo(master.getDrawingName());
                        item.setClientName(master.getClientName());
                        item.setClientAddress(master.getAddress());
                        item.setFloor(master.getFloor());

                        item.setPacketNumber("Pkt-" + packetNumber);
                        item.setSku(
                                        buildHardwareSku(
                                                        master.getPdNo(),
                                                        master.getDrawingName(),
                                                        packetNumber));

                        item.setQuantity(1);

                        item.setPlantCode(plantCode);
                        item.setPackedAreaCode(plant.packedAreaCode());
                        item.setCurrentLocationCode(null);
                        item.setFgAreaCode(plant.fgAreaCode());
                        item.setFgZoneCode(null);

                        item.setLocation("FLOOR");
                        item.setStatus("CREATED");
                        item.setCreatedBy(actor);
                        item.setPackedBy(null);

                        /*
                         * Hardware-specific fields stay empty.
                         */
                        item.setWeight(null);
                        item.setDimensions(null);
                        item.setRemarks(null);

                        /*
                         * Phase 2 references remain null for now.
                         */
                        item.setLinkedPacketItemId(null);
                        item.setLinkedMasterItemId(null);

                        List<HardwarePacketLine> lines = buildLines(
                                        item,
                                        packetDraft.items(),
                                        now);

                        item.replaceHardwareLines(lines);

                        /*
                         * Snapshot description is important for:
                         * - sticker PDF;
                         * - dispatched item;
                         * - challan PDF;
                         * - historical audit.
                         */
                        item.setDescription(
                                        buildDescriptionSnapshot(lines));

                        packetItems.add(item);
                }

                List<PacketItem> saved = packetItemRepository.saveAll(packetItems);

                return saved.stream()
                                .map(this::toResponse)
                                .toList();
        }

        @Transactional
        public List<HardwarePacketResponse> addPackets(
                        UUID masterItemId,
                        HardwarePacketAddRequest request,
                        User user) {
                currentUserService.requireHardwareWriteAccess(user);

                validateAddRequest(request);

                MasterItem master = masterItemRepository
                                .findByIdForHardwarePacketAppend(
                                                masterItemId)
                                .orElseThrow(() -> new RuntimeException(
                                                "Hardware master item not found"));

                assertHardwareMasterWriteAccess(
                                master,
                                user);

                String plantCode = cleanRequired(
                                master.getPlantCode(),
                                "Hardware master plant is missing");

                if (!currentUserService.isAdmin(user)
                                && !currentUserService.canAccessPlant(
                                                user,
                                                plantCode)) {
                        throw new AccessDeniedException(
                                        "You do not have access to this hardware master plant");
                }

                PlantLocationService.PlantConfig plant = plantLocationService.getPlantConfig(
                                plantCode);

                Company company = companyRepository.findAll()
                                .stream()
                                .findFirst()
                                .orElseThrow(() -> new RuntimeException(
                                                "No company found"));

                List<PacketItem> existingItems = packetItemRepository
                                .findAllByMasterItemIdWithHardwareLines(
                                                masterItemId);

                int highestPacketNumber = existingItems.stream()
                                .mapToInt(item -> extractPacketNoOrZero(
                                                item.getPacketNumber()))
                                .max()
                                .orElse(0);

                LocalDateTime now = LocalDateTime.now(APP_ZONE);

                String actor = safeActor(user);

                /*
                 * If ADMIN adds a packet to somebody else's hardware
                 * master, ownership should remain with the original
                 * hardware user.
                 */
                Long ownerUserId = master.getCreatedByUserId() != null
                                ? master.getCreatedByUserId()
                                : user.getId();

                Packet packet = new Packet();

                packet.setId(UUID.randomUUID());
                packet.setCompany(company);
                packet.setStickerNumber(
                                stickerSequenceService
                                                .generateNextStickerNumber());
                packet.setStatus(PacketStatus.CREATED);
                packet.setCreatedBy(actor);
                packet.setCreatedAt(now);
                packet.setStickerGenerated(false);

                packet = packetRepository.save(packet);

                List<PacketItem> newItems = new ArrayList<>();

                for (int index = 0; index < request.packets().size(); index++) {
                        HardwarePacketDraftRequest draft = request.packets().get(index);

                        int packetNumber = highestPacketNumber + index + 1;

                        PacketItem item = new PacketItem();

                        item.setId(UUID.randomUUID());

                        item.setPacket(packet);
                        item.setMasterItem(master);

                        item.setItemType(
                                        PacketItemType.HARDWARE);

                        item.setCreatedByUserId(
                                        ownerUserId);

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

                        item.setPacketNumber(
                                        "Pkt-" + packetNumber);

                        item.setSku(
                                        buildHardwareSku(
                                                        master.getPdNo(),
                                                        master.getDrawingName(),
                                                        packetNumber));

                        item.setQuantity(1);

                        item.setPlantCode(
                                        plantCode);
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

                        item.setWeight(null);
                        item.setDimensions(null);
                        item.setRemarks(null);

                        item.setLinkedPacketItemId(null);
                        item.setLinkedMasterItemId(null);

                        List<HardwarePacketLine> lines = buildLines(
                                        item,
                                        draft.items(),
                                        now);

                        item.replaceHardwareLines(lines);

                        item.setDescription(
                                        buildDescriptionSnapshot(lines));

                        newItems.add(item);
                }

                List<PacketItem> saved = packetItemRepository.saveAll(
                                newItems);

                master.setTotalPackets(
                                Math.toIntExact(
                                                existingItems.size()
                                                                + saved.size()));

                masterItemRepository.save(master);

                return saved.stream()
                                .sorted(
                                                Comparator.comparingInt(item -> extractPacketNoOrZero(
                                                                item.getPacketNumber())))
                                .map(this::toResponse)
                                .toList();
        }

        @Transactional(readOnly = true)
        public List<HardwarePacketResponse> getVisiblePackets(
                        User user) {
                currentUserService.requireHardwareReadAccess(user);

                List<PacketItem> source;

                /*
                 * ADMIN can inspect every hardware packet.
                 *
                 * Every non-admin user sees only hardware packets
                 * owned by their user ID. Plant access is deliberately
                 * not used for Inventory listing visibility.
                 */
                if (currentUserService.isAdmin(user)) {
                        source = packetItemRepository
                                        .findAllByItemTypeWithHardwareLines(
                                                        PacketItemType.HARDWARE);
                } else {
                        if (user == null || user.getId() == null) {
                                throw new AccessDeniedException(
                                                "Authenticated user information is missing");
                        }

                        source = packetItemRepository
                                        .findOwnedByItemTypeWithHardwareLines(
                                                        PacketItemType.HARDWARE,
                                                        user.getId());
                }

                return source.stream()
                                .filter(this::showOnHardwareInventoryPage)
                                .sorted(
                                                Comparator
                                                                .comparing(
                                                                                (PacketItem item) -> item
                                                                                                .getMasterItem() != null
                                                                                                                ? item.getMasterItem()
                                                                                                                                .getItemName()
                                                                                                                : item.getItemName(),

                                                                                Comparator.nullsLast(
                                                                                                String.CASE_INSENSITIVE_ORDER))
                                                                .thenComparingInt(
                                                                                item -> extractPacketNoOrZero(
                                                                                                item.getPacketNumber())))
                                .map(this::toResponse)
                                .toList();
        }

        @Transactional
        public HardwarePacketResponse updatePacket(
                        UUID itemId,
                        HardwarePacketUpdateRequest request,
                        User user) {

                /*
                 * Controller authorization is not enough.
                 * Protect direct service usage as well.
                 */
                currentUserService.requireHardwareWriteAccess(user);

                if (request == null) {
                        throw new RuntimeException(
                                        "Hardware packet update request is required");
                }

                /*
                 * Validate incoming hardware rows before modifying
                 * any existing database data.
                 */
                validateLines(request.items());

                /*
                 * Lock the selected PacketItem for the duration
                 * of the complete edit operation.
                 */
                PacketItem item = packetItemRepository
                                .findByIdForHardwarePacketUpdate(itemId)
                                .orElseThrow(() -> new RuntimeException(
                                                "Hardware packet not found"));

                assertHardwareWriteAccess(
                                item,
                                user);

                /*
                 * Initialize the managed hardware-line collection
                 * before clearing or replacing it.
                 */
                item.getHardwareLines().size();

                /*
                 * A generated hardware packet is immutable through
                 * the normal edit flow.
                 */
                if (item.getStickerNumber() != null
                                && !item.getStickerNumber().isBlank()) {
                        throw new RuntimeException(
                                        "Printed hardware packet cannot be edited. "
                                                        + "Create another packet or use an admin correction flow.");
                }

                MasterItem master = item.getMasterItem();

                if (master == null) {
                        throw new RuntimeException(
                                        "Hardware master item is missing");
                }

                if (master.getItemType() != PacketItemType.HARDWARE) {
                        throw new AccessDeniedException(
                                        "This is not a hardware master item");
                }

                /*
                 * Clean the editable master-level fields.
                 */
                String itemName = cleanRequired(
                                request.itemName(),
                                "Hardware packet title is required");

                String pdNo = cleanOptional(
                                request.pdNo());

                String drawingNo = cleanOptional(
                                request.drawingNo());

                String clientName = cleanOptional(
                                request.clientName());

                String clientAddress = cleanOptional(
                                request.clientAddress());

                String floor = cleanOptional(
                                request.floor());

                /*
                 * =====================================================
                 * UPDATE THE ACTUAL HARDWARE MASTER
                 * =====================================================
                 *
                 * These fields represent the whole hardware master,
                 * not only the selected packet.
                 */
                master.setItemName(
                                itemName);

                master.setPdNo(
                                pdNo);

                master.setDrawingName(
                                drawingNo);

                master.setClientName(
                                clientName);

                master.setAddress(
                                clientAddress);

                master.setFloor(
                                floor);

                masterItemRepository.save(
                                master);

                /*
                 * Load all sibling packets belonging to this master.
                 *
                 * They are Hibernate-managed entities because this query
                 * runs inside the current transaction.
                 */
                List<PacketItem> masterPackets = new ArrayList<>(
                                packetItemRepository
                                                .findAllByMasterItemIdWithHardwareLines(
                                                                master.getId()));

                /*
                 * Defensive fallback in case the selected packet is not
                 * returned by the sibling query.
                 */
                boolean selectedItemIncluded = masterPackets.stream()
                                .anyMatch(packet -> Objects.equals(
                                                packet.getId(),
                                                item.getId()));

                if (!selectedItemIncluded) {
                        masterPackets.add(
                                        item);
                }

                /*
                 * =====================================================
                 * SYNCHRONIZE UNPRINTED HARDWARE PACKETS
                 * =====================================================
                 *
                 * Update:
                 * - the selected packet;
                 * - every other unprinted packet under the master.
                 *
                 * Printed sibling PacketItem snapshots are intentionally
                 * preserved because they may correspond to an existing PDF.
                 */
                for (PacketItem masterPacket : masterPackets) {

                        if (masterPacket == null
                                        || masterPacket.getItemType() != PacketItemType.HARDWARE) {
                                continue;
                        }

                        boolean selectedPacket = Objects.equals(
                                        masterPacket.getId(),
                                        item.getId());

                        boolean unprintedPacket = masterPacket.getStickerNumber() == null
                                        || masterPacket.getStickerNumber()
                                                        .isBlank();

                        if (!selectedPacket
                                        && !unprintedPacket) {
                                continue;
                        }

                        masterPacket.setItemName(
                                        itemName);

                        masterPacket.setPdNo(
                                        pdNo);

                        masterPacket.setDrawingNo(
                                        drawingNo);

                        masterPacket.setClientName(
                                        clientName);

                        masterPacket.setClientAddress(
                                        clientAddress);

                        masterPacket.setFloor(
                                        floor);

                        int siblingPacketNo = extractPacketNo(
                                        masterPacket.getPacketNumber());

                        masterPacket.setSku(
                                        buildHardwareSku(
                                                        pdNo,
                                                        drawingNo,
                                                        siblingPacketNo));
                }

                /*
                 * =====================================================
                 * PHASE 1: DELETE THE SELECTED PACKET'S OLD LINES
                 * =====================================================
                 *
                 * The database has a unique constraint on:
                 *
                 * packet_item_id + line_no
                 *
                 * Therefore the old line numbers must be deleted before
                 * inserting the replacement line numbers.
                 */
                item.getHardwareLines()
                                .clear();

                /*
                 * Flush now so orphanRemoval physically deletes old rows
                 * before the replacement rows reuse line_no 1, 2, 3...
                 *
                 * This flush will also persist the master and sibling
                 * metadata changes made above.
                 */
                packetItemRepository.flush();

                /*
                 * =====================================================
                 * PHASE 2: CREATE REPLACEMENT HARDWARE LINES
                 * =====================================================
                 */
                LocalDateTime now = LocalDateTime.now(
                                APP_ZONE);

                List<HardwarePacketLine> newLines = buildLines(
                                item,
                                request.items(),
                                now);

                /*
                 * Add the new lines to the existing managed collection.
                 *
                 * Do not call replaceHardwareLines() here because the
                 * collection was deliberately cleared and flushed above.
                 */
                for (HardwarePacketLine line : newLines) {
                        item.addHardwareLine(
                                        line);
                }

                /*
                 * Refresh the selected packet's printable description
                 * using its newly submitted hardware contents.
                 */
                item.setDescription(
                                buildDescriptionSnapshot(
                                                newLines));

                PacketItem saved = packetItemRepository.saveAndFlush(
                                item);

                /*
                 * Keep the collection initialized before response mapping.
                 */
                saved.getHardwareLines()
                                .size();

                return toResponse(
                                saved);
        }

        @Transactional
        public void deletePacket(
                        UUID itemId,
                        User user) {
                PacketItem item = getWritableHardwarePacket(
                                itemId,
                                user);

                if (!"CREATED".equalsIgnoreCase(item.getStatus())) {
                        throw new RuntimeException(
                                        "Only newly created hardware packets can be deleted");
                }

                if (item.getStickerNumber() != null
                                && !item.getStickerNumber().isBlank()) {
                        throw new RuntimeException(
                                        "Printed hardware packet cannot be deleted");
                }

                UUID masterId = item.getMasterItem() != null
                                ? item.getMasterItem().getId()
                                : null;

                UUID packetId = item.getPacket() != null
                                ? item.getPacket().getId()
                                : null;

                packetItemRepository.delete(item);
                packetItemRepository.flush();

                if (masterId != null) {
                        long remaining = packetItemRepository.countByMasterItemId(masterId);

                        masterItemRepository.findById(masterId)
                                        .ifPresent(master -> {
                                                if (remaining == 0) {
                                                        masterItemRepository.delete(master);
                                                } else {
                                                        master.setTotalPackets(
                                                                        Math.toIntExact(remaining));
                                                        masterItemRepository.save(master);
                                                }
                                        });
                }

                if (packetId != null
                                && packetItemRepository.countByPacketId(packetId) == 0) {
                        packetRepository.findById(packetId)
                                        .ifPresent(packetRepository::delete);
                }
        }

        public byte[] previewSticker(
                        UUID itemId,
                        String factoryFloor,
                        boolean showCompanyHeader,
                        User user) {
                return packetService.previewHardwareSticker(
                                itemId,
                                factoryFloor,
                                showCompanyHeader,
                                user,
                                currentUserService.allowedPlants(user));
        }

        public byte[] generateSticker(
                        UUID itemId,
                        String factoryFloor,
                        boolean showCompanyHeader,
                        User user) {
                return packetService.generateHardwareSticker(
                                itemId,
                                factoryFloor,
                                showCompanyHeader,
                                user,
                                currentUserService.allowedPlants(user));
        }

        public byte[] getLatestSticker(
                        UUID itemId,
                        User user) {
                return packetService.getLatestHardwareStickerPdf(
                                itemId,
                                user,
                                currentUserService.allowedPlants(user));
        }

        private PacketItem getWritableHardwarePacket(
                        UUID itemId,
                        User user) {
                currentUserService.requireHardwareWriteAccess(user);

                PacketItem item = packetItemRepository.findById(itemId)
                                .orElseThrow(() -> new RuntimeException(
                                                "Hardware packet not found"));

                assertHardwareWriteAccess(
                                item,
                                user);

                return item;
        }

        private void assertHardwareWriteAccess(
                        PacketItem item,
                        User user) {
                if (item.getItemType() != PacketItemType.HARDWARE) {
                        throw new AccessDeniedException(
                                        "This is not a hardware packet");
                }

                if (currentUserService.isAdmin(user)) {
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
                                        "You cannot modify hardware packets created by another user");
                }

                if (!currentUserService.canAccessPlant(
                                user,
                                item.getPlantCode())) {
                        throw new AccessDeniedException(
                                        "You do not have access to this packet plant");
                }
        }

        private List<HardwarePacketLine> buildLines(
                        PacketItem packetItem,
                        List<HardwareLineRequest> requests,
                        LocalDateTime now) {
                validateLines(requests);

                List<HardwarePacketLine> lines = new ArrayList<>();

                for (int index = 0; index < requests.size(); index++) {

                        HardwareLineRequest request = requests.get(index);

                        HardwarePacketLine line = new HardwarePacketLine();

                        line.setId(UUID.randomUUID());
                        line.setPacketItem(packetItem);
                        line.setLineNo(index + 1);
                        line.setItemName(
                                        cleanRequired(
                                                        request.itemName(),
                                                        "Hardware item name is required"));
                        line.setQuantity(request.quantity());
                        line.setUom(normalizeUom(request.uom()));
                        line.setHardwareInventoryItemId(null);
                        line.setCreatedAt(now);

                        lines.add(line);
                }

                return lines;
        }

        private String buildDescriptionSnapshot(
                        List<HardwarePacketLine> lines) {
                return lines.stream()
                                .map(line -> line.getLineNo()
                                                + ". "
                                                + line.getItemName()
                                                + " - Qty: "
                                                + formatQuantity(line.getQuantity())
                                                + " "
                                                + line.getUom())
                                .reduce(
                                                (left, right) -> left + "\n" + right)
                                .orElse("-");
        }

        private HardwarePacketResponse toResponse(
                        PacketItem item) {

                if (item == null) {
                        throw new RuntimeException(
                                        "Hardware packet response item is missing");
                }

                List<HardwareLineResponse> lines = item.getHardwareLines() == null
                                ? List.of()
                                : item.getHardwareLines()
                                                .stream()
                                                .filter(Objects::nonNull)
                                                .sorted(
                                                                Comparator.comparingInt(
                                                                                line -> line.getLineNo() != null
                                                                                                ? line.getLineNo()
                                                                                                : Integer.MAX_VALUE))
                                                .map(line -> new HardwareLineResponse(
                                                                line.getId(),

                                                                line.getLineNo() != null
                                                                                ? line.getLineNo()
                                                                                : 0,

                                                                line.getItemName(),
                                                                line.getQuantity(),
                                                                line.getUom()))
                                                .toList();

                MasterItem master = item.getMasterItem();

                /*
                 * MasterItem is the source of truth for information
                 * shared by every packet under the same hardware master.
                 *
                 * PacketItem values are used only for legacy rows where
                 * the MasterItem relationship is unavailable.
                 */
                String responseItemName = master != null
                                ? master.getItemName()
                                : item.getItemName();

                String responsePdNo = master != null
                                ? master.getPdNo()
                                : item.getPdNo();

                String responseDrawingNo = master != null
                                ? master.getDrawingName()
                                : item.getDrawingNo();

                String responseClientName = master != null
                                ? master.getClientName()
                                : item.getClientName();

                String responseClientAddress = master != null
                                ? master.getAddress()
                                : item.getClientAddress();

                String responseFloor = master != null
                                ? master.getFloor()
                                : item.getFloor();

                return new HardwarePacketResponse(
                                item.getId(),

                                master != null
                                                ? master.getId()
                                                : null,

                                PacketItemType.HARDWARE,

                                responseItemName,
                                item.getPacketNumber(),
                                item.getSku(),

                                responsePdNo,
                                responseDrawingNo,

                                responseClientName,
                                responseClientAddress,
                                responseFloor,

                                item.getDescription(),

                                item.getPlantCode(),
                                item.getLocation(),
                                item.getPackedAreaCode(),
                                item.getCurrentLocationCode(),

                                item.getStatus(),
                                item.getStickerNumber(),
                                item.getPrintIteration(),

                                item.getCreatedBy(),
                                item.getCreatedByUserId(),

                                lines);
        }

        private boolean showOnHardwareInventoryPage(
                        PacketItem item) {
                if (item == null
                                || item.getItemType() != PacketItemType.HARDWARE
                                || item.getStatus() == null) {
                        return false;
                }

                String status = item.getStatus().trim().toUpperCase();

                if ("CREATED".equals(status)
                                || "RESTORED".equals(status)) {
                        return true;
                }

                if (!"READY".equals(status)) {
                        return false;
                }

                String currentLocation = firstNonBlank(
                                item.getCurrentLocationCode(),
                                item.getLocation());

                String fgArea = cleanOptional(item.getFgAreaCode());

                if (!fgArea.isBlank()
                                && (currentLocation.equals(fgArea)
                                                || currentLocation.startsWith(fgArea + "-")
                                                || currentLocation.startsWith(fgArea + " "))) {
                        return false;
                }

                String packedArea = cleanOptional(item.getPackedAreaCode());

                if (!packedArea.isBlank()) {
                        return currentLocation.equals(packedArea)
                                        || currentLocation.startsWith(packedArea + "-")
                                        || currentLocation.startsWith(packedArea + " ");
                }

                return currentLocation.startsWith("PKD");
        }

        private void validateCreateRequest(
                        HardwarePacketCreateRequest request) {
                if (request == null) {
                        throw new RuntimeException(
                                        "Hardware packet request is required");
                }

                cleanRequired(
                                request.itemName(),
                                "Hardware packet title is required");

                if (request.packets() == null
                                || request.packets().isEmpty()) {
                        throw new RuntimeException(
                                        "At least one hardware packet is required");
                }

                if (request.packets().size() > MAX_PACKETS_PER_REQUEST) {
                        throw new RuntimeException(
                                        "Maximum "
                                                        + MAX_PACKETS_PER_REQUEST
                                                        + " hardware packets are allowed per request");
                }

                for (HardwarePacketDraftRequest packet : request.packets()) {
                        if (packet == null) {
                                throw new RuntimeException(
                                                "Invalid hardware packet entry");
                        }

                        validateLines(packet.items());
                }
        }

        private void validateLines(
                        List<HardwareLineRequest> lines) {
                if (lines == null || lines.isEmpty()) {
                        throw new RuntimeException(
                                        "At least one hardware item is required");
                }

                if (lines.size() > MAX_LINES_PER_PACKET) {
                        throw new RuntimeException(
                                        "A hardware sticker supports a maximum of "
                                                        + MAX_LINES_PER_PACKET
                                                        + " item rows. Create another hardware packet.");
                }

                Set<String> duplicateCheck = new HashSet<>();

                for (HardwareLineRequest line : lines) {
                        if (line == null) {
                                throw new RuntimeException(
                                                "Invalid hardware item row");
                        }

                        String name = cleanRequired(
                                        line.itemName(),
                                        "Hardware item name is required");

                        if (name.length() > 300) {
                                throw new RuntimeException(
                                                "Hardware item name cannot exceed 300 characters");
                        }

                        if (line.quantity() == null
                                        || line.quantity()
                                                        .compareTo(BigDecimal.ZERO) <= 0) {
                                throw new RuntimeException(
                                                "Hardware item quantity must be greater than zero");
                        }

                        String key = name.toLowerCase()
                                        + "|"
                                        + normalizeUom(line.uom()).toLowerCase();

                        if (!duplicateCheck.add(key)) {
                                throw new RuntimeException(
                                                "Duplicate hardware item row: " + name);
                        }
                }
        }

        private boolean containsPlantIgnoreCase(
                        Set<String> allowedPlants,
                        String plantCode) {
                if (allowedPlants == null
                                || allowedPlants.isEmpty()
                                || plantCode == null
                                || plantCode.isBlank()) {
                        return false;
                }

                return allowedPlants.stream()
                                .filter(Objects::nonNull)
                                .anyMatch(value -> value.trim()
                                                .equalsIgnoreCase(
                                                                plantCode.trim()));
        }

        private void validateAddRequest(
                        HardwarePacketAddRequest request) {
                if (request == null) {
                        throw new RuntimeException(
                                        "Hardware packet request is required");
                }

                if (request.packets() == null
                                || request.packets().isEmpty()) {
                        throw new RuntimeException(
                                        "Add at least one hardware packet");
                }

                if (request.packets().size() > MAX_PACKETS_PER_REQUEST) {
                        throw new RuntimeException(
                                        "Maximum "
                                                        + MAX_PACKETS_PER_REQUEST
                                                        + " hardware packets are allowed per request");
                }

                for (HardwarePacketDraftRequest packet : request.packets()) {
                        if (packet == null) {
                                throw new RuntimeException(
                                                "Invalid hardware packet entry");
                        }

                        validateLines(
                                        packet.items());
                }
        }

        private void assertHardwareMasterWriteAccess(
                        MasterItem master,
                        User user) {
                if (master == null
                                || master.getItemType() != PacketItemType.HARDWARE) {
                        throw new AccessDeniedException(
                                        "This is not a hardware master item");
                }

                if (currentUserService.isAdmin(user)) {
                        return;
                }

                if (!currentUserService.isHardwarePacking(user)) {
                        throw new AccessDeniedException(
                                        "Hardware packing access required");
                }

                if (!Objects.equals(
                                master.getCreatedByUserId(),
                                user.getId())) {
                        throw new AccessDeniedException(
                                        "You cannot add packets to another user's hardware master");
                }
        }

        private int extractPacketNoOrZero(
                        String packetNumber) {
                if (packetNumber == null
                                || packetNumber.isBlank()) {
                        return 0;
                }

                Matcher matcher = Pattern.compile(
                                "(?i)Pkt-(\\d+)").matcher(packetNumber);

                if (!matcher.find()) {
                        return 0;
                }

                try {
                        return Integer.parseInt(
                                        matcher.group(1));
                } catch (NumberFormatException ignored) {
                        return 0;
                }
        }

        private String buildHardwareSku(
                        String pdNo,
                        String drawingNo,
                        int packetNo) {
                return safeSkuPart(pdNo)
                                + "/"
                                + safeSkuPart(drawingNo)
                                                .replace("/", "-")
                                + "/HW/Pkt-"
                                + packetNo;
        }

        private String normalizeUom(String value) {
                String clean = cleanOptional(value);

                if (clean.isBlank()) {
                        return "Nos";
                }

                if (clean.length() > 30) {
                        throw new RuntimeException(
                                        "UOM cannot exceed 30 characters");
                }

                return clean;
        }

        private String formatQuantity(BigDecimal value) {
                return value.stripTrailingZeros()
                                .toPlainString();
        }

        private int extractPacketNo(String packetNumber) {
                if (packetNumber == null
                                || !packetNumber.startsWith("Pkt-")) {
                        throw new RuntimeException(
                                        "Hardware packet number is missing");
                }

                return Integer.parseInt(
                                packetNumber
                                                .substring(4)
                                                .replaceAll("[^0-9]", ""));
        }

        private String safeSkuPart(String value) {
                String clean = cleanOptional(value);

                return clean.isBlank()
                                ? "-"
                                : clean.replaceAll("\\s+", " ");
        }

        private String safeActor(User user) {
                return user != null
                                && user.getUsername() != null
                                && !user.getUsername().isBlank()
                                                ? user.getUsername().trim()
                                                : "SYSTEM";
        }

        private String cleanRequired(
                        String value,
                        String message) {
                String clean = cleanOptional(value);

                if (clean.isBlank()) {
                        throw new RuntimeException(message);
                }

                return clean;
        }

        private String cleanOptional(String value) {
                return value == null
                                ? ""
                                : value.trim();
        }

        private String firstNonBlank(String... values) {
                if (values == null) {
                        return "";
                }

                for (String value : values) {
                        if (value != null
                                        && !value.trim().isBlank()) {
                                return value.trim();
                        }
                }

                return "";
        }
}