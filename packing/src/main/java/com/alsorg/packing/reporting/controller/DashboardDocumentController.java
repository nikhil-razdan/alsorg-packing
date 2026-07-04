package com.alsorg.packing.reporting.controller;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import com.alsorg.packing.domain.sticker.StickerHistory;
import com.alsorg.packing.repository.StickerHistoryRepository;
import com.alsorg.packing.service.pdf.ChalaanItem;
import com.alsorg.packing.service.pdf.ChalaanPdfData;
import com.alsorg.packing.service.pdf.ChalaanPdfService;

@RestController
@RequestMapping("/api/reports/dashboard")
public class DashboardDocumentController {

    private final StickerHistoryRepository stickerHistoryRepository;
    private final JdbcTemplate jdbc;
    private final ChalaanPdfService chalaanPdfService;

    public DashboardDocumentController(
            StickerHistoryRepository stickerHistoryRepository,
            JdbcTemplate jdbc,
            ChalaanPdfService chalaanPdfService
    ) {
        this.stickerHistoryRepository = stickerHistoryRepository;
        this.jdbc = jdbc;
        this.chalaanPdfService = chalaanPdfService;
    }

    /*
     * =====================================================
     * STICKER PDF
     * Correct source:
     * sticker_history.pdf_data by packet_item_id
     * =====================================================
     */

    @GetMapping("/packet-items/{packetItemId}/sticker/preview")
    public ResponseEntity<Resource> previewSticker(
            @PathVariable UUID packetItemId
    ) {
        return serveSticker(
                packetItemId,
                false
        );
    }

    @GetMapping("/packet-items/{packetItemId}/sticker/download")
    public ResponseEntity<Resource> downloadSticker(
            @PathVariable UUID packetItemId
    ) {
        return serveSticker(
                packetItemId,
                true
        );
    }

    private ResponseEntity<Resource> serveSticker(
            UUID packetItemId,
            boolean download
    ) {
        List<StickerHistory> history =
                stickerHistoryRepository
                        .findByPacketItem_IdOrderByGeneratedAtDesc(
                                packetItemId
                        );

        StickerHistory selected =
                history.stream()
                        .filter(h ->
                                h.getPdfData() != null
                                        && h.getPdfData().length > 100
                        )
                        .findFirst()
                        .orElseThrow(() ->
                                new ResponseStatusException(
                                        HttpStatus.NOT_FOUND,
                                        "Sticker PDF not found for packet item " + packetItemId
                                )
                        );

        String stickerNumber =
                selected.getStickerNumber() == null
                        || selected.getStickerNumber().isBlank()
                                ? packetItemId.toString()
                                : selected.getStickerNumber();

        String filename =
                cleanFileName(
                        "Sticker_"
                                + stickerNumber
                                + ".pdf"
                );

        return pdfResponse(
                selected.getPdfData(),
                filename,
                download
        );
    }

    /*
     * =====================================================
     * CHALLAN PDF
     * Correct source:
     * dispatched_items by chalaan_number
     * PDF generated through existing ChalaanPdfService.
     * =====================================================
     */

    @GetMapping("/challan/preview")
    public ResponseEntity<Resource> previewChallan(
            @RequestParam String challanNumber
    ) {
        return serveChallan(
                challanNumber,
                false
        );
    }

    @GetMapping("/challan/download")
    public ResponseEntity<Resource> downloadChallan(
            @RequestParam String challanNumber
    ) {
        return serveChallan(
                challanNumber,
                true
        );
    }

    private ResponseEntity<Resource> serveChallan(
            String challanNumber,
            boolean download
    ) {
        if (challanNumber == null || challanNumber.trim().isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Challan number missing"
            );
        }

        String cleanChallan =
                challanNumber.trim();

        List<ChalaanItem> items =
                jdbc.query(
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
                            order by d.name asc nulls last
                        """,
                        (rs, rowNum) -> {
                            ChalaanItem item =
                                    new ChalaanItem();

                            item.setItemName(rs.getString("name"));
                            item.setPdNo(rs.getString("pd_no"));
                            item.setDrawingNo(rs.getString("drawing_no"));
                            item.setDescription(rs.getString("description"));
                            item.setRemarks(rs.getString("remarks"));
                            item.setClientName(rs.getString("client_name"));
                            item.setClientAddress(rs.getString("client_address"));

                            return item;
                        },
                        cleanChallan
                );

        if (items.isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "No dispatched items found for challan " + cleanChallan
            );
        }

        ChallanHeader header =
                jdbc.query(
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

                            return new ChallanHeader(
                                    rs.getString("driver_name"),
                                    rs.getString("vehicle_number"),
                                    rs.getString("address"),
                                    rs.getTimestamp("dispatch_time") == null
                                            ? null
                                            : rs.getTimestamp("dispatch_time")
                                                    .toLocalDateTime()
                            );
                        },
                        cleanChallan
                );

        ChalaanPdfData data =
                new ChalaanPdfData();

        data.setVoucherNo(cleanChallan);
        data.setItems(items);

        if (header != null) {
            data.setDriverName(header.driverName());
            data.setVehicleNumber(header.vehicleNumber());
            data.setAddress(header.address());
            data.setDispatchTime(header.dispatchTime());
        }

        byte[] pdf =
                chalaanPdfService.generateChalaan(
                        data
                );

        String filename =
                cleanFileName(
                        "Challan_"
                                + cleanChallan
                                + ".pdf"
                );

        return pdfResponse(
                pdf,
                filename,
                download
        );
    }

    private ResponseEntity<Resource> pdfResponse(
            byte[] pdf,
            String filename,
            boolean download
    ) {
        if (pdf == null || pdf.length == 0) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "PDF not found"
            );
        }

        ContentDisposition disposition =
                download
                        ? ContentDisposition
                                .attachment()
                                .filename(
                                        filename,
                                        StandardCharsets.UTF_8
                                )
                                .build()
                        : ContentDisposition
                                .inline()
                                .filename(
                                        filename,
                                        StandardCharsets.UTF_8
                                )
                                .build();

        return ResponseEntity
                .ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        disposition.toString()
                )
                .body(
                        new ByteArrayResource(pdf)
                );
    }

    private String cleanFileName(
            String value
    ) {
        String text =
                value == null || value.trim().isBlank()
                        ? "document.pdf"
                        : value.trim();

        return text.replaceAll("[\\\\/:*?\"<>|]", "_");
    }

    private record ChallanHeader(
            String driverName,
            String vehicleNumber,
            String address,
            LocalDateTime dispatchTime
    ) {
    }
}