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
import java.util.LinkedHashSet;
import java.util.Set;

import com.alsorg.packing.exception.DuplicateSkuException;

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
            PlantLocationService plantLocationService
    ) {
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
    }
    
    private StickerPdfData buildStickerPdfData(
            PacketItem item,
            String stickerNumber,
            String factoryFloor,
            boolean showCompanyHeader,
            long iteration,
            boolean preview
    ) {
        StickerPdfData pdf = new StickerPdfData();

        String finalStickerNumber =
                preview ? "PREVIEW" : stickerNumber;

        pdf.setStickerNumber(finalStickerNumber);
        pdf.setBarcodeText(finalStickerNumber);

        pdf.setPacketItemId(item.getId().toString());

        pdf.setQrPayload(
                preview
                        ? "ALSORG|PREVIEW|PI=" + item.getId()
                        : "ALSORG|PI=" + item.getId() + "|SN=" + stickerNumber
        );

        pdf.setShowCompanyHeader(showCompanyHeader);

        pdf.setItemName(
                safeForPdf(item.getItemName()) + " (" + safeForPdf(item.getSku()) + ")"
        );

        pdf.setDescription(item.getDescription());
        pdf.setLocation(item.getLocation());

        pdf.setFloor(
                factoryFloor != null && !factoryFloor.isBlank()
                        ? factoryFloor.trim()
                        : item.getFloor()
        );

        pdf.setClientName(item.getClientName());
        pdf.setClientAddress(item.getClientAddress());
        pdf.setPdNo(item.getPdNo());
        pdf.setDrawingNo(item.getDrawingNo());
        pdf.setPrintIteration((int) iteration);
        pdf.setQuantity(1);
        pdf.setDate(java.time.LocalDate.now().toString());
        pdf.setDimensions(formatDimensionWithVolume(item.getDimensions()));
        pdf.setWeight(formatWeight(item.getWeight()));
        pdf.setRemarks(item.getRemarks());

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
                            + packet.getStickerNumber()
            );
        }

        try {
            return Files.readAllBytes(path);
        } catch (IOException e) {
            throw new RuntimeException("Failed to read sticker file", e);
        }
    }

    @Transactional(readOnly = true)
    public List<PacketItemResponse> getPacketItems(UUID packetId) {

        return packetItemRepository.findByPacketId(packetId)
                .stream()
                .map(item -> {
                    PacketItemResponse dto = new PacketItemResponse();
                    dto.setItemId(item.getId());
                    dto.setItemName(item.getItemName());
                    dto.setFloor(item.getFloor());
                    dto.setPdNo(item.getPdNo());
                    dto.setDrawingNo(item.getDrawingNo());
                    dto.setClientName(item.getClientName());
                    dto.setClientAddress(item.getClientAddress());
                    dto.setSku(item.getSku() != null ? item.getSku() : "-");
                    dto.setZohoItemId(item.getZohoItemId() != null ? item.getZohoItemId() : "-");
                    dto.setDescription(item.getDescription() != null ? item.getDescription() : "");
                    dto.setLocation(item.getLocation() != null ? item.getLocation() : "");
                    return dto;
                })
                .toList();
    }
    
    @Transactional
    public List<PacketItem> createItemWithPackets(
            CreateItemRequest req,
            String createdBy,
            String plantCode
    ) {
    	
    	 List<String> plannedSkus = new ArrayList<>();

    	    for (int i = 1; i <= req.numberOfPackets; i++) {
    	        plannedSkus.add(
    	                buildSku(req.pdNo, req.drawingNo, i)
    	        );
    	    }

    	    assertSkusAvailable(plannedSkus);
        String actor = safeActor(createdBy);
        LocalDateTime now = LocalDateTime.now();
        PlantLocationService.PlantConfig plant =
                plantLocationService.getPlantConfig(plantCode);

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

            String sku = plannedSkus.get(i - 1);
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
            Set<String> allowedPlants
    ) {
        PacketItem item = packetItemRepository.findById(itemId)
                .orElseThrow(() -> new RuntimeException("Item not found"));

        assertPlantAccess(item.getPlantCode(), allowedPlants);

        long iteration =
                item.getPrintIteration() == null
                        ? 1
                        : item.getPrintIteration();

        String previewStickerNumber =
                item.getStickerNumber() != null
                        ? item.getStickerNumber()
                        : "PREVIEW";

        StickerPdfData pdf = buildStickerPdfData(
                item,
                previewStickerNumber,
                factoryFloor,
                showCompanyHeader,
                iteration,
                true
        );

        return pdfService.generateSticker(pdf);
    }
    
    public byte[] generateStickerForPacketItem(
            UUID itemId,
            String factoryFloor,
            boolean showCompanyHeader
    ) {
        return generateStickerForPacketItem(
                itemId,
                factoryFloor,
                showCompanyHeader,
                "SYSTEM",
                null
        );
    }

    public byte[] generateStickerForPacketItem(
            UUID itemId,
            String factoryFloor,
            boolean showCompanyHeader,
            String generatedBy
    ) {
        return generateStickerForPacketItem(
                itemId,
                factoryFloor,
                showCompanyHeader,
                generatedBy,
                null
        );
    }

    @Transactional
    public byte[] generateStickerForPacketItem(
            UUID itemId,
            String factoryFloor,
            boolean showCompanyHeader,
            String generatedBy,
            Set<String> allowedPlants
    ) {

        PacketItem item = packetItemRepository.findById(itemId)
                .orElseThrow(() -> new RuntimeException("Item not found"));
        
        String plantCode = item.getPlantCode();

        assertPlantAccess(plantCode, allowedPlants);

        PlantLocationService.PlantConfig plant =
                plantLocationService.getPlantConfig(plantCode);

        String actor =
                generatedBy != null && !generatedBy.isBlank()
                        ? generatedBy.trim()
                        : "SYSTEM";

        LocalDateTime now = LocalDateTime.now();
        
        // ✅ BLOCK DUPLICATE PRINT
        long iteration = item.getPrintIteration() == null ? 1 : item.getPrintIteration();

     // 🔥 IMPORTANT: only increment on reprint (same item)
     if (item.getStickerNumber() != null) {
         iteration += 1;
     }

     // ✅ ALWAYS generate new sticker number
     String stickerNumber = stickerSequenceService.generateNextStickerNumber();

     item.setStickerNumber(stickerNumber);
     item.setPrintIteration(iteration);   // 🔥 IMPORTANT

     item.setStatus("READY"); // internal status
     item.setLocation(plant.packedAreaCode());
     item.setPackedAreaCode(plant.packedAreaCode());
     item.setCurrentLocationCode(plant.packedAreaCode());
     item.setFgAreaCode(plant.fgAreaCode());
     item.setPackedAt(now);
     item.setCreatedBy(actor);

        packetItemRepository.save(item);

        // create dispatch entry DIRECTLY in correct state
        dispatchedItemService.createFromPacketItem(item);

        DispatchedItem d = dispatchedRepo.findById(item.getId().toString())
                .orElseThrow();

        d.setStatus(ItemDispatchStatus.READY);
        d.setPlantCode(plantCode);
        d.setPackedAreaCode(plant.packedAreaCode());
        d.setCurrentLocationCode(plant.packedAreaCode());
        d.setFgAreaCode(plant.fgAreaCode());
        d.setFgZoneCode(null);
        d.setLocation(plant.packedAreaCode());
        d.setFloor(item.getFloor());
        d.setPackedAt(now);
        d.setCreatedAt(now);
        d.setPackedBy(actor);
        d.setCreatedBy(actor);

        dispatchedRepo.save(d);

        StickerPdfData pdf = buildStickerPdfData(
                item,
                stickerNumber,
                factoryFloor,
                showCompanyHeader,
                iteration,
                false
        );

        byte[] pdfBytes = pdfService.generateSticker(pdf);

        StickerHistory history = new StickerHistory();

        history.setPacketItem(item);
        history.setStickerNumber(stickerNumber);
        history.setPdfData(pdfBytes);

        history.setPrintIteration(iteration);

        history.setGeneratedBy(actor);

        history.setReason(
                iteration > 1
                        ? "REPRINT"
                        : "INITIAL"
        );

        history.setGeneratedAt(now);

        stickerHistoryRepository.save(history);

        return pdfBytes;
    }
    
    @Transactional
    public PacketItem adminUpdateStickerDetails(
            UUID itemId,
            UpdatePacketItemRequest req
    ) {
        PacketItem item = packetItemRepository.findById(itemId)
                .orElseThrow(() -> new RuntimeException("Item not found"));

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
                item.getSku()
        );

        String rebuiltSku = buildSku(
                item.getPdNo(),
                item.getDrawingNo(),
                packetNo
        );

        assertSkuAvailableForUpdate(rebuiltSku, item.getId());

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
    public void deleteItem(UUID itemId) {

        PacketItem item = packetItemRepository.findById(itemId)
                .orElseThrow(() -> new RuntimeException("Item not found"));

        // 🔥 RULE 1: Only newly created
        if (!"CREATED".equals(item.getStatus())) {
            throw new RuntimeException("Only newly created items can be deleted");
        }

        // 🔥 RULE 2: No sticker generated
        if (item.getStickerNumber() != null) {
            throw new RuntimeException("Cannot delete printed item");
        }

        packetItemRepository.delete(item);
    }
    
    @Transactional
    public List<PacketItem> addPackets(
            UUID masterItemId,
            CreateItemRequest req
    ) {
        return addPackets(masterItemId, req, "SYSTEM", null);
    }

    @Transactional
    public List<PacketItem> addPackets(
            UUID masterItemId,
            CreateItemRequest req,
            String createdBy
    ) {
        return addPackets(masterItemId, req, createdBy, null);
    }
    
    @Transactional
    public List<PacketItem> addPackets(
            UUID masterItemId,
            CreateItemRequest req,
            String createdBy,
            Set<String> allowedPlants
    ) {
        String actor = safeActor(createdBy);
        LocalDateTime now = LocalDateTime.now();

        MasterItem master = masterItemRepository.findById(masterItemId)
                .orElseThrow(() -> new RuntimeException("Master item not found"));
        
        String plantCode = master.getPlantCode();

        assertPlantAccess(plantCode, allowedPlants);

        PlantLocationService.PlantConfig plant =
                plantLocationService.getPlantConfig(plantCode);

        // ✅ GET COMPANY (same as before)
        Company company = companyRepository.findAll()
                .stream()
                .findFirst()
                .orElseThrow(() -> new RuntimeException("No company found"));

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

        List<String> plannedSkus = new ArrayList<>();

        for (int i = 0; i < req.numberOfPackets; i++) {
            int packetNo = start + i;

            plannedSkus.add(
                    buildSku(master.getPdNo(), master.getDrawingName(), packetNo)
            );
        }

        assertSkusAvailable(plannedSkus);
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

            String sku = plannedSkus.get(i);

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
    
    @Transactional
    public PacketItem createCustomPacket(CreateItemRequest req) {
        return createCustomPacket(req, "SYSTEM", req.getPlantCode());
    }

    @Transactional
    public PacketItem createCustomPacket(
            CreateItemRequest req,
            String createdBy
    ) {
        return createCustomPacket(req, createdBy, req.getPlantCode());
    }
    
    @Transactional
    public PacketItem createCustomPacket(
            CreateItemRequest req,
            String createdBy,
            String plantCode
    ) {
        String actor = safeActor(createdBy);
        LocalDateTime now = LocalDateTime.now();

        Company company = companyRepository.findAll()
                .stream()
                .findFirst()
                .orElseThrow(() -> new RuntimeException("No company found"));
        
        PlantLocationService.PlantConfig plant =
                plantLocationService.getPlantConfig(plantCode);

        // 🔥 CREATE MASTER ITEM (same as existing)
        MasterItem master = new MasterItem();
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
        assertSkuAvailable(sku);

        item.setSku(sku);

        item.setStatus("CREATED");
        item.setCreatedBy(actor);

        return packetItemRepository.save(item);
    }
    
    @Transactional
    public PacketItem addCustomPacket(
            UUID masterItemId,
            CreateItemRequest req
    ) {
        return addCustomPacket(masterItemId, req, "SYSTEM", null);
    }

    @Transactional
    public PacketItem addCustomPacket(
            UUID masterItemId,
            CreateItemRequest req,
            String createdBy
    ) {
        return addCustomPacket(masterItemId, req, createdBy, null);
    }
    
    @Transactional
    public PacketItem addCustomPacket(
            UUID masterItemId,
            CreateItemRequest req,
            String createdBy,
            Set<String> allowedPlants
    ) {
        String actor = safeActor(createdBy);
        LocalDateTime now = LocalDateTime.now();

        MasterItem master = masterItemRepository.findById(masterItemId)
                .orElseThrow(() -> new RuntimeException("Master item not found"));
        
        String plantCode = master.getPlantCode();

        assertPlantAccess(plantCode, allowedPlants);

        PlantLocationService.PlantConfig plant =
                plantLocationService.getPlantConfig(plantCode);

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
        assertSkuAvailable(sku);

        item.setSku(sku);
        item.setQuantity(1);
        item.setLocation("FLOOR");
        item.setStatus("CREATED");
        item.setCreatedBy(actor);
        

        return packetItemRepository.save(item);
    }
    
    @Transactional
    public PacketItem updatePacketItem(
            UUID itemId,
            UpdatePacketItemRequest req
    ) {

        PacketItem item = packetItemRepository.findById(itemId)
                .orElseThrow(() -> new RuntimeException("Item not found"));

        boolean stickerGenerated =
                item.getStickerNumber() != null;

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
                    item.getSku()
            );

            String sku = buildSku(
                    req.getPdNo(),
                    req.getDrawingNo(),
                    packetNo
            );

            assertSkuAvailableForUpdate(sku, item.getId());

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
                    packetNumber.replace("Pkt-", "").trim()
            );
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

    private void assertSkuAvailable(String sku) {
        if (sku == null || sku.trim().isBlank()) {
            throw new RuntimeException("SKU cannot be blank");
        }

        if (packetItemRepository.existsSkuAlready(sku)) {
            throw new DuplicateSkuException(sku);
        }
    }

    private void assertSkuAvailableForUpdate(String sku, UUID currentItemId) {
        if (sku == null || sku.trim().isBlank()) {
            throw new RuntimeException("SKU cannot be blank");
        }

        if (packetItemRepository.existsSkuAlreadyForOtherItem(sku, currentItemId)) {
            throw new DuplicateSkuException(sku);
        }
    }

    private void assertSkusAvailable(List<String> skus) {
        Set<String> requestCheck = new LinkedHashSet<>();

        for (String sku : skus) {
            if (sku == null || sku.trim().isBlank()) {
                throw new RuntimeException("SKU cannot be blank");
            }

            String normalized = sku.trim().toLowerCase();

            if (!requestCheck.add(normalized)) {
                throw new DuplicateSkuException(sku);
            }

            if (packetItemRepository.existsSkuAlready(sku)) {
                throw new DuplicateSkuException(sku);
            }
        }
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
            String plantCode
    ) {
        PlantLocationService.PlantConfig plant =
                plantLocationService.getPlantConfig(plantCode);

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
}
