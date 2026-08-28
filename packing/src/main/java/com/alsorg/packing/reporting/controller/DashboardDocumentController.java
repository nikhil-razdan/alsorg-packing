package com.alsorg.packing.reporting.controller;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.alsorg.packing.domain.sticker.StickerHistory;
import com.alsorg.packing.repository.StickerHistoryRepository;
import com.alsorg.packing.service.pdf.ChalaanItem;
import com.alsorg.packing.service.pdf.ChalaanPdfData;
import com.alsorg.packing.service.pdf.ChalaanPdfService;

@RestController
@RequestMapping("/api/reports/dashboard")
@PreAuthorize("isAuthenticated()")
public class DashboardDocumentController {

    private static final int MAX_CHALLAN_NUMBER_LENGTH = 255;

    private final StickerHistoryRepository stickerHistoryRepository;
    private final JdbcTemplate jdbc;
    private final ChalaanPdfService chalaanPdfService;

    public DashboardDocumentController(
            StickerHistoryRepository stickerHistoryRepository,
            JdbcTemplate jdbc,
            ChalaanPdfService chalaanPdfService) {
        this.stickerHistoryRepository = stickerHistoryRepository;
        this.jdbc = jdbc;
        this.chalaanPdfService = chalaanPdfService;
    }

    @GetMapping("/packet-items/{packetItemId}/sticker/preview")
    public ResponseEntity<Resource> previewSticker(
            @PathVariable UUID packetItemId) {
        return serveSticker(packetItemId, false);
    }

    @GetMapping("/packet-items/{packetItemId}/sticker/download")
    public ResponseEntity<Resource> downloadSticker(
            @PathVariable UUID packetItemId) {
        return serveSticker(packetItemId, true);
    }

    private ResponseEntity<Resource> serveSticker(
            UUID packetItemId,
            boolean download) {
        if (packetItemId == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Packet item id is required");
        }

        List<StickerHistory> history = stickerHistoryRepository
                .findByPacketItem_IdOrderByGeneratedAtDesc(packetItemId);

        StickerHistory selected = history.stream()
                .filter(value -> value != null
                        && value.getPdfData() != null
                        && value.getPdfData().length > 100)
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Sticker PDF not found for packet item " + packetItemId));

        String stickerNumber = selected.getStickerNumber() == null
                || selected.getStickerNumber().isBlank()
                        ? packetItemId.toString()
                        : selected.getStickerNumber();

        String filename = cleanFileName(
                "Sticker_" + stickerNumber + ".pdf");

        return pdfResponse(
                selected.getPdfData(),
                filename,
                download);
    }

    @GetMapping("/challan/preview")
    public ResponseEntity<Resource> previewChallan(
            @RequestParam String challanNumber) {
        return serveChallan(challanNumber, false);
    }

    @GetMapping("/challan/download")
    public ResponseEntity<Resource> downloadChallan(
            @RequestParam String challanNumber) {
        return serveChallan(challanNumber, true);
    }

    private ResponseEntity<Resource> serveChallan(
            String challanNumber,
            boolean download) {
        String cleanChallan = requireChallanNumber(challanNumber);

        List<ChalaanItem> items = jdbc.query(
                """
                select
                    d.name,
                    d.sku,
                    d.pd_no,
                    d.drawing_no,
                    d.description,
                    d.remarks,
                    d.client_name,
                    d.client_address
                from dispatched_items d
                where d.chalaan_number = ?
                order by d.name asc nulls last, d.zoho_item_id asc
                """,
                (rs, rowNum) -> {
                    ChalaanItem item = new ChalaanItem();
                    item.setItemName(rs.getString("name"));
                    item.setPdNo(rs.getString("pd_no"));
                    item.setDrawingNo(rs.getString("drawing_no"));
                    item.setDescription(rs.getString("description"));
                    item.setRemarks(rs.getString("remarks"));
                    item.setClientName(rs.getString("client_name"));
                    item.setClientAddress(rs.getString("client_address"));
                    return item;
                },
                cleanChallan);

        if (items.isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "No dispatched items found for challan " + cleanChallan);
        }

        ChallanHeader header = jdbc.query(
                """
                select
                    max(d.driver_name) as driver_name,
                    max(d.vehicle_number) as vehicle_number,
                    max(d.client_address) as address,
                    min(d.dispatched_at) as dispatch_time
                from dispatched_items d
                where d.chalaan_number = ?
                """,
                rs -> {
                    if (!rs.next()) {
                        return null;
                    }

                    java.sql.Timestamp dispatchTimestamp = rs.getTimestamp("dispatch_time");

                    return new ChallanHeader(
                            rs.getString("driver_name"),
                            rs.getString("vehicle_number"),
                            rs.getString("address"),
                            dispatchTimestamp == null
                                    ? null
                                    : dispatchTimestamp.toLocalDateTime());
                },
                cleanChallan);

        ChalaanPdfData data = new ChalaanPdfData();
        data.setVoucherNo(cleanChallan);
        data.setItems(items);

        if (header != null) {
            data.setDriverName(header.driverName());
            data.setVehicleNumber(header.vehicleNumber());
            data.setAddress(header.address());
            data.setDispatchTime(header.dispatchTime());
        }

        byte[] pdf = chalaanPdfService.generateChalaan(data);

        String filename = cleanFileName(
                "Challan_" + cleanChallan + ".pdf");

        return pdfResponse(pdf, filename, download);
    }

    private ResponseEntity<Resource> pdfResponse(
            byte[] pdf,
            String filename,
            boolean download) {
        if (pdf == null || pdf.length == 0) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "PDF not found");
        }

        ContentDisposition disposition = download
                ? ContentDisposition.attachment()
                        .filename(filename, StandardCharsets.UTF_8)
                        .build()
                : ContentDisposition.inline()
                        .filename(filename, StandardCharsets.UTF_8)
                        .build();

        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                .header(
                        HttpHeaders.CACHE_CONTROL,
                        "no-store, no-cache, must-revalidate, max-age=0")
                .header("Pragma", "no-cache")
                .body(new ByteArrayResource(pdf));
    }

    private String requireChallanNumber(String value) {
        String clean = value == null ? "" : value.trim();

        if (clean.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Challan number missing");
        }

        if (clean.length() > MAX_CHALLAN_NUMBER_LENGTH
                || clean.indexOf('\r') >= 0
                || clean.indexOf('\n') >= 0) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Invalid challan number");
        }

        return clean;
    }

    private String cleanFileName(String value) {
        String text = value == null || value.trim().isBlank()
                ? "document.pdf"
                : value.trim();

        text = text.replaceAll("[\\\\/:*?\"<>|]", "_");

        if (text.length() > 180) {
            String suffix = text.toLowerCase(java.util.Locale.ROOT).endsWith(".pdf")
                    ? ".pdf"
                    : "";
            int keep = Math.max(1, 180 - suffix.length());
            text = text.substring(0, Math.min(text.length(), keep)) + suffix;
        }

        return text;
    }

    private record ChallanHeader(
            String driverName,
            String vehicleNumber,
            String address,
            LocalDateTime dispatchTime) {
    }
}
