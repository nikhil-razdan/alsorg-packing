package com.alsorg.packing.service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardOpenOption;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.alsorg.packing.controller.dto.PacketItemResponse;
import com.alsorg.packing.domain.common.Company;
import com.alsorg.packing.domain.common.PacketStatus;
import com.alsorg.packing.domain.item.PacketItem;
import com.alsorg.packing.domain.packet.Packet;
import com.alsorg.packing.domain.sticker.ZohoSticker;
import com.alsorg.packing.integration.zoho.ZohoInventoryClient;
import com.alsorg.packing.integration.zoho.dto.ZohoItemDTO;
import com.alsorg.packing.repository.CompanyRepository;
import com.alsorg.packing.repository.PacketItemRepository;
import com.alsorg.packing.repository.PacketRepository;
import com.alsorg.packing.repository.ZohoStickerRepository;
import com.alsorg.packing.service.pdf.PdfStickerService;
import com.alsorg.packing.service.pdf.dto.StickerPdfData;

@Service
public class PacketService {

    private final PdfStickerService pdfStickerService;
    private final PacketRepository packetRepository;
    private final PacketItemRepository packetItemRepository;
    private final CompanyRepository companyRepository;
    private final StickerSequenceService stickerSequenceService;
    private final ZohoStickerRepository zohoStickerRepository;
    private final ZohoItemCacheService zohoItemCacheService;
    private final ZohoInventoryClient zohoInventoryClient;

    @Value("${sticker.storage.path}")
    private String stickerStoragePath;

    public PacketService(
            PacketRepository packetRepository,
            PacketItemRepository packetItemRepository,
            CompanyRepository companyRepository,
            StickerSequenceService stickerSequenceService,
            PdfStickerService pdfStickerService,
            ZohoStickerRepository zohoStickerRepository,
            ZohoItemCacheService zohoItemCacheService,
            ZohoInventoryClient zohoInventoryClient
    ) {
        this.packetRepository = packetRepository;
        this.packetItemRepository = packetItemRepository;
        this.companyRepository = companyRepository;
        this.stickerSequenceService = stickerSequenceService;
        this.pdfStickerService = pdfStickerService;
        this.zohoStickerRepository = zohoStickerRepository;
        this.zohoItemCacheService = zohoItemCacheService;
        this.zohoInventoryClient = zohoInventoryClient;
    }

    // =====================================================
    // PACKET CREATION (NO PDF HERE)
    // =====================================================
    @Transactional
    public Packet createPacket(UUID companyId, String createdBy, List<PacketItem> items) {

        System.out.println("🔥 createPacket() CALLED");
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
            System.out.println("🔥 ABOUT TO GENERATE PDF");

        }

        return packet;
    }

    // =====================================================
    // ZOHO ITEM → STICKER PDF (SINGLE SOURCE)
    // =====================================================
    @Transactional
    public void generateStickerForItem(String zohoItemId) throws IOException {

        if (zohoStickerRepository.existsById(zohoItemId)) {
            return;
        }

        ZohoItemDTO item =  zohoInventoryClient.fetchItemDetails(zohoItemId);
        
        if (item == null) {
            throw new IllegalStateException("Zoho item not found in cache: " + zohoItemId);
        }

        String stickerNumber = stickerSequenceService.generateNextStickerNumber();

        StickerPdfData pdfData = new StickerPdfData();
        pdfData.setStickerNumber(stickerNumber);
        pdfData.setBarcodeText(stickerNumber);
        pdfData.setItemName(item.getName());
        pdfData.setDescription(item.getDescription());
        pdfData.setLocation(item.getLocation());
        pdfData.setFloor(item.getFloor());
        pdfData.setClientName(item.getClientName());
        pdfData.setClientAddress(item.getClientAddress());
        pdfData.setPdNo(item.getPdNo());
        pdfData.setDrawingNo(item.getDrawingNo());
        pdfData.setRemarks(item.getRemarks());
        pdfData.setQuantity(1);
        pdfData.setDate(LocalDate.now().format(DateTimeFormatter.ofPattern("dd-MM-yyyy")));

        byte[] pdfBytes = pdfStickerService.generateSticker(pdfData);

        String fileName = "STICKER_" + stickerNumber + "_" + System.currentTimeMillis() + ".pdf";
        Path path = Paths.get(stickerStoragePath, fileName);

        try {
            Files.createDirectories(path.getParent());
            Files.write(path, pdfBytes, StandardOpenOption.CREATE_NEW);
        } catch (IOException e) {
            throw new RuntimeException("Failed to write sticker PDF", e);
        }

        ZohoSticker sticker = new ZohoSticker();
        sticker.setZohoItemId(zohoItemId);
        sticker.setStickerNumber(stickerNumber);
        sticker.setGeneratedAt(LocalDateTime.now());
        zohoStickerRepository.save(sticker);
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
                .orElseThrow(() ->
                        new IllegalArgumentException("Packet not found"));

        Path path = Paths.get(packet.getStickerPath());

        // 🔴 Legacy packet or missing file
        if (!Files.exists(path)) {
            throw new IllegalStateException(
                "Sticker file does not exist on disk for packet "
                + packet.getStickerNumber()
                + ". This is a legacy packet."
            );
        }

        try {
            return Files.readAllBytes(path);
        } catch (IOException e) {
            throw new RuntimeException(
                    "Failed to read sticker file from disk", e);
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
}
