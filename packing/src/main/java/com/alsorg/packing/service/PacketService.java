package com.alsorg.packing.service;

import java.io.IOException;
import com.alsorg.packing.repository.MasterItemRepository;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
import com.alsorg.packing.service.pdf.dto.StickerPdfData;
import com.alsorg.packing.domain.sticker.StickerHistory;
import com.alsorg.packing.repository.StickerHistoryRepository;
import java.util.Set;
import java.util.Objects;
import org.springframework.security.access.AccessDeniedException;
import com.alsorg.packing.domain.users.User;

@Service
public class PacketService {

        private final PacketRepository packetRepository;
        private final PacketItemRepository packetItemRepository;
        private final CompanyRepository companyRepository;
        private final StickerSequenceService stickerSequenceService;
        private final PdfStickerService pdfService;
        private final DispatchedItemService dispatchedItemService;
        private final DispatchedItemRepository dispatchedRepo;
        private final MasterItemRepository masterItemRepository;
        private final StickerHistoryRepository stickerHistoryRepository;
        private final PlantLocationService plantLocationService;
        private final ActivityLogService activityLogService;

        @Value("${sticker.storage.path}")
        private String stickerStoragePath;

        public PacketService(
                        PacketRepository packetRepository,
                        PacketItemRepository packetItemRepository,
                        CompanyRepository companyRepository,
                        StickerSequenceService stickerSequenceService,
                        PdfStickerService pdfService,
                        DispatchedItemService dispatchedItemService,
                        DispatchedItemRepository dispatchedRepo,
                        MasterItemRepository masterItemRepository,
                        StickerHistoryRepository stickerHistoryRepository,
                        ActivityLogService activityLogService,
                        PlantLocationService plantLocationService) {
                this.packetRepository = packetRepository;
                this.packetItemRepository = packetItemRepository;
                this.companyRepository = companyRepository;
                this.stickerSequenceService = stickerSequenceService;
                this.pdfService = pdfService;
                this.dispatchedItemService = dispatchedItemService;
                this.dispatchedRepo = dispatchedRepo;
                this.masterItemRepository = masterItemRepository;
                this.stickerHistoryRepository = stickerHistoryRepository;
                this.plantLocationService = plantLocationService;
                this.activityLogService = activityLogService;
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

                pdf.setPacketNo(item.getPacketNumber());
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
                pdf.setDate(java.time.LocalDate.now().toString());

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

        private void assertPlantAccess(String plantCode, Set<String> allowedPlants) {
                if (plantCode == null || plantCode.isBlank()) {
                        throw new RuntimeException("Plant code missing");
                }

                if (allowedPlants != null && !allowedPlants.contains(plantCode)) {
                        throw new RuntimeException("User does not have access to plant: " + plantCode);
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
                packet.setStickerNumber(stickerSequenceService.generateNextStickerNumber());
                packet.setStatus(PacketStatus.CREATED);
                packet.setCreatedBy(createdBy);
                packet.setCreatedAt(LocalDateTime.now());
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

        public Page<Packet> getPackets(UUID companyId, PacketStatus status, Pageable pageable) {

                if (companyId != null && status != null) {
                        return packetRepository.findByCompany_IdAndStatus(companyId, status, pageable);
                }

                if (companyId != null) {
                        return packetRepository.findByCompany_Id(companyId, pageable);
                }

                if (status != null) {
                        return packetRepository.findByStatus(status, pageable);
                }

                return packetRepository.findAll(pageable);
        }

        public Packet getPacketById(UUID packetId) {
                return packetRepository.findById(packetId)
                                .orElseThrow(() -> new IllegalArgumentException("Packet not found"));
        }

        @Transactional(readOnly = true)
        public byte[] getExistingStickerPdf(UUID packetId) {

                Packet packet = packetRepository.findById(packetId)
                                .orElseThrow(() -> new IllegalArgumentException("Packet not found"));

                Path path = Paths.get(packet.getStickerPath());

                if (!Files.exists(path)) {
                        throw new IllegalStateException(
                                        "Sticker file does not exist on disk for packet "
                                                        + packet.getStickerNumber());
                }

                try {
                        return Files.readAllBytes(path);
                } catch (IOException e) {
                        throw new RuntimeException("Failed to read sticker file", e);
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
                                                        item.getSku() != null
                                                                        ? item.getSku()
                                                                        : "-");

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
                        String createdBy,
                        String plantCode) {

                String actor = safeActor(createdBy);
                LocalDateTime now = LocalDateTime.now();
                PlantLocationService.PlantConfig plant = plantLocationService.getPlantConfig(plantCode);

                // 🔥 1. CREATE DUMMY COMPANY (TEMP FIX)
                Company company = companyRepository.findAll()
                                .stream()
                                .findFirst()
                                .orElseThrow(() -> new RuntimeException("No company found"));

                MasterItem master = new MasterItem();

                master.setItemName(req.itemName);
                master.setPdNo(req.pdNo);
                master.setDrawingName(req.drawingNo);
                master.setClientName(req.clientName);
                master.setAddress(req.clientAddress);
                master.setTotalPackets(req.numberOfPackets);
                master.setFloor(req.floor);
                master.setPlantCode(plantCode);
                master.setItemType(PacketItemType.NORMAL);

                master = masterItemRepository.save(master);

                // 🔥 2. CREATE PACKET (MASTER)
                Packet packet = new Packet();
                packet.setId(UUID.randomUUID());
                packet.setCompany(company); // ✅ REQUIRED
                packet.setStickerNumber(stickerSequenceService.generateNextStickerNumber());
                packet.setStatus(PacketStatus.CREATED);
                packet.setCreatedBy(actor);
                packet.setCreatedAt(now);
                packet.setStickerGenerated(false);

                packet = packetRepository.save(packet);

                // 🔥 3. CREATE ITEMS
                List<PacketItem> items = new ArrayList<>();

                List<String> descriptions = req.getDescriptions();

                for (int i = 1; i <= req.numberOfPackets; i++) {

                        PacketItem item = new PacketItem();

                        item.setId(UUID.randomUUID());
                        item.setPacket(packet);
                        item.setMasterItem(master);
                        item.setItemType(PacketItemType.NORMAL);
                        item.setItemName(req.itemName);
                        item.setPdNo(req.pdNo);
                        item.setDrawingNo(req.drawingNo);
                        item.setClientName(req.clientName);
                        item.setClientAddress(req.clientAddress);
                        item.setFloor(req.floor);

                        String desc = (descriptions != null && descriptions.size() >= i)
                                        ? descriptions.get(i - 1)
                                        : "";

                        item.setDescription(desc);
                        List<String> weights = req.getWeights();
                        List<String> dimensionsList = req.getDimensionsList();
                        List<String> remarksList = req.getRemarksList();

                        String weight = (weights != null && weights.size() >= i)
                                        ? weights.get(i - 1)
                                        : "";

                        String dimension = (dimensionsList != null && dimensionsList.size() >= i)
                                        ? dimensionsList.get(i - 1)
                                        : "";

                        String remark = (remarksList != null && remarksList.size() >= i)
                                        ? remarksList.get(i - 1)
                                        : "";

                        item.setWeight(weight);
                        item.setDimensions(dimension);
                        item.setRemarks(remark);

                        int packetNo = i;

                        item.setPacketNumber("Pkt-" + packetNo);

                        String sku = buildSku(req.pdNo, req.drawingNo, packetNo);
                        item.setSku(sku);

                        item.setQuantity(1);
                        item.setPlantCode(plantCode);
                        item.setPackedAreaCode(plant.packedAreaCode());
                        item.setCurrentLocationCode(null);
                        item.setFgAreaCode(plant.fgAreaCode());
                        item.setFgZoneCode(null);
                        item.setLocation("FLOOR");
                        item.setStatus("CREATED");
                        item.setCreatedBy(actor);

                        items.add(item);
                }

                return packetItemRepository.saveAll(items);
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

        @Transactional
        private byte[] generateStickerInternal(
                        UUID itemId,
                        String factoryFloor,
                        boolean showCompanyHeader,
                        User user,
                        Set<String> allowedPlants,
                        PacketItemType expectedType,
                        String actorOverride) {
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
                        assertHardwarePacketAccess(
                                        item,
                                        user,
                                        allowedPlants);
                } else {
                        assertNormalPacketAccess(
                                        item,
                                        user,
                                        allowedPlants);
                }

                String plantCode = item.getPlantCode();

                PlantLocationService.PlantConfig plant = plantLocationService.getPlantConfig(
                                plantCode);

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
                                .generateNextStickerNumber();

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
                item.setPackedAt(now);

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

                dispatchedItem.setPackedAt(now);
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
                        dispatchedItem.setCreatedBy(actor);
                }

                dispatchedRepo.save(
                                dispatchedItem);

                StickerPdfData pdf = buildStickerPdfData(
                                item,
                                stickerNumber,
                                factoryFloor,
                                showCompanyHeader,
                                iteration,
                                false);

                byte[] pdfBytes = pdfService.generateSticker(pdf);

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

                String rebuiltSku = buildSku(
                                item.getPdNo(),
                                item.getDrawingNo(),
                                packetNo);

                item.setSku(rebuiltSku);

                PacketItem saved = packetItemRepository.save(item);

                dispatchedRepo.findById(itemId.toString()).ifPresent(d -> {
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

                return saved;
        }

        private String keepExistingIfNull(String newValue, String oldValue) {
                return newValue == null ? oldValue : newValue;
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
                LocalDateTime now = LocalDateTime.now();

                MasterItem master = masterItemRepository.findById(masterItemId)
                                .orElseThrow(() -> new RuntimeException("Master item not found"));

                String plantCode = master.getPlantCode();

                assertPlantAccess(plantCode, allowedPlants);

                PlantLocationService.PlantConfig plant = plantLocationService.getPlantConfig(plantCode);

                // ✅ GET COMPANY (same as before)
                Company company = companyRepository.findAll()
                                .stream()
                                .findFirst()
                                .orElseThrow(() -> new RuntimeException("No company found"));

                if (master.getItemType() == PacketItemType.HARDWARE) {
                        throw new AccessDeniedException(
                                        "Hardware master items must be managed through the hardware packet API");
                }
                // ✅ CREATE NEW PACKET (MANDATORY)
                Packet packet = new Packet();
                packet.setId(UUID.randomUUID());
                packet.setCompany(company);
                packet.setStickerNumber(stickerSequenceService.generateNextStickerNumber());
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

                        String sku = buildSku(master.getPdNo(), master.getDrawingName(), packetNo);

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

        private boolean isAdmin(User user) {
                return user != null
                                && "ADMIN".equalsIgnoreCase(user.getRole());
        }

        private boolean isHardwarePacking(User user) {
                return user != null
                                && "HARDWARE_PACKING".equalsIgnoreCase(user.getRole());
        }

        private void assertNormalPacketAccess(
                        PacketItem item,
                        User user,
                        Set<String> allowedPlants) {
                if (effectiveItemType(item) == PacketItemType.HARDWARE) {
                        throw new AccessDeniedException(
                                        "Hardware packets must be accessed through the hardware packet API");
                }

                if (isHardwarePacking(user)) {
                        throw new AccessDeniedException(
                                        "Hardware packing users cannot access normal inventory");
                }

                if (isAdmin(user)) {
                        return;
                }

                assertPlantAccess(
                                item.getPlantCode(),
                                allowedPlants);
        }

        private void assertHardwarePacketAccess(
                        PacketItem item,
                        User user,
                        Set<String> allowedPlants) {
                if (effectiveItemType(item) != PacketItemType.HARDWARE) {
                        throw new AccessDeniedException(
                                        "This is not a hardware packet");
                }

                if (isAdmin(user)) {
                        return;
                }

                if (!isHardwarePacking(user)) {
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

        @Transactional
        public PacketItem createCustomPacket(CreateItemRequest req) {
                return createCustomPacket(req, "SYSTEM", req.getPlantCode());
        }

        @Transactional
        public PacketItem createCustomPacket(
                        CreateItemRequest req,
                        String createdBy) {
                return createCustomPacket(req, createdBy, req.getPlantCode());
        }

        @Transactional
        public PacketItem createCustomPacket(
                        CreateItemRequest req,
                        String createdBy,
                        String plantCode) {
                String actor = safeActor(createdBy);
                LocalDateTime now = LocalDateTime.now();

                Company company = companyRepository.findAll()
                                .stream()
                                .findFirst()
                                .orElseThrow(() -> new RuntimeException("No company found"));

                PlantLocationService.PlantConfig plant = plantLocationService.getPlantConfig(plantCode);

                // 🔥 CREATE MASTER ITEM (same as existing)
                MasterItem master = new MasterItem();
                master.setItemType(PacketItemType.NORMAL);
                master.setItemName(req.itemName);
                master.setPdNo(req.pdNo);
                master.setDrawingName(req.drawingNo);
                master.setClientName(req.clientName);
                master.setAddress(req.clientAddress);
                master.setTotalPackets(1);
                master.setFloor(req.floor);
                master.setPlantCode(plantCode);

                master = masterItemRepository.save(master);

                // 🔥 CREATE PACKET
                Packet packet = new Packet();
                packet.setId(UUID.randomUUID());
                packet.setCompany(company);
                packet.setStickerNumber(stickerSequenceService.generateNextStickerNumber());
                packet.setStatus(PacketStatus.CREATED);
                packet.setCreatedBy(actor);
                packet.setCreatedAt(now);
                packet.setStickerGenerated(false);

                packet = packetRepository.save(packet);

                int packetNo = req.getCustomPacketNumber();

                // 🔥 DUPLICATE CHECK
                if (packetItemRepository.existsByMasterItemIdAndPacketNumber(
                                master.getId(), "Pkt-" + packetNo)) {
                        throw new RuntimeException("Packet number already exists");
                }

                PacketItem item = new PacketItem();

                item.setId(UUID.randomUUID());
                item.setPacket(packet);
                item.setItemType(PacketItemType.NORMAL);
                item.setMasterItem(master);
                item.setDescription(req.getDescriptions().get(0));
                item.setWeight(req.getWeights().get(0));
                item.setDimensions(req.getDimensionsList().get(0));
                item.setRemarks(req.getRemarksList().get(0));
                item.setItemName(req.itemName);
                item.setPdNo(req.pdNo);
                item.setDrawingNo(req.drawingNo);
                item.setClientName(req.clientName);
                item.setClientAddress(req.clientAddress);
                item.setFloor(req.floor);
                item.setPlantCode(plantCode);
                item.setPackedAreaCode(plant.packedAreaCode());
                item.setCurrentLocationCode(null);
                item.setFgAreaCode(plant.fgAreaCode());
                item.setFgZoneCode(null);
                item.setPacketNumber("Pkt-" + packetNo);

                String sku = buildSku(req.pdNo, req.drawingNo, packetNo);

                item.setSku(sku);

                item.setStatus("CREATED");
                item.setCreatedBy(actor);

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
                LocalDateTime now = LocalDateTime.now();

                MasterItem master = masterItemRepository.findById(masterItemId)
                                .orElseThrow(() -> new RuntimeException("Master item not found"));

                if (master.getItemType() == PacketItemType.HARDWARE) {
                        throw new AccessDeniedException(
                                        "Custom normal packets cannot be added to a hardware master item");
                }

                String plantCode = master.getPlantCode();

                assertPlantAccess(plantCode, allowedPlants);

                PlantLocationService.PlantConfig plant = plantLocationService.getPlantConfig(plantCode);

                Company company = companyRepository.findAll()
                                .stream()
                                .findFirst()
                                .orElseThrow(() -> new RuntimeException("No company found"));

                Packet packet = new Packet();
                packet.setId(UUID.randomUUID());
                packet.setCompany(company);
                packet.setStickerNumber(stickerSequenceService.generateNextStickerNumber());
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

                String sku = buildSku(master.getPdNo(), master.getDrawingName(), packetNo);

                item.setSku(sku);
                item.setQuantity(1);
                item.setLocation("FLOOR");
                item.setStatus("CREATED");
                item.setCreatedBy(actor);

                return packetItemRepository.save(item);
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

                boolean stickerGenerated = item.getStickerNumber() != null;

                /*
                 * ALWAYS EDITABLE FIELDS
                 */

                item.setDescription(req.getDescription());
                item.setWeight(req.getWeight());
                item.setDimensions(req.getDimensions());
                item.setRemarks(req.getRemarks());
                item.setFloor(req.getFloor());
                item.setLocation(req.getLocation());
                item.setClientAddress(req.getClientAddress());

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

                        String sku = buildSku(
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

        @Transactional
        public StickerHistory ensureStickerHistoryForDispatchedItem(
                        String zohoItemId,
                        String generatedBy,
                        Set<String> allowedPlants) {
                if (zohoItemId == null || zohoItemId.trim().isBlank()) {
                        throw new RuntimeException("Dispatched item id missing");
                }

                String actor = safeActor(generatedBy);
                LocalDateTime now = LocalDateTime.now();

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
                        stickerNumber = stickerSequenceService.generateNextStickerNumber();
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

                StickerPdfData pdf = buildStickerPdfData(
                                packetItem,
                                stickerNumber,
                                packetItem.getFloor(),
                                true,
                                iteration,
                                false);

                byte[] pdfBytes = pdfService.generateSticker(pdf);

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

                packetItem.setPdNo(
                                keepExistingIfBlank(
                                                packetItem.getPdNo(),
                                                dispatchedItem.getPdNo()));

                packetItem.setDrawingNo(
                                keepExistingIfBlank(
                                                packetItem.getDrawingNo(),
                                                dispatchedItem.getDrawingNo()));

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
                Company company = companyRepository.findAll()
                                .stream()
                                .findFirst()
                                .orElseThrow(() -> new RuntimeException("No company found"));

                Packet packet = new Packet();

                packet.setId(UUID.randomUUID());
                packet.setCompany(company);
                packet.setStickerNumber(
                                stickerSequenceService.generateNextStickerNumber());
                packet.setStatus(PacketStatus.CREATED);
                packet.setCreatedBy(actor);
                packet.setCreatedAt(LocalDateTime.now());
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

                String sku = firstNonBlankValue(
                                dispatchedItem.getSku(),
                                buildSku(
                                                dispatchedItem.getPdNo(),
                                                dispatchedItem.getDrawingNo(),
                                                1));

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

                packetItem.setPacketNumber("Pkt-1");
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

                PacketItem saved = packetItemRepository.save(packetItem);

                dispatchedItem.setPacketId(packet.getId());
                dispatchedItem.setPacketItemId(saved.getId());

                dispatchedRepo.save(dispatchedItem);

                return saved;
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
                if (allowedPlants == null || allowedPlants.isEmpty()) {
                        return;
                }

                /*
                 * Legacy safety:
                 * Old records may not have plantCode.
                 * Do not block them.
                 */
                if (plantCode == null || plantCode.isBlank()) {
                        return;
                }

                if (!allowedPlants.contains(plantCode)) {
                        throw new RuntimeException(
                                        "User does not have access to plant: " + plantCode);
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
                                showCompanyHeader);
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

                assertHardwarePacketAccess(
                                item,
                                user,
                                allowedPlants);

                return previewStickerInternal(
                                item,
                                factoryFloor,
                                showCompanyHeader);
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

                assertHardwarePacketAccess(
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

                StickerPdfData pdf = buildStickerPdfData(
                                item,
                                activeStickerNumber,
                                item.getFloor(),
                                true,
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

                assertHardwarePacketAccess(
                                item,
                                user,
                                allowedPlants);

                return getStickerHistoryPdfInternal(
                                history,
                                item);
        }

        private byte[] getStickerHistoryPdfInternal(
                        StickerHistory history,
                        PacketItem item) {
                if (history.getPdfData() != null
                                && history.getPdfData().length > 0) {
                        return history.getPdfData();
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

                StickerPdfData pdf = buildStickerPdfData(
                                item,
                                stickerNumber,
                                item.getFloor(),
                                true,
                                iteration,
                                false);

                return pdfService.generateSticker(pdf);
        }

        private PacketItemType effectiveItemType(
                        PacketItem item) {
                if (item == null || item.getItemType() == null) {
                        return PacketItemType.NORMAL;
                }

                return item.getItemType();
        }
}
