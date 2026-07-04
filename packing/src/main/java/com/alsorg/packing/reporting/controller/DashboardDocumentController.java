package com.alsorg.packing.reporting.controller;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/reports/dashboard")
public class DashboardDocumentController {

    private final JdbcTemplate jdbc;

    private final String stickerStoragePath;

    public DashboardDocumentController(
            JdbcTemplate jdbc,
            @Value("${sticker.storage.path:./stickers}") String stickerStoragePath
    ) {
        this.jdbc = jdbc;
        this.stickerStoragePath = stickerStoragePath;
    }

    /*
     * =====================================================
     * PACKET STICKER PDF
     * =====================================================
     */

    @GetMapping("/packets/{packetId}/sticker/preview")
    public ResponseEntity<Resource> previewPacketSticker(
            @PathVariable UUID packetId
    ) {
        return servePacketSticker(
                packetId,
                false
        );
    }

    @GetMapping("/packets/{packetId}/sticker/download")
    public ResponseEntity<Resource> downloadPacketSticker(
            @PathVariable UUID packetId
    ) {
        return servePacketSticker(
                packetId,
                true
        );
    }

    private ResponseEntity<Resource> servePacketSticker(
            UUID packetId,
            boolean download
    ) {
        PacketStickerDocument doc =
                findPacketStickerDocument(packetId);

        Resource resource =
                doc.resource();

        String filename =
                doc.filename();

        ContentDisposition disposition =
                download
                        ? ContentDisposition
                                .attachment()
                                .filename(filename)
                                .build()
                        : ContentDisposition
                                .inline()
                                .filename(filename)
                                .build();

        return ResponseEntity
                .ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        disposition.toString()
                )
                .body(resource);
    }

    private PacketStickerDocument findPacketStickerDocument(
            UUID packetId
    ) {
        String stickerPath =
                jdbc.query("""
                    select sticker_path
                    from packets
                    where id = ?
                """, rs -> {
                    if (!rs.next()) {
                        return null;
                    }

                    return rs.getString("sticker_path");
                }, packetId);

        if (stickerPath != null && !stickerPath.trim().isBlank()) {
            Path path =
                    Path.of(stickerPath.trim());

            if (!path.isAbsolute()) {
                path =
                        Path.of(stickerStoragePath)
                                .resolve(stickerPath.trim())
                                .normalize();
            }

            if (Files.exists(path) && Files.isRegularFile(path)) {
                return new PacketStickerDocument(
                        new FileSystemResource(path),
                        cleanFileName(path.getFileName().toString())
                );
            }
        }

        /*
         * Fallback:
         * If packet.sticker_path is not filled, try latest sticker_history PDF
         * linked through packet_items.
         *
         * This works only if your pdf_data column is bytea.
         * If your pdf_data is PostgreSQL oid, keep sticker_path updated
         * during sticker generation.
         */
        byte[] bytes =
                jdbc.query("""
                    select sh.pdf_data
                    from sticker_history sh
                    join packet_items pi
                        on pi.id = sh.packet_item_id
                    where pi.packet_id = ?
                      and sh.pdf_data is not null
                    order by sh.generated_at desc nulls last
                    limit 1
                """, rs -> {
                    if (!rs.next()) {
                        return null;
                    }

                    try {
                        return rs.getBytes("pdf_data");
                    } catch (Exception e) {
                        return null;
                    }
                }, packetId);

        if (bytes != null && bytes.length > 0) {
            return new PacketStickerDocument(
                    new ByteArrayResource(bytes),
                    "packet-sticker-" + packetId + ".pdf"
            );
        }

        throw new ResponseStatusException(
                HttpStatus.NOT_FOUND,
                "Sticker PDF not found for packet " + packetId
        );
    }

    /*
     * =====================================================
     * CHALLAN PDF
     *
     * These endpoints are dashboard aliases.
     * They redirect to your existing challan PDF endpoint.
     *
     * Replace EXISTING_CHALLAN_ENDPOINT below with the endpoint
     * you already use in challanDownloadApi.js if different.
     * =====================================================
     */

    @GetMapping("/challans/{challanNumber}/preview")
    public ResponseEntity<Void> previewChallan(
            @PathVariable String challanNumber
    ) {
        String location =
                "/api/logistics/challans/"
                        + challanNumber
                        + "/pdf?mode=preview";

        return ResponseEntity
                .status(HttpStatus.FOUND)
                .header(HttpHeaders.LOCATION, location)
                .build();
    }

    @GetMapping("/challans/{challanNumber}/download")
    public ResponseEntity<Void> downloadChallan(
            @PathVariable String challanNumber
    ) {
        String location =
                "/api/logistics/challans/"
                        + challanNumber
                        + "/pdf?mode=download";

        return ResponseEntity
                .status(HttpStatus.FOUND)
                .header(HttpHeaders.LOCATION, location)
                .build();
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

    private record PacketStickerDocument(
            Resource resource,
            String filename
    ) {
    }
}