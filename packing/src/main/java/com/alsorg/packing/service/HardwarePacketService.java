package com.alsorg.packing.service;

import static com.alsorg.packing.controller.dto.hardware.HardwarePacketDtos.*;

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

    private static final ZoneId APP_ZONE =
            ZoneId.of("Asia/Kolkata");

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
            PacketService packetService
    ) {
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
            User user
    ) {
        currentUserService.requireHardwarePackingOrAdmin(user);

        validateCreateRequest(request);

        String plantCode =
                currentUserService.resolvePlantForWrite(
                        user,
                        request.plantCode()
                );

        PlantLocationService.PlantConfig plant =
                plantLocationService.getPlantConfig(plantCode);

        Company company = companyRepository.findAll()
                .stream()
                .findFirst()
                .orElseThrow(() ->
                        new RuntimeException("No company found")
                );

        LocalDateTime now =
                LocalDateTime.now(APP_ZONE);

        String actor = safeActor(user);

        MasterItem master = new MasterItem();

        master.setItemName(cleanRequired(
                request.itemName(),
                "Hardware packet title is required"
        ));
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
                stickerSequenceService.generateNextStickerNumber()
        );
        packet.setStatus(PacketStatus.CREATED);
        packet.setCreatedBy(actor);
        packet.setCreatedAt(now);
        packet.setStickerGenerated(false);

        packet = packetRepository.save(packet);

        List<PacketItem> packetItems = new ArrayList<>();

        for (int packetIndex = 0;
             packetIndex < request.packets().size();
             packetIndex++) {

            HardwarePacketDraftRequest packetDraft =
                    request.packets().get(packetIndex);

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
                            packetNumber
                    )
            );

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

            List<HardwarePacketLine> lines =
                    buildLines(
                            item,
                            packetDraft.items(),
                            now
                    );

            item.replaceHardwareLines(lines);

            /*
             * Snapshot description is important for:
             * - sticker PDF;
             * - dispatched item;
             * - challan PDF;
             * - historical audit.
             */
            item.setDescription(
                    buildDescriptionSnapshot(lines)
            );

            packetItems.add(item);
        }

        List<PacketItem> saved =
                packetItemRepository.saveAll(packetItems);

        return saved.stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<HardwarePacketResponse> getVisiblePackets(
            User user
    ) {
        currentUserService.requireHardwarePackingOrAdmin(user);

        List<PacketItem> source;

        if (currentUserService.isAdmin(user)) {
            source = packetItemRepository
                    .findAllByItemTypeWithHardwareLines(
                            PacketItemType.HARDWARE
                    );
        } else {
            source = packetItemRepository
                    .findOwnedByItemTypeWithHardwareLines(
                            PacketItemType.HARDWARE,
                            user.getId()
                    );
        }

        return source.stream()
                .filter(this::showOnHardwareInventoryPage)
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public HardwarePacketResponse updatePacket(
            UUID itemId,
            HardwarePacketUpdateRequest request,
            User user
    ) {
        PacketItem item = getAccessibleHardwarePacket(
                itemId,
                user
        );

        if (item.getStickerNumber() != null
                && !item.getStickerNumber().isBlank()) {
            throw new RuntimeException(
                    "Printed hardware packet cannot be edited. "
                            + "Create another packet or use an admin correction flow."
            );
        }

        validateLines(request.items());

        item.setItemName(cleanRequired(
                request.itemName(),
                "Hardware packet title is required"
        ));
        item.setPdNo(cleanOptional(request.pdNo()));
        item.setDrawingNo(cleanOptional(request.drawingNo()));
        item.setClientName(cleanOptional(request.clientName()));
        item.setClientAddress(cleanOptional(request.clientAddress()));
        item.setFloor(cleanOptional(request.floor()));

        int packetNo = extractPacketNo(item.getPacketNumber());

        item.setSku(
                buildHardwareSku(
                        item.getPdNo(),
                        item.getDrawingNo(),
                        packetNo
                )
        );

        List<HardwarePacketLine> lines =
                buildLines(
                        item,
                        request.items(),
                        LocalDateTime.now(APP_ZONE)
                );

        item.replaceHardwareLines(lines);
        item.setDescription(buildDescriptionSnapshot(lines));

        PacketItem saved =
                packetItemRepository.save(item);

        return toResponse(saved);
    }

    @Transactional
    public void deletePacket(
            UUID itemId,
            User user
    ) {
        PacketItem item = getAccessibleHardwarePacket(
                itemId,
                user
        );

        if (!"CREATED".equalsIgnoreCase(item.getStatus())) {
            throw new RuntimeException(
                    "Only newly created hardware packets can be deleted"
            );
        }

        if (item.getStickerNumber() != null
                && !item.getStickerNumber().isBlank()) {
            throw new RuntimeException(
                    "Printed hardware packet cannot be deleted"
            );
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
            long remaining =
                    packetItemRepository.countByMasterItemId(masterId);

            masterItemRepository.findById(masterId)
                    .ifPresent(master -> {
                        if (remaining == 0) {
                            masterItemRepository.delete(master);
                        } else {
                            master.setTotalPackets(
                                    Math.toIntExact(remaining)
                            );
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
            User user
    ) {
        return packetService.previewHardwareSticker(
                itemId,
                factoryFloor,
                showCompanyHeader,
                user,
                currentUserService.allowedPlants(user)
        );
    }

    public byte[] generateSticker(
            UUID itemId,
            String factoryFloor,
            boolean showCompanyHeader,
            User user
    ) {
        return packetService.generateHardwareSticker(
                itemId,
                factoryFloor,
                showCompanyHeader,
                user,
                currentUserService.allowedPlants(user)
        );
    }

    public byte[] getLatestSticker(
            UUID itemId,
            User user
    ) {
        return packetService.getLatestHardwareStickerPdf(
                itemId,
                user,
                currentUserService.allowedPlants(user)
        );
    }

    private PacketItem getAccessibleHardwarePacket(
            UUID itemId,
            User user
    ) {
        currentUserService.requireHardwarePackingOrAdmin(user);

        PacketItem item = packetItemRepository.findById(itemId)
                .orElseThrow(() ->
                        new RuntimeException("Hardware packet not found")
                );

        assertHardwareOwnership(item, user);

        return item;
    }

    private void assertHardwareOwnership(
            PacketItem item,
            User user
    ) {
        if (item.getItemType() != PacketItemType.HARDWARE) {
            throw new AccessDeniedException(
                    "This is not a hardware packet"
            );
        }

        if (currentUserService.isAdmin(user)) {
            return;
        }

        if (!currentUserService.isHardwarePacking(user)) {
            throw new AccessDeniedException(
                    "Hardware packing access required"
            );
        }

        if (!Objects.equals(
                item.getCreatedByUserId(),
                user.getId()
        )) {
            throw new AccessDeniedException(
                    "You cannot access hardware packets created by another user"
            );
        }

        if (!currentUserService.allowedPlants(user)
                .contains(item.getPlantCode())) {
            throw new AccessDeniedException(
                    "You do not have access to this packet plant"
            );
        }
    }

    private List<HardwarePacketLine> buildLines(
            PacketItem packetItem,
            List<HardwareLineRequest> requests,
            LocalDateTime now
    ) {
        validateLines(requests);

        List<HardwarePacketLine> lines =
                new ArrayList<>();

        for (int index = 0;
             index < requests.size();
             index++) {

            HardwareLineRequest request =
                    requests.get(index);

            HardwarePacketLine line =
                    new HardwarePacketLine();

            line.setId(UUID.randomUUID());
            line.setPacketItem(packetItem);
            line.setLineNo(index + 1);
            line.setItemName(
                    cleanRequired(
                            request.itemName(),
                            "Hardware item name is required"
                    )
            );
            line.setQuantity(request.quantity());
            line.setUom(normalizeUom(request.uom()));
            line.setHardwareInventoryItemId(null);
            line.setCreatedAt(now);

            lines.add(line);
        }

        return lines;
    }

    private String buildDescriptionSnapshot(
            List<HardwarePacketLine> lines
    ) {
        return lines.stream()
                .map(line ->
                        line.getLineNo()
                                + ". "
                                + line.getItemName()
                                + " - Qty: "
                                + formatQuantity(line.getQuantity())
                                + " "
                                + line.getUom()
                )
                .reduce(
                        (left, right) -> left + "\n" + right
                )
                .orElse("-");
    }

    private HardwarePacketResponse toResponse(
            PacketItem item
    ) {
        List<HardwareLineResponse> lines =
                item.getHardwareLines() == null
                        ? List.of()
                        : item.getHardwareLines()
                                .stream()
                                .map(line ->
                                        new HardwareLineResponse(
                                                line.getId(),
                                                line.getLineNo(),
                                                line.getItemName(),
                                                line.getQuantity(),
                                                line.getUom()
                                        )
                                )
                                .toList();

        return new HardwarePacketResponse(
                item.getId(),
                item.getMasterItem() != null
                        ? item.getMasterItem().getId()
                        : null,
                item.getItemName(),
                item.getPacketNumber(),
                item.getSku(),
                item.getPdNo(),
                item.getDrawingNo(),
                item.getClientName(),
                item.getClientAddress(),
                item.getFloor(),
                item.getPlantCode(),
                item.getLocation(),
                item.getStatus(),
                item.getStickerNumber(),
                item.getPrintIteration(),
                item.getCreatedBy(),
                item.getCreatedByUserId(),
                lines
        );
    }

    private boolean showOnHardwareInventoryPage(
            PacketItem item
    ) {
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

        String currentLocation =
                firstNonBlank(
                        item.getCurrentLocationCode(),
                        item.getLocation()
                );

        String fgArea =
                cleanOptional(item.getFgAreaCode());

        if (!fgArea.isBlank()
                && (
                    currentLocation.equals(fgArea)
                    || currentLocation.startsWith(fgArea + "-")
                    || currentLocation.startsWith(fgArea + " ")
                )) {
            return false;
        }

        String packedArea =
                cleanOptional(item.getPackedAreaCode());

        if (!packedArea.isBlank()) {
            return currentLocation.equals(packedArea)
                    || currentLocation.startsWith(packedArea + "-")
                    || currentLocation.startsWith(packedArea + " ");
        }

        return currentLocation.startsWith("PKD");
    }

    private void validateCreateRequest(
            HardwarePacketCreateRequest request
    ) {
        if (request == null) {
            throw new RuntimeException(
                    "Hardware packet request is required"
            );
        }

        cleanRequired(
                request.itemName(),
                "Hardware packet title is required"
        );

        if (request.packets() == null
                || request.packets().isEmpty()) {
            throw new RuntimeException(
                    "At least one hardware packet is required"
            );
        }

        if (request.packets().size()
                > MAX_PACKETS_PER_REQUEST) {
            throw new RuntimeException(
                    "Maximum "
                            + MAX_PACKETS_PER_REQUEST
                            + " hardware packets are allowed per request"
            );
        }

        for (HardwarePacketDraftRequest packet :
                request.packets()) {
            if (packet == null) {
                throw new RuntimeException(
                        "Invalid hardware packet entry"
                );
            }

            validateLines(packet.items());
        }
    }

    private void validateLines(
            List<HardwareLineRequest> lines
    ) {
        if (lines == null || lines.isEmpty()) {
            throw new RuntimeException(
                    "At least one hardware item is required"
            );
        }

        if (lines.size() > MAX_LINES_PER_PACKET) {
            throw new RuntimeException(
                    "A hardware sticker supports a maximum of "
                            + MAX_LINES_PER_PACKET
                            + " item rows. Create another hardware packet."
            );
        }

        Set<String> duplicateCheck = new HashSet<>();

        for (HardwareLineRequest line : lines) {
            if (line == null) {
                throw new RuntimeException(
                        "Invalid hardware item row"
                );
            }

            String name = cleanRequired(
                    line.itemName(),
                    "Hardware item name is required"
            );

            if (name.length() > 300) {
                throw new RuntimeException(
                        "Hardware item name cannot exceed 300 characters"
                );
            }

            if (line.quantity() == null
                    || line.quantity()
                            .compareTo(BigDecimal.ZERO) <= 0) {
                throw new RuntimeException(
                        "Hardware item quantity must be greater than zero"
                );
            }

            String key = name.toLowerCase()
                    + "|"
                    + normalizeUom(line.uom()).toLowerCase();

            if (!duplicateCheck.add(key)) {
                throw new RuntimeException(
                        "Duplicate hardware item row: " + name
                );
            }
        }
    }

    private String buildHardwareSku(
            String pdNo,
            String drawingNo,
            int packetNo
    ) {
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
                    "UOM cannot exceed 30 characters"
            );
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
                    "Hardware packet number is missing"
            );
        }

        return Integer.parseInt(
                packetNumber
                        .substring(4)
                        .replaceAll("[^0-9]", "")
        );
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
            String message
    ) {
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