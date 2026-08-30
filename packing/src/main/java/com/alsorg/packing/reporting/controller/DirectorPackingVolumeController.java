package com.alsorg.packing.reporting.controller;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.alsorg.packing.domain.utl.UtlPacketRouting;
import com.alsorg.packing.reporting.dto.DirectorPackingVolumeRow;
import com.alsorg.packing.reporting.dto.PackingVolumeRow;
import com.alsorg.packing.reporting.service.PackingVolumeReportService;
import com.alsorg.packing.repository.UtlPacketRoutingRepository;

/**
 * Narrow, read-only Director reporting contract.
 *
 * This endpoint exists instead of exposing the broad /api/reports/** admin
 * surface to PACKFLOW_DIRECTOR. It returns only sanitized packet-volume rows
 * used by the Director Brief's Volume Intelligence and Packet Register.
 *
 * Important identity rules preserved here:
 * - physical plant routing is never changed;
 * - UTL-origin rows are displayed as "AL-P3 - UTL" / "WR-38 - UTL";
 * - WR-38 Product Code (PD No.) is the displayed SKU identity.
 *
 * Packer identity, routing target, client address and admin/audit metadata are
 * deliberately excluded from this Director contract.
 */
@RestController
@RequestMapping("/api/reports/director")
public class DirectorPackingVolumeController {

    private static final long MAX_RANGE_DAYS = 366L;

    private final PackingVolumeReportService volumeService;
    private final UtlPacketRoutingRepository routingRepository;

    public DirectorPackingVolumeController(
            PackingVolumeReportService volumeService,
            UtlPacketRoutingRepository routingRepository) {
        this.volumeService = volumeService;
        this.routingRepository = routingRepository;
    }

    @GetMapping("/packing-volume")
    @PreAuthorize("hasAnyAuthority('ADMIN','ROLE_ADMIN','PACKFLOW_DIRECTOR','ROLE_PACKFLOW_DIRECTOR')")
    public List<DirectorPackingVolumeRow> getPackingVolume(
            @RequestParam
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
            LocalDateTime from,

            @RequestParam
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
            LocalDateTime to) {

        validateRange(from, to);

        List<PackingVolumeRow> rows =
                volumeService.getPackingVolumeReport(from, to);

        Set<UUID> packetItemIds = new LinkedHashSet<>();

        for (PackingVolumeRow row : rows) {
            if (row != null && row.packetItemId() != null) {
                packetItemIds.add(row.packetItemId());
            }
        }

        Map<UUID, UtlPacketRouting> routingByPacketItem =
                new LinkedHashMap<>();

        if (!packetItemIds.isEmpty()) {
            for (UtlPacketRouting routing :
                    routingRepository.findByPacketItemIdIn(packetItemIds)) {

                if (routing != null && routing.getPacketItemId() != null) {
                    routingByPacketItem.put(
                            routing.getPacketItemId(),
                            routing);
                }
            }
        }

        return rows.stream()
                .map(row -> sanitize(
                        row,
                        row == null || row.packetItemId() == null
                                ? null
                                : routingByPacketItem.get(row.packetItemId())))
                .toList();
    }

    private void validateRange(
            LocalDateTime from,
            LocalDateTime to) {

        if (from == null || to == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Both from and to are required");
        }

        if (from.isAfter(to)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "from must be before or equal to to");
        }

        long days = Duration.between(from, to).toDays();

        if (days > MAX_RANGE_DAYS) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Director volume range cannot exceed 366 days");
        }
    }

    private DirectorPackingVolumeRow sanitize(
            PackingVolumeRow row,
            UtlPacketRouting routing) {

        if (row == null) {
            return null;
        }

        String physicalPlant = clean(row.plantCode());
        String displayPlant = physicalPlant;

        if (routing != null) {
            String sourcePlant = clean(routing.getSourcePlantCode());

            if (sourcePlant == null) {
                sourcePlant = physicalPlant;
            }

            if (sourcePlant != null) {
                physicalPlant = sourcePlant;
                displayPlant = sourcePlant + " - UTL";
            }
        }

        String displaySku = row.sku();

        if ("WR-38".equalsIgnoreCase(clean(physicalPlant))) {
            String productCode = clean(row.pdNo());

            if (productCode != null) {
                displaySku = productCode;
            }
        }

        return new DirectorPackingVolumeRow(
                row.packetItemId(),
                row.zohoItemId(),
                row.pdNo(),
                row.drawingNo(),
                displaySku,
                row.itemName(),
                row.description(),
                row.clientName(),
                displayPlant,
                row.floor(),
                row.packetNumber(),
                row.quantity(),
                row.dimensions(),
                row.volumeCbm(),
                row.packedAt(),
                row.status(),
                row.stickerNumber());
    }

    private String clean(String value) {
        if (value == null) {
            return null;
        }

        String clean = value.trim();
        return clean.isBlank() ? null : clean;
    }
}
