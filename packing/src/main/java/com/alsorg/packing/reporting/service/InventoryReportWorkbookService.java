package com.alsorg.packing.reporting.service;

import java.io.ByteArrayOutputStream;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;

import com.alsorg.packing.reporting.dto.DashboardStatsDTO;
import com.alsorg.packing.reporting.dto.DispatchReportRow;
import com.alsorg.packing.reporting.dto.InventoryAgingRow;
import com.alsorg.packing.reporting.dto.PackingReportRow;
import com.alsorg.packing.reporting.dto.PackingVolumeRow;

@Service
public class InventoryReportWorkbookService {

        private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("dd MMM yyyy");

        private static final DateTimeFormatter DATE_TIME_FORMAT = DateTimeFormatter.ofPattern("dd MMM yyyy HH:mm");

        private final DashboardReportService dashboardService;
        private final PackingReportService packingService;
        private final DispatchReportService dispatchService;
        private final InventoryAgingReportService agingService;
        private final PackingVolumeReportService packingVolumeService;
        private final DimensionVolumeCalculator volumeCalculator;

        public InventoryReportWorkbookService(
                        DashboardReportService dashboardService,
                        PackingReportService packingService,
                        DispatchReportService dispatchService,
                        InventoryAgingReportService agingService,
                        PackingVolumeReportService packingVolumeService,
                        DimensionVolumeCalculator volumeCalculator) {
                this.dashboardService = dashboardService;
                this.packingService = packingService;
                this.dispatchService = dispatchService;
                this.agingService = agingService;
                this.packingVolumeService = packingVolumeService;
                this.volumeCalculator = volumeCalculator;
        }

        private static final String[] ITEM_PACKET_HEADERS = {
                        "Module",
                        "Zoho Item ID",
                        "Item Name",
                        "Client",
                        "Packet No",
                        "Packet Name",
                        "Status",
                        "Action At",
                        "Action By",
                        "Dimensions",
                        "Volume (m³)",
                        "Age Days"
        };

        private static final String[] DISPATCH_REGISTER_HEADERS = {
                        "S.No.",
                        "Zoho Item ID",
                        "PD No.",
                        "Dwg No.",
                        "SKU / Code",
                        "Item Name",
                        "Description",
                        "Client",
                        "Client Address",
                        "Plant",
                        "Floor",
                        "Area",
                        "Warehouse",
                        "Pkt No.",
                        "Packet Name",
                        "Qty",
                        "Dimensions",
                        "Volume (m³)",
                        "Status",
                        "Packing Date",
                        "Packed By",
                        "Dispatch Date",
                        "Dispatched By",
                        "Challan No.",
                        "Driver",
                        "Vehicle",
                        "Remarks"
        };

        private List<Object> row(
                        Object... values) {
                return new ArrayList<>(
                                Arrays.asList(values));
        }

        public byte[] exportInventoryReport(
                        String reportType,
                        LocalDateTime from,
                        LocalDateTime to) {
                String type = normalizeType(reportType);

                boolean includePacking = "inventory".equals(type)
                                || "combined".equals(type)
                                || "packing".equals(type);

                boolean includeDispatch = "inventory".equals(type)
                                || "combined".equals(type)
                                || "dispatch".equals(type);

                boolean includeAging = "inventory".equals(type)
                                || "combined".equals(type);

                DashboardStatsDTO stats = dashboardService.getDashboardStats();

                List<PackingReportRow> packingRows = includePacking
                                ? packingService.getPackingReport(from, to)
                                : List.of();

                List<DispatchReportRow> dispatchRows = includeDispatch
                                ? dispatchService.getDispatchReport(from, to)
                                : List.of();

                List<InventoryAgingRow> agingRows = includeAging
                                ? agingService.getInventoryAgingReport()
                                : List.of();

                /*
                 * Dimensions/volume come directly from packet_items, which is the
                 * same authoritative source used by packing/sticker generation.
                 * No schema change is required.
                 */
                List<PackingVolumeRow> packingVolumeRows = includePacking
                                ? packingVolumeService.getPackingVolumeReport(from, to)
                                : List.of();

                Map<String, PackingVolumeRow> volumeLookup = buildVolumeLookup(
                                packingVolumeRows);

                try (
                                Workbook workbook = new XSSFWorkbook();
                                ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                        CellStyle titleStyle = titleStyle(workbook);
                        CellStyle headerStyle = headerStyle(workbook);
                        CellStyle dataStyle = dataStyle(workbook);
                        CellStyle warningStyle = warningStyle(workbook);

                        KpiData kpis = buildKpis(
                                        stats,
                                        packingRows,
                                        dispatchRows,
                                        agingRows,
                                        packingVolumeRows);

                        List<List<Object>> dateWiseRows = buildDateWiseRows(
                                        packingRows,
                                        dispatchRows,
                                        packingVolumeRows);

                        List<List<Object>> packingUserRows = buildPackingUserRows(
                                        packingRows,
                                        packingVolumeRows);

                        List<List<Object>> dispatchUserRows = buildDispatchUserRows(
                                        dispatchRows);

                        List<List<Object>> clientRows = buildClientRows(
                                        packingRows,
                                        dispatchRows,
                                        packingVolumeRows);

                        List<List<Object>> plantRows = buildPlantRows(
                                        packingVolumeRows);

                        List<List<Object>> agingBucketRows = buildAgingBucketRows(
                                        agingRows);

                        List<List<Object>> packingItemPacketRows = buildPackingItemPacketRows(
                                        packingRows,
                                        volumeLookup);

                        List<List<Object>> dispatchItemPacketRows = buildDispatchItemPacketRows(
                                        dispatchRows,
                                        volumeLookup);

                        List<List<Object>> dispatchRegisterRows = buildDispatchRegisterRows(
                                        dispatchRows,
                                        volumeLookup);

                        List<List<Object>> inventoryItemPacketRows = buildInventoryItemPacketRows(
                                        agingRows);

                        List<List<Object>> allItemPacketRows = new ArrayList<>();

                        allItemPacketRows.addAll(
                                        inventoryItemPacketRows);

                        allItemPacketRows.addAll(
                                        packingItemPacketRows);

                        allItemPacketRows.addAll(
                                        dispatchItemPacketRows);

                        if (includePacking) {
                                addPackingVolumeExecutiveSheet(
                                                workbook,
                                                from,
                                                to,
                                                kpis,
                                                packingUserRows,
                                                dateWiseRows);
                        }

                        addRowsSheet(
                                        workbook,
                                        "KPI Summary",
                                        "Inventory KPI Summary",
                                        new String[] {
                                                        "KPI",
                                                        "Value",
                                                        "Insight"
                                        },
                                        buildKpiRows(kpis),
                                        titleStyle,
                                        headerStyle,
                                        dataStyle,
                                        warningStyle,
                                        -1);

                        addRowsSheet(
                                        workbook,
                                        "Date Wise",
                                        "Date-wise Inventory Throughput",
                                        new String[] {
                                                        "Date",
                                                        "Packed",
                                                        "Packed Volume (m³)",
                                                        "Avg m³ / Packed Packet",
                                                        "Dispatched",
                                                        "Total Movements"
                                        },
                                        dateWiseRows,
                                        titleStyle,
                                        headerStyle,
                                        dataStyle,
                                        warningStyle,
                                        -1);

                        if (includePacking) {
                                addRowsSheet(
                                                workbook,
                                                "Packing User Wise",
                                                "Packing User-wise Report",
                                                new String[] {
                                                                "User",
                                                                "Packets Packed",
                                                                "Packed Volume (m³)",
                                                                "Avg m³ / Packet",
                                                                "Clients",
                                                                "Packet Share",
                                                                "Volume Share",
                                                                "Dimension Coverage"
                                                },
                                                packingUserRows,
                                                titleStyle,
                                                headerStyle,
                                                dataStyle,
                                                warningStyle,
                                                -1);

                                addRowsSheet(
                                                workbook,
                                                "Raw Packing",
                                                "Raw Packing Data",
                                                new String[] {
                                                                "Zoho Item ID",
                                                                "Item Name",
                                                                "Client",
                                                                "Plant",
                                                                "Packet No",
                                                                "Dimensions",
                                                                "Volume (m³)",
                                                                "Packed At",
                                                                "Packed By"
                                                },
                                                buildRawPackingRows(packingRows, volumeLookup),
                                                titleStyle,
                                                headerStyle,
                                                dataStyle,
                                                warningStyle,
                                                -1);

                                addRowsSheet(
                                                workbook,
                                                "Packing Volume Detail",
                                                "Packet-wise Packing Volume Register",
                                                new String[] {
                                                                "S.No.",
                                                                "Packing Date",
                                                                "Packed By",
                                                                "Plant",
                                                                "Client",
                                                                "PD No.",
                                                                "Dwg No.",
                                                                "Item Name",
                                                                "Pkt No.",
                                                                "Dimensions (inches)",
                                                                "Volume (m³)",
                                                                "Status"
                                                },
                                                buildPackingVolumeDetailRows(packingVolumeRows),
                                                titleStyle,
                                                headerStyle,
                                                dataStyle,
                                                warningStyle,
                                                -1);

                                addRowsSheet(
                                                workbook,
                                                "Packing Item Packets",
                                                "Packing Item / Packet Detail",
                                                ITEM_PACKET_HEADERS,
                                                packingItemPacketRows,
                                                titleStyle,
                                                headerStyle,
                                                dataStyle,
                                                warningStyle,
                                                -1);
                        }

                        if (includeDispatch) {

                                addRowsSheet(
                                                workbook,
                                                "Dispatch Register",
                                                "Detailed Dispatch Item Register",
                                                DISPATCH_REGISTER_HEADERS,
                                                dispatchRegisterRows,
                                                titleStyle,
                                                headerStyle,
                                                dataStyle,
                                                warningStyle,
                                                -1);

                                addRowsSheet(
                                                workbook,
                                                "Dispatch User Wise",
                                                "Dispatch User-wise Report",
                                                new String[] {
                                                                "User",
                                                                "Dispatched",
                                                                "Clients"
                                                },
                                                dispatchUserRows,
                                                titleStyle,
                                                headerStyle,
                                                dataStyle,
                                                warningStyle,
                                                -1);

                                addRowsSheet(
                                                workbook,
                                                "Raw Dispatch",
                                                "Raw Dispatch Data",
                                                new String[] {
                                                                "Zoho Item ID",
                                                                "PD No.",
                                                                "Dwg No.",
                                                                "Item Name",
                                                                "Client",
                                                                "Area",
                                                                "Pkt No.",
                                                                "Dimensions",
                                                                "Packed Volume (m³)",
                                                                "Packing Date",
                                                                "Dispatch Date",
                                                                "Dispatched By",
                                                                "Challan No."
                                                },
                                                buildRawDispatchRows(dispatchRows, volumeLookup),
                                                titleStyle,
                                                headerStyle,
                                                dataStyle,
                                                warningStyle,
                                                -1);

                                addRowsSheet(
                                                workbook,
                                                "Dispatch Item Packets",
                                                "Dispatch Item / Packet Detail",
                                                ITEM_PACKET_HEADERS,
                                                dispatchItemPacketRows,
                                                titleStyle,
                                                headerStyle,
                                                dataStyle,
                                                warningStyle,
                                                -1);
                        }

                        if ("inventory".equals(type)
                                        || "combined".equals(type)) {
                                addRowsSheet(
                                                workbook,
                                                "Client Wise",
                                                "Client-wise Inventory Movement",
                                                new String[] {
                                                                "Client",
                                                                "Packed",
                                                                "Packed Volume (m³)",
                                                                "Avg m³ / Packet",
                                                                "Dispatched",
                                                                "Total Movements"
                                                },
                                                clientRows,
                                                titleStyle,
                                                headerStyle,
                                                dataStyle,
                                                warningStyle,
                                                -1);

                                addRowsSheet(
                                                workbook,
                                                "Plant Wise",
                                                "Plant-wise Packing Volume Performance",
                                                new String[] {
                                                                "Plant",
                                                                "Packets Packed",
                                                                "Packed Volume (m³)",
                                                                "Avg m³ / Packet",
                                                                "Clients",
                                                                "Volume Share"
                                                },
                                                plantRows,
                                                titleStyle,
                                                headerStyle,
                                                dataStyle,
                                                warningStyle,
                                                -1);

                                addRowsSheet(
                                                workbook,
                                                "Inventory Aging",
                                                "Inventory Aging Bucket Report",
                                                new String[] {
                                                                "Bucket",
                                                                "Items"
                                                },
                                                agingBucketRows,
                                                titleStyle,
                                                headerStyle,
                                                dataStyle,
                                                warningStyle,
                                                2);

                                if ("inventory".equals(type)
                                                || "combined".equals(type)) {
                                        addRowsSheet(
                                                        workbook,
                                                        "All Item Packets",
                                                        "All Item / Packet Detail",
                                                        ITEM_PACKET_HEADERS,
                                                        allItemPacketRows,
                                                        titleStyle,
                                                        headerStyle,
                                                        dataStyle,
                                                        warningStyle,
                                                        -1);

                                        addRowsSheet(
                                                        workbook,
                                                        "Inventory Item Packets",
                                                        "Inventory Item / Packet Detail",
                                                        ITEM_PACKET_HEADERS,
                                                        inventoryItemPacketRows,
                                                        titleStyle,
                                                        headerStyle,
                                                        dataStyle,
                                                        warningStyle,
                                                        12);
                                }

                                addRowsSheet(
                                                workbook,
                                                "Raw Aging",
                                                "Raw Inventory Aging Data",
                                                new String[] {
                                                                "Zoho Item ID",
                                                                "Item Name",
                                                                "Client",
                                                                "Status",
                                                                "Created / Received At",
                                                                "Age Days",
                                                                "Bucket"
                                                },
                                                buildRawAgingRows(agingRows),
                                                titleStyle,
                                                headerStyle,
                                                dataStyle,
                                                warningStyle,
                                                6);
                        }

                        addRowsSheet(
                                        workbook,
                                        "Insights",
                                        "Inventory Insights",
                                        new String[] {
                                                        "Insight",
                                                        "Value",
                                                        "Recommendation"
                                        },
                                        buildInsightRows(
                                                        kpis,
                                                        packingUserRows,
                                                        dispatchUserRows,
                                                        dateWiseRows,
                                                        agingBucketRows,
                                                        allItemPacketRows,
                                                        packingItemPacketRows,
                                                        dispatchItemPacketRows),
                                        titleStyle,
                                        headerStyle,
                                        dataStyle,
                                        warningStyle,
                                        -1);

                        workbook.write(out);

                        return out.toByteArray();

                } catch (Exception e) {
                        throw new RuntimeException(
                                        "Professional inventory Excel export failed",
                                        e);
                }
        }

        private String normalizeType(String type) {
                if (type == null || type.isBlank()) {
                        return "inventory";
                }

                String value = type.trim().toLowerCase();

                if ("combined".equals(value)) {
                        return "inventory";
                }

                if ("packing".equals(value)
                                || "dispatch".equals(value)
                                || "inventory".equals(value)) {
                        return value;
                }

                return "inventory";
        }

        private KpiData buildKpis(
                        DashboardStatsDTO stats,
                        List<PackingReportRow> packingRows,
                        List<DispatchReportRow> dispatchRows,
                        List<InventoryAgingRow> agingRows,
                        List<PackingVolumeRow> volumeRows) {
                KpiData kpis = new KpiData();

                kpis.totalInventory = number(stats, "totalItems");
                kpis.warehouseItems = number(stats, "warehouseItems");
                kpis.readyToDispatch = number(stats, "readyToDispatchItems");
                kpis.readyItems = number(stats, "readyItems");
                kpis.packedItems = number(stats, "packedItems");
                kpis.dispatchedItems = number(stats, "dispatchedItems");
                kpis.pendingItems = number(stats, "pendingItems");

                if (kpis.pendingItems == 0) {
                        kpis.pendingItems = Math.max(
                                        kpis.totalInventory
                                                        - kpis.packedItems
                                                        - kpis.dispatchedItems,
                                        0);
                }

                kpis.stickersGenerated = number(stats, "stickersGenerated");
                kpis.packedInRange = packingRows.size();
                kpis.dispatchedInRange = dispatchRows.size();
                kpis.agingItems = agingRows.size();
                kpis.criticalAging = agingRows.stream()
                                .filter(row -> getAgeDays(row) > 30)
                                .count();

                Set<String> clients = new HashSet<>();

                for (PackingReportRow row : packingRows) {
                        String client = text(row, "clientName", "client");
                        if (!"-".equals(client) && !client.isBlank()) {
                                clients.add(client);
                        }
                }

                for (DispatchReportRow row : dispatchRows) {
                        String client = text(row, "clientName", "client");
                        if (!"-".equals(client) && !client.isBlank()) {
                                clients.add(client);
                        }
                }

                kpis.uniqueClients = clients.size();
                kpis.completionRate = kpis.totalInventory == 0
                                ? 0
                                : (double) kpis.dispatchedItems / kpis.totalInventory;

                Map<String, Double> userVolume = new HashMap<>();
                Map<String, Double> dateVolume = new HashMap<>();

                for (PackingVolumeRow row : volumeRows) {
                        if (row.volumeCbm() == null) {
                                continue;
                        }

                        double cbm = row.volumeCbm();
                        kpis.packedVolumeCbm += cbm;
                        kpis.volumeKnownPackets++;

                        String user = safeLabel(row.packedBy(), "SYSTEM");
                        userVolume.merge(user, cbm, Double::sum);

                        String date = row.packedAt() == null
                                        ? "-"
                                        : row.packedAt().format(DATE_FORMAT);
                        dateVolume.merge(date, cbm, Double::sum);
                }

                long volumePopulation = Math.max(
                                kpis.packedInRange,
                                volumeRows.size());

                kpis.volumeMissingPackets = Math.max(
                                volumePopulation - kpis.volumeKnownPackets,
                                0);

                kpis.averageVolumeCbm = kpis.volumeKnownPackets == 0
                                ? 0d
                                : kpis.packedVolumeCbm / kpis.volumeKnownPackets;

                kpis.dimensionCoverage = volumePopulation == 0
                                ? 0d
                                : Math.min(
                                                1d,
                                                (double) kpis.volumeKnownPackets / volumePopulation);

                userVolume.entrySet().stream()
                                .max(Map.Entry.comparingByValue())
                                .ifPresent(entry -> {
                                        kpis.topVolumePacker = entry.getKey();
                                        kpis.topVolumePackerCbm = entry.getValue();
                                });

                dateVolume.entrySet().stream()
                                .max(Map.Entry.comparingByValue())
                                .ifPresent(entry -> {
                                        kpis.peakVolumeDate = entry.getKey();
                                        kpis.peakVolumeDateCbm = entry.getValue();
                                });

                kpis.packedVolumeCbm = round3(kpis.packedVolumeCbm);
                kpis.averageVolumeCbm = round3(kpis.averageVolumeCbm);
                kpis.topVolumePackerCbm = round3(kpis.topVolumePackerCbm);
                kpis.peakVolumeDateCbm = round3(kpis.peakVolumeDateCbm);

                return kpis;
        }

        private List<List<Object>> buildKpiRows(
                        KpiData kpis) {
                return List.of(
                                row(
                                                "Inventory Items",
                                                kpis.totalInventory,
                                                "Warehouse + Ready To Dispatch + Ready"),
                                row(
                                                "Warehouse Items",
                                                kpis.warehouseItems,
                                                "Current warehouse stock"),
                                row(
                                                "Ready To Dispatch",
                                                kpis.readyToDispatch,
                                                "Items waiting for dispatch"),
                                row(
                                                "Ready Items",
                                                kpis.readyItems,
                                                "Ready / processed stock"),
                                row(
                                                "Packed Items",
                                                kpis.packedItems,
                                                "Sticker generated / packed stock"),
                                row(
                                                "Packed Volume in Selected Range (m³)",
                                                kpis.packedVolumeCbm,
                                                "Sum of packet L x B x H cubic metres for the selected packing period"),
                                row(
                                                "Average Volume / Measured Packet (m³)",
                                                kpis.averageVolumeCbm,
                                                "Average physical cube for packets with valid dimensions"),
                                row(
                                                "Dimension Coverage",
                                                percent1(kpis.dimensionCoverage),
                                                kpis.volumeMissingPackets == 0
                                                                ? "All packed rows in the selected range have usable dimensions"
                                                                : kpis.volumeMissingPackets + " packed rows need dimension correction / completion"),
                                row(
                                                "Top Packer by Volume",
                                                safeLabel(kpis.topVolumePacker, "-"),
                                                round3(kpis.topVolumePackerCbm) + " m³ packed"),
                                row(
                                                "Peak Packing Volume Date",
                                                safeLabel(kpis.peakVolumeDate, "-"),
                                                round3(kpis.peakVolumeDateCbm) + " m³ packed"),
                                row(
                                                "Dispatched Items",
                                                kpis.dispatchedItems,
                                                "Challan generated / dispatched stock"),
                                row(
                                                "Pending Items",
                                                kpis.pendingItems,
                                                "Items still pending in flow"),
                                row(
                                                "Stickers Generated",
                                                kpis.stickersGenerated,
                                                "Total labels printed"),
                                row(
                                                "Packing In Selected Range",
                                                kpis.packedInRange,
                                                "Date-filtered packing activity"),
                                row(
                                                "Dispatch In Selected Range",
                                                kpis.dispatchedInRange,
                                                "Date-filtered dispatch activity"),
                                row(
                                                "Unique Clients",
                                                kpis.uniqueClients,
                                                "Clients involved in selected range"),
                                row(
                                                "Critical Aging Items",
                                                kpis.criticalAging,
                                                "Inventory older than 30 days"),
                                row(
                                                "Dispatch Completion Rate",
                                                percent(kpis.completionRate),
                                                "Dispatched items divided by total inventory"));
        }

        private List<List<Object>> buildDateWiseRows(
                        List<PackingReportRow> packingRows,
                        List<DispatchReportRow> dispatchRows,
                        List<PackingVolumeRow> volumeRows) {
                Map<String, CountRow> map = new HashMap<>();

                for (PackingReportRow row : packingRows) {
                        LocalDateTime date = dateTime(row, "packedAt", "date");
                        String key = dateKey(date);
                        String label = dateLabel(date);

                        CountRow current = map.computeIfAbsent(
                                        key,
                                        k -> new CountRow(label));

                        current.packed++;
                        current.total++;
                }

                for (DispatchReportRow row : dispatchRows) {
                        LocalDateTime date = dateTime(row, "dispatchedAt", "date");
                        String key = dateKey(date);
                        String label = dateLabel(date);

                        CountRow current = map.computeIfAbsent(
                                        key,
                                        k -> new CountRow(label));

                        current.dispatched++;
                        current.total++;
                }

                for (PackingVolumeRow row : volumeRows) {
                        LocalDateTime date = row.packedAt();
                        String key = dateKey(date);
                        String label = dateLabel(date);

                        CountRow current = map.computeIfAbsent(
                                        key,
                                        k -> new CountRow(label));

                        if (row.volumeCbm() != null) {
                                current.packedVolumeCbm += row.volumeCbm();
                                current.volumeKnown++;
                        }
                }

                return map.entrySet()
                                .stream()
                                .sorted((a, b) -> b.getKey().compareTo(a.getKey()))
                                .map(entry -> {
                                        CountRow value = entry.getValue();
                                        double average = value.volumeKnown == 0
                                                        ? 0d
                                                        : value.packedVolumeCbm / value.volumeKnown;

                                        return row(
                                                        value.label,
                                                        value.packed,
                                                        round3(value.packedVolumeCbm),
                                                        round3(average),
                                                        value.dispatched,
                                                        value.total);
                                })
                                .toList();
        }

        private List<List<Object>> buildPackingUserRows(
                        List<PackingReportRow> rows,
                        List<PackingVolumeRow> volumeRows) {
                Map<String, UserCountRow> map = new HashMap<>();

                for (PackingReportRow row : rows) {
                        String user = text(row, "packedBy", "createdBy");
                        UserCountRow current = map.computeIfAbsent(user, UserCountRow::new);

                        current.count++;

                        String client = text(row, "clientName", "client");
                        if (!"-".equals(client) && !client.isBlank()) {
                                current.clients.add(client);
                        }
                }

                for (PackingVolumeRow row : volumeRows) {
                        String user = safeLabel(row.packedBy(), "SYSTEM");
                        UserCountRow current = map.computeIfAbsent(user, UserCountRow::new);

                        String client = safeLabel(row.clientName(), "-");
                        if (!"-".equals(client)) {
                                current.clients.add(client);
                        }

                        if (row.volumeCbm() != null) {
                                current.volumeCbm += row.volumeCbm();
                                current.volumeKnown++;
                        }
                }

                long totalPackets = map.values().stream()
                                .mapToLong(value -> value.count)
                                .sum();

                double totalVolume = map.values().stream()
                                .mapToDouble(value -> value.volumeCbm)
                                .sum();

                return map.values()
                                .stream()
                                .sorted((a, b) -> {
                                        int volumeCompare = Double.compare(b.volumeCbm, a.volumeCbm);
                                        return volumeCompare != 0
                                                        ? volumeCompare
                                                        : Long.compare(b.count, a.count);
                                })
                                .map(value -> row(
                                                value.user,
                                                value.count,
                                                round3(value.volumeCbm),
                                                round3(value.volumeKnown == 0
                                                                ? 0d
                                                                : value.volumeCbm / value.volumeKnown),
                                                value.clients.size(),
                                                percent1(totalPackets == 0
                                                                ? 0d
                                                                : (double) value.count / totalPackets),
                                                percent1(totalVolume <= 0d
                                                                ? 0d
                                                                : value.volumeCbm / totalVolume),
                                                percent1(value.count == 0
                                                                ? 0d
                                                                : (double) value.volumeKnown / value.count)))
                                .toList();
        }

        private List<List<Object>> buildDispatchUserRows(
                        List<DispatchReportRow> rows) {
                Map<String, UserCountRow> map = new HashMap<>();

                for (DispatchReportRow row : rows) {
                        String user = text(row, "dispatchedBy", "createdBy");

                        UserCountRow current = map.computeIfAbsent(
                                        user,
                                        UserCountRow::new);

                        current.count++;
                        current.clients.add(
                                        text(row, "clientName", "client"));
                }

                return map.values()
                                .stream()
                                .sorted((a, b) -> Long.compare(b.count, a.count))
                                .map(row -> row(
                                                row.user,
                                                row.count,
                                                row.clients.size()))
                                .toList();
        }

        private List<List<Object>> buildClientRows(
                        List<PackingReportRow> packingRows,
                        List<DispatchReportRow> dispatchRows,
                        List<PackingVolumeRow> volumeRows) {
                Map<String, CountRow> map = new HashMap<>();

                for (PackingReportRow row : packingRows) {
                        String client = text(row, "clientName", "client");
                        CountRow current = map.computeIfAbsent(client, CountRow::new);
                        current.packed++;
                        current.total++;
                }

                for (DispatchReportRow row : dispatchRows) {
                        String client = text(row, "clientName", "client");
                        CountRow current = map.computeIfAbsent(client, CountRow::new);
                        current.dispatched++;
                        current.total++;
                }

                for (PackingVolumeRow row : volumeRows) {
                        String client = safeLabel(row.clientName(), "-");
                        CountRow current = map.computeIfAbsent(client, CountRow::new);

                        if (row.volumeCbm() != null) {
                                current.packedVolumeCbm += row.volumeCbm();
                                current.volumeKnown++;
                        }
                }

                return map.values()
                                .stream()
                                .sorted((a, b) -> {
                                        int volumeCompare = Double.compare(
                                                        b.packedVolumeCbm,
                                                        a.packedVolumeCbm);
                                        return volumeCompare != 0
                                                        ? volumeCompare
                                                        : Long.compare(b.total, a.total);
                                })
                                .map(value -> row(
                                                value.label,
                                                value.packed,
                                                round3(value.packedVolumeCbm),
                                                round3(value.volumeKnown == 0
                                                                ? 0d
                                                                : value.packedVolumeCbm / value.volumeKnown),
                                                value.dispatched,
                                                value.total))
                                .toList();
        }

        private List<List<Object>> buildPlantRows(
                        List<PackingVolumeRow> volumeRows) {
                Map<String, UserCountRow> map = new HashMap<>();

                for (PackingVolumeRow row : volumeRows) {
                        String plant = safeLabel(row.plantCode(), "UNASSIGNED");
                        UserCountRow current = map.computeIfAbsent(plant, UserCountRow::new);

                        current.count++;

                        String client = safeLabel(row.clientName(), "-");
                        if (!"-".equals(client)) {
                                current.clients.add(client);
                        }

                        if (row.volumeCbm() != null) {
                                current.volumeCbm += row.volumeCbm();
                                current.volumeKnown++;
                        }
                }

                double totalVolume = map.values().stream()
                                .mapToDouble(value -> value.volumeCbm)
                                .sum();

                return map.values().stream()
                                .sorted((a, b) -> Double.compare(b.volumeCbm, a.volumeCbm))
                                .map(value -> row(
                                                value.user,
                                                value.count,
                                                round3(value.volumeCbm),
                                                round3(value.volumeKnown == 0
                                                                ? 0d
                                                                : value.volumeCbm / value.volumeKnown),
                                                value.clients.size(),
                                                percent1(totalVolume <= 0d
                                                                ? 0d
                                                                : value.volumeCbm / totalVolume)))
                                .toList();
        }

        private List<List<Object>> buildAgingBucketRows(
                        List<InventoryAgingRow> rows) {
                Map<String, Long> map = new HashMap<>();

                for (InventoryAgingRow row : rows) {
                        String bucket = agingBucket(row);

                        map.put(
                                        bucket,
                                        map.getOrDefault(bucket, 0L) + 1);
                }

                return map.entrySet()
                                .stream()
                                .sorted((a, b) -> Long.compare(
                                                b.getValue(),
                                                a.getValue()))
                                .map(entry -> row(
                                                entry.getKey(),
                                                entry.getValue()))
                                .toList();
        }

        private List<List<Object>> buildRawPackingRows(
                        List<PackingReportRow> rows,
                        Map<String, PackingVolumeRow> volumeLookup) {
                List<List<Object>> result = new ArrayList<>();

                for (PackingReportRow packing : rows) {
                        PackingVolumeRow volume = findVolumeRow(packing, volumeLookup);

                        String dimensions = volume != null
                                        ? safeLabel(volume.dimensions(), "-")
                                        : text(packing, "dimensions");

                        Double cbm = volume != null
                                        ? volume.volumeCbm()
                                        : volumeCalculator.calculateCbm(dimensions);

                        result.add(row(
                                        text(packing, "zohoItemId"),
                                        text(packing, "itemName"),
                                        text(packing, "clientName", "client"),
                                        volume != null
                                                        ? safeLabel(volume.plantCode(), "-")
                                                        : text(packing, "plantCode"),
                                        volume != null
                                                        ? safeLabel(volume.packetNumber(), "-")
                                                        : packetNumber(packing),
                                        dimensions,
                                        cbm == null ? 0d : cbm,
                                        dateTimeLabel(dateTime(packing, "packedAt")),
                                        text(packing, "packedBy")));
                }

                return result;
        }

        private List<List<Object>> buildPackingVolumeDetailRows(
                        List<PackingVolumeRow> rows) {
                List<List<Object>> result = new ArrayList<>();
                int serial = 1;

                for (PackingVolumeRow value : rows) {
                        result.add(row(
                                        serial++,
                                        dateTimeLabel(value.packedAt()),
                                        safeLabel(value.packedBy(), "SYSTEM"),
                                        safeLabel(value.plantCode(), "-"),
                                        safeLabel(value.clientName(), "-"),
                                        safeLabel(value.pdNo(), "-"),
                                        safeLabel(value.drawingNo(), "-"),
                                        safeLabel(value.itemName(), "-"),
                                        safeLabel(value.packetNumber(), "-"),
                                        safeLabel(value.dimensions(), "-"),
                                        value.volumeCbm() == null ? 0d : value.volumeCbm(),
                                        safeLabel(value.status(), "PACKED")));
                }

                return result;
        }

        private List<List<Object>> buildDispatchRegisterRows(
                        List<DispatchReportRow> rows,
                        Map<String, PackingVolumeRow> volumeLookup) {
                List<List<Object>> result = new ArrayList<>();

                int serialNumber = 1;

                for (DispatchReportRow dispatch : rows) {
                        PackingVolumeRow volume = findVolumeRow(dispatch, volumeLookup);
                        String dimensions = volume != null
                                        ? safeLabel(volume.dimensions(), "-")
                                        : text(dispatch, "dimensions");
                        Double cbm = volume != null
                                        ? volume.volumeCbm()
                                        : volumeCalculator.calculateCbm(dimensions);

                        result.add(
                                        row(
                                                        serialNumber++,
                                                        cleanExcelText(dispatch.getZohoItemId()),
                                                        cleanExcelText(dispatch.getPdNo()),
                                                        cleanExcelText(dispatch.getDrawingNo()),
                                                        cleanExcelText(dispatch.getSku()),
                                                        cleanExcelText(dispatch.getItemName()),
                                                        cleanExcelText(dispatch.getDescription()),
                                                        cleanExcelText(dispatch.getClientName()),
                                                        cleanExcelText(dispatch.getClientAddress()),
                                                        cleanExcelText(dispatch.getPlantCode()),
                                                        cleanExcelText(dispatch.getFloor()),
                                                        cleanExcelText(dispatch.getArea()),
                                                        cleanExcelText(dispatch.getWarehouseCode()),
                                                        cleanExcelText(dispatch.getPacketNumber()),
                                                        cleanExcelText(dispatch.getPacketName()),
                                                        dispatch.getQuantity() == null
                                                                        ? 0
                                                                        : dispatch.getQuantity(),
                                                        cleanExcelText(dimensions),
                                                        cbm == null ? 0d : cbm,
                                                        cleanExcelText(dispatch.getStatus()),
                                                        dateTimeLabel(dispatch.getPackedAt()),
                                                        cleanExcelText(dispatch.getPackedBy()),
                                                        dateTimeLabel(dispatch.getDispatchedAt()),
                                                        cleanExcelText(dispatch.getDispatchedBy()),
                                                        cleanExcelText(dispatch.getChallanNumber()),
                                                        cleanExcelText(dispatch.getDriverName()),
                                                        cleanExcelText(dispatch.getVehicleNumber()),
                                                        cleanExcelText(dispatch.getRemarks())));
                }

                return result;
        }

        private List<List<Object>> buildRawDispatchRows(
                        List<DispatchReportRow> rows,
                        Map<String, PackingVolumeRow> volumeLookup) {
                List<List<Object>> result = new ArrayList<>();

                for (DispatchReportRow dispatch : rows) {
                        PackingVolumeRow volume = findVolumeRow(dispatch, volumeLookup);
                        String dimensions = volume != null
                                        ? safeLabel(volume.dimensions(), "-")
                                        : text(dispatch, "dimensions");
                        Double cbm = volume != null
                                        ? volume.volumeCbm()
                                        : volumeCalculator.calculateCbm(dimensions);

                        result.add(
                                        row(
                                                        cleanExcelText(dispatch.getZohoItemId()),
                                                        cleanExcelText(dispatch.getPdNo()),
                                                        cleanExcelText(dispatch.getDrawingNo()),
                                                        cleanExcelText(dispatch.getItemName()),
                                                        cleanExcelText(dispatch.getClientName()),
                                                        cleanExcelText(dispatch.getArea()),
                                                        cleanExcelText(dispatch.getPacketNumber()),
                                                        cleanExcelText(dimensions),
                                                        cbm == null ? 0d : cbm,
                                                        dateTimeLabel(dispatch.getPackedAt()),
                                                        dateTimeLabel(dispatch.getDispatchedAt()),
                                                        cleanExcelText(dispatch.getDispatchedBy()),
                                                        cleanExcelText(dispatch.getChallanNumber())));
                }

                return result;
        }

        private List<List<Object>> buildRawAgingRows(
                        List<InventoryAgingRow> rows) {
                List<List<Object>> result = new ArrayList<>();

                for (InventoryAgingRow row : rows) {
                        result.add(row(
                                        text(row, "zohoItemId", "itemId"),
                                        text(row, "itemName", "name"),
                                        text(row, "clientName", "client"),
                                        text(row, "status"),
                                        dateTimeLabel(
                                                        dateTime(
                                                                        row,
                                                                        "createdAt",
                                                                        "receivedAt",
                                                                        "packedAt",
                                                                        "date")),
                                        getAgeDays(row),
                                        agingBucket(row)));
                }

                return result;
        }

        private List<List<Object>> buildPackingItemPacketRows(
                        List<PackingReportRow> rows,
                        Map<String, PackingVolumeRow> volumeLookup) {
                List<List<Object>> result = new ArrayList<>();

                for (PackingReportRow packing : rows) {
                        PackingVolumeRow volume = findVolumeRow(packing, volumeLookup);
                        String dimensions = volume != null
                                        ? safeLabel(volume.dimensions(), "-")
                                        : text(packing, "dimensions");
                        Double cbm = volume != null
                                        ? volume.volumeCbm()
                                        : volumeCalculator.calculateCbm(dimensions);

                        result.add(row(
                                        "Packing",
                                        text(packing, "zohoItemId", "itemId"),
                                        text(packing, "itemName", "name"),
                                        text(packing, "clientName", "client"),
                                        packetNumber(packing),
                                        packetName(packing),
                                        "PACKED",
                                        dateTimeLabel(dateTime(packing, "packedAt")),
                                        text(packing, "packedBy", "createdBy"),
                                        dimensions,
                                        cbm == null ? 0d : cbm,
                                        "-"));
                }

                return result;
        }

        private List<List<Object>> buildDispatchItemPacketRows(
                        List<DispatchReportRow> rows,
                        Map<String, PackingVolumeRow> volumeLookup) {
                List<List<Object>> result = new ArrayList<>();

                for (DispatchReportRow dispatch : rows) {
                        PackingVolumeRow volume = findVolumeRow(dispatch, volumeLookup);
                        String dimensions = volume != null
                                        ? safeLabel(volume.dimensions(), "-")
                                        : text(dispatch, "dimensions");
                        Double cbm = volume != null
                                        ? volume.volumeCbm()
                                        : volumeCalculator.calculateCbm(dimensions);

                        result.add(row(
                                        "Dispatch",
                                        text(dispatch, "zohoItemId", "itemId"),
                                        text(dispatch, "itemName", "name"),
                                        text(dispatch, "clientName", "client"),
                                        packetNumber(dispatch),
                                        packetName(dispatch),
                                        "DISPATCHED",
                                        dateTimeLabel(dateTime(dispatch, "dispatchedAt")),
                                        text(dispatch, "dispatchedBy", "createdBy"),
                                        dimensions,
                                        cbm == null ? 0d : cbm,
                                        "-"));
                }

                return result;
        }

        private List<List<Object>> buildInventoryItemPacketRows(
                        List<InventoryAgingRow> rows) {
                List<List<Object>> result = new ArrayList<>();

                for (InventoryAgingRow value : rows) {
                        String dimensions = text(value, "dimensions");
                        Double cbm = volumeCalculator.calculateCbm(dimensions);

                        result.add(row(
                                        "Inventory",
                                        text(value, "zohoItemId", "itemId"),
                                        text(value, "itemName", "name"),
                                        text(value, "clientName", "client"),
                                        packetNumber(value),
                                        packetName(value),
                                        text(value, "status", "itemStatus"),
                                        dateTimeLabel(
                                                        dateTime(
                                                                        value,
                                                                        "createdAt",
                                                                        "receivedAt",
                                                                        "packedAt",
                                                                        "date")),
                                        text(
                                                        value,
                                                        "createdBy",
                                                        "packedBy",
                                                        "dispatchedBy"),
                                        dimensions,
                                        cbm == null ? 0d : cbm,
                                        getAgeDays(value)));
                }

                return result;
        }

        private List<List<Object>> buildInsightRows(
                        KpiData kpis,
                        List<List<Object>> packingUserRows,
                        List<List<Object>> dispatchUserRows,
                        List<List<Object>> dateWiseRows,
                        List<List<Object>> agingBucketRows,
                        List<List<Object>> allItemPacketRows,
                        List<List<Object>> packingItemPacketRows,
                        List<List<Object>> dispatchItemPacketRows) {
                String topPacker = packingUserRows.isEmpty()
                                ? "-"
                                : packingUserRows.get(0).get(0)
                                                + " - "
                                                + packingUserRows.get(0).get(1)
                                                + " packets / "
                                                + packingUserRows.get(0).get(2)
                                                + " m³";

                String topDispatcher = dispatchUserRows.isEmpty()
                                ? "-"
                                : dispatchUserRows.get(0).get(0)
                                                + " - "
                                                + dispatchUserRows.get(0).get(1)
                                                + " dispatched";

                String recentDate = dateWiseRows.isEmpty()
                                ? "-"
                                : dateWiseRows.get(0).get(0)
                                                + " - "
                                                + dateWiseRows.get(0).get(5)
                                                + " total movements / "
                                                + dateWiseRows.get(0).get(2)
                                                + " m³ packed";

                String criticalBucket = agingBucketRows.isEmpty()
                                ? "-"
                                : agingBucketRows.get(0).get(0)
                                                + " - "
                                                + agingBucketRows.get(0).get(1)
                                                + " items";

                return List.of(
                                row(
                                                "Top Packing User by Volume",
                                                topPacker,
                                                "Use cubic metres together with packet count to compare real packing workload."),
                                row(
                                                "Total Packed Volume",
                                                round3(kpis.packedVolumeCbm) + " m³",
                                                "Physical cube packed during the selected reporting period."),
                                row(
                                                "Average Packet Cube",
                                                round3(kpis.averageVolumeCbm) + " m³",
                                                "Useful for manpower, floor-space and vehicle-capacity planning."),
                                row(
                                                "Dimension Data Coverage",
                                                percent1(kpis.dimensionCoverage),
                                                kpis.volumeMissingPackets > 0
                                                                ? "Correct " + kpis.volumeMissingPackets + " packed rows with missing/invalid dimensions."
                                                                : "All selected packed rows have measurable dimensions."),
                                row(
                                                "Peak Packing Volume Date",
                                                safeLabel(kpis.peakVolumeDate, "-") + " - " + round3(kpis.peakVolumeDateCbm) + " m³",
                                                "Use this date as a capacity benchmark for packing manpower and staging space."),
                                row(
                                                "Latest Throughput Date",
                                                recentDate,
                                                "Compare packet count and cube because equal packet counts can represent very different workloads."),
                                row(
                                                "Top Dispatch User",
                                                topDispatcher,
                                                "Review dispatch process and replicate best practices."),
                                row(
                                                "Critical Aging Bucket",
                                                criticalBucket,
                                                "Prioritize old inventory for dispatch or warehouse review."),
                                row(
                                                "Item / Packet Detail Rows",
                                                allItemPacketRows.size(),
                                                "Full packet traceability now includes dimensions and cubic metres where available."),
                                row(
                                                "Packing Item / Packet Rows",
                                                packingItemPacketRows.size(),
                                                "Audit who packed each packet, when it was packed, and its physical volume."),
                                row(
                                                "Dispatch Item / Packet Rows",
                                                dispatchItemPacketRows.size(),
                                                "Validate dispatched packets against challan movement and their packed cube."),
                                row(
                                                "Pending Items",
                                                kpis.pendingItems,
                                                kpis.pendingItems > 0
                                                                ? "Review pending queue and ownership."
                                                                : "Pending inventory is under control."),
                                row(
                                                "Dispatch Completion Rate",
                                                percent(kpis.completionRate),
                                                kpis.completionRate >= 0.8
                                                                ? "Completion rate is healthy."
                                                                : "Completion rate needs improvement."));
        }

        private void addPackingVolumeExecutiveSheet(
                        Workbook workbook,
                        LocalDateTime from,
                        LocalDateTime to,
                        KpiData kpis,
                        List<List<Object>> packingUserRows,
                        List<List<Object>> dateWiseRows) {
                Sheet sheet = workbook.createSheet("Volume Executive");
                sheet.setDisplayGridlines(false);
                sheet.createFreezePane(0, 2);

                sheet.addMergedRegion(new CellRangeAddress(0, 0, 0, 11));
                sheet.addMergedRegion(new CellRangeAddress(1, 1, 0, 11));

                Row titleRow = sheet.createRow(0);
                titleRow.setHeightInPoints(30);
                Cell title = titleRow.createCell(0);
                title.setCellValue("PACKING VOLUME EXECUTIVE SUMMARY");

                CellStyle executiveTitle = workbook.createCellStyle();
                Font titleFont = workbook.createFont();
                titleFont.setBold(true);
                titleFont.setFontHeightInPoints((short) 20);
                titleFont.setColor(IndexedColors.WHITE.getIndex());
                executiveTitle.setFont(titleFont);
                executiveTitle.setFillForegroundColor(IndexedColors.DARK_BLUE.getIndex());
                executiveTitle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
                executiveTitle.setAlignment(HorizontalAlignment.CENTER);
                executiveTitle.setVerticalAlignment(VerticalAlignment.CENTER);
                title.setCellStyle(executiveTitle);

                Row subtitleRow = sheet.createRow(1);
                Cell subtitle = subtitleRow.createCell(0);
                subtitle.setCellValue(
                                "Reporting Period: "
                                                + dateTimeLabel(from)
                                                + " to "
                                                + dateTimeLabel(to)
                                                + " | Cube is calculated from packet L x B x H dimensions entered in inches");

                CellStyle subtitleStyle = workbook.createCellStyle();
                Font subtitleFont = workbook.createFont();
                subtitleFont.setBold(true);
                subtitleFont.setColor(IndexedColors.DARK_BLUE.getIndex());
                subtitleStyle.setFont(subtitleFont);
                subtitleStyle.setFillForegroundColor(IndexedColors.LIGHT_CORNFLOWER_BLUE.getIndex());
                subtitleStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
                subtitleStyle.setAlignment(HorizontalAlignment.CENTER);
                subtitleStyle.setVerticalAlignment(VerticalAlignment.CENTER);
                subtitle.setCellStyle(subtitleStyle);

                String[] cardLabels = {
                                "PACKETS PACKED",
                                "TOTAL PACKED VOLUME",
                                "AVG CUBE / PACKET",
                                "DIMENSION COVERAGE",
                                "TOP PACKER BY VOLUME",
                                "PEAK VOLUME DATE"
                };

                String[] cardValues = {
                                String.valueOf(kpis.packedInRange),
                                round3(kpis.packedVolumeCbm) + " m³",
                                round3(kpis.averageVolumeCbm) + " m³",
                                percent1(kpis.dimensionCoverage),
                                safeLabel(kpis.topVolumePacker, "-")
                                                + " | "
                                                + round3(kpis.topVolumePackerCbm)
                                                + " m³",
                                safeLabel(kpis.peakVolumeDate, "-")
                                                + " | "
                                                + round3(kpis.peakVolumeDateCbm)
                                                + " m³"
                };

                CellStyle cardLabelStyle = workbook.createCellStyle();
                Font cardLabelFont = workbook.createFont();
                cardLabelFont.setBold(true);
                cardLabelFont.setFontHeightInPoints((short) 9);
                cardLabelFont.setColor(IndexedColors.GREY_80_PERCENT.getIndex());
                cardLabelStyle.setFont(cardLabelFont);
                cardLabelStyle.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
                cardLabelStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
                cardLabelStyle.setAlignment(HorizontalAlignment.CENTER);
                cardLabelStyle.setVerticalAlignment(VerticalAlignment.CENTER);
                cardLabelStyle.setBorderTop(BorderStyle.THIN);
                cardLabelStyle.setBorderBottom(BorderStyle.THIN);
                cardLabelStyle.setBorderLeft(BorderStyle.THIN);
                cardLabelStyle.setBorderRight(BorderStyle.THIN);

                CellStyle cardValueStyle = workbook.createCellStyle();
                Font cardValueFont = workbook.createFont();
                cardValueFont.setBold(true);
                cardValueFont.setFontHeightInPoints((short) 14);
                cardValueFont.setColor(IndexedColors.DARK_BLUE.getIndex());
                cardValueStyle.setFont(cardValueFont);
                cardValueStyle.setFillForegroundColor(IndexedColors.WHITE.getIndex());
                cardValueStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
                cardValueStyle.setAlignment(HorizontalAlignment.CENTER);
                cardValueStyle.setVerticalAlignment(VerticalAlignment.CENTER);
                cardValueStyle.setWrapText(true);
                cardValueStyle.setBorderTop(BorderStyle.THIN);
                cardValueStyle.setBorderBottom(BorderStyle.THIN);
                cardValueStyle.setBorderLeft(BorderStyle.THIN);
                cardValueStyle.setBorderRight(BorderStyle.THIN);

                Row cardLabelRow = sheet.createRow(3);
                Row cardValueRow = sheet.createRow(4);
                cardLabelRow.setHeightInPoints(22);
                cardValueRow.setHeightInPoints(36);

                for (int card = 0; card < 6; card++) {
                        int startCol = card * 2;
                        int endCol = startCol + 1;

                        sheet.addMergedRegion(new CellRangeAddress(3, 3, startCol, endCol));
                        sheet.addMergedRegion(new CellRangeAddress(4, 4, startCol, endCol));

                        Cell label = cardLabelRow.createCell(startCol);
                        label.setCellValue(cardLabels[card]);
                        label.setCellStyle(cardLabelStyle);

                        Cell value = cardValueRow.createCell(startCol);
                        value.setCellValue(cardValues[card]);
                        value.setCellStyle(cardValueStyle);
                }

                CellStyle sectionStyle = workbook.createCellStyle();
                Font sectionFont = workbook.createFont();
                sectionFont.setBold(true);
                sectionFont.setFontHeightInPoints((short) 12);
                sectionFont.setColor(IndexedColors.WHITE.getIndex());
                sectionStyle.setFont(sectionFont);
                sectionStyle.setFillForegroundColor(IndexedColors.BLUE_GREY.getIndex());
                sectionStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
                sectionStyle.setAlignment(HorizontalAlignment.LEFT);
                sectionStyle.setVerticalAlignment(VerticalAlignment.CENTER);

                CellStyle smallHeader = headerStyle(workbook);
                CellStyle smallData = dataStyle(workbook);

                int userSectionRow = 7;
                sheet.addMergedRegion(new CellRangeAddress(userSectionRow, userSectionRow, 0, 5));
                Cell userSection = sheet.createRow(userSectionRow).createCell(0);
                userSection.setCellValue("PACKING USER PRODUCTIVITY | COUNT + CUBIC METRE WORKLOAD");
                userSection.setCellStyle(sectionStyle);

                Row userHeader = sheet.createRow(userSectionRow + 1);
                String[] userHeaders = {
                                "User",
                                "Packets",
                                "Volume (m³)",
                                "Avg m³/Packet",
                                "Volume Share",
                                "Dimension Coverage"
                };

                for (int i = 0; i < userHeaders.length; i++) {
                        Cell cell = userHeader.createCell(i);
                        cell.setCellValue(userHeaders[i]);
                        cell.setCellStyle(smallHeader);
                }

                int userRowIndex = userSectionRow + 2;
                int userLimit = Math.min(packingUserRows.size(), 10);

                for (int i = 0; i < userLimit; i++) {
                        List<Object> values = packingUserRows.get(i);
                        Row row = sheet.createRow(userRowIndex++);
                        Object[] selected = {
                                        values.get(0),
                                        values.get(1),
                                        values.get(2),
                                        values.get(3),
                                        values.get(6),
                                        values.get(7)
                        };

                        for (int c = 0; c < selected.length; c++) {
                                Cell cell = row.createCell(c);
                                writeCell(cell, selected[c]);
                                cell.setCellStyle(smallData);
                        }
                }

                int dailyStartCol = 7;
                int dailySectionRow = 7;
                sheet.addMergedRegion(new CellRangeAddress(dailySectionRow, dailySectionRow, dailyStartCol, 11));
                Cell dailySection = sheet.getRow(dailySectionRow).createCell(dailyStartCol);
                dailySection.setCellValue("DAILY PACKING CUBE THROUGHPUT");
                dailySection.setCellStyle(sectionStyle);

                Row dailyHeader = sheet.getRow(dailySectionRow + 1);
                if (dailyHeader == null) {
                        dailyHeader = sheet.createRow(dailySectionRow + 1);
                }

                String[] dailyHeaders = {
                                "Date",
                                "Packets",
                                "Volume (m³)",
                                "Avg m³/Packet",
                                "Movements"
                };

                for (int i = 0; i < dailyHeaders.length; i++) {
                        Cell cell = dailyHeader.createCell(dailyStartCol + i);
                        cell.setCellValue(dailyHeaders[i]);
                        cell.setCellStyle(smallHeader);
                }

                int dailyRowIndex = dailySectionRow + 2;
                int dailyLimit = Math.min(dateWiseRows.size(), 14);

                for (int i = 0; i < dailyLimit; i++) {
                        List<Object> values = dateWiseRows.get(i);
                        Row row = sheet.getRow(dailyRowIndex);
                        if (row == null) {
                                row = sheet.createRow(dailyRowIndex);
                        }
                        dailyRowIndex++;

                        Object[] selected = {
                                        values.get(0),
                                        values.get(1),
                                        values.get(2),
                                        values.get(3),
                                        values.get(5)
                        };

                        for (int c = 0; c < selected.length; c++) {
                                Cell cell = row.createCell(dailyStartCol + c);
                                writeCell(cell, selected[c]);
                                cell.setCellStyle(smallData);
                        }
                }

                int readoutRow = Math.max(userRowIndex, dailyRowIndex) + 2;
                sheet.addMergedRegion(new CellRangeAddress(readoutRow, readoutRow, 0, 11));
                Cell readoutTitle = sheet.createRow(readoutRow).createCell(0);
                readoutTitle.setCellValue("MANAGEMENT READOUT");
                readoutTitle.setCellStyle(sectionStyle);

                String[] readouts = {
                                "• " + round3(kpis.packedVolumeCbm) + " m³ packed in the selected period across " + kpis.packedInRange + " packet records.",
                                "• Highest cube contribution: " + safeLabel(kpis.topVolumePacker, "-") + " at " + round3(kpis.topVolumePackerCbm) + " m³.",
                                "• Peak volume date: " + safeLabel(kpis.peakVolumeDate, "-") + " with " + round3(kpis.peakVolumeDateCbm) + " m³ packed.",
                                "• Dimension coverage is " + percent1(kpis.dimensionCoverage) + ". Missing/invalid dimensions: " + kpis.volumeMissingPackets + ".",
                                "• Use cubic metres with packet count for manpower, staging-space and vehicle-capacity decisions."
                };

                CellStyle readoutStyle = workbook.createCellStyle();
                readoutStyle.cloneStyleFrom(smallData);
                readoutStyle.setWrapText(true);
                readoutStyle.setVerticalAlignment(VerticalAlignment.TOP);

                for (int i = 0; i < readouts.length; i++) {
                        int rowNo = readoutRow + 1 + i;
                        sheet.addMergedRegion(new CellRangeAddress(rowNo, rowNo, 0, 11));
                        Row row = sheet.createRow(rowNo);
                        row.setHeightInPoints(22);
                        Cell cell = row.createCell(0);
                        cell.setCellValue(readouts[i]);
                        cell.setCellStyle(readoutStyle);
                }

                for (int i = 0; i < 12; i++) {
                        sheet.setColumnWidth(i, i == 0 || i == 7 ? 5200 : 3800);
                }

                sheet.setFitToPage(true);
                sheet.setAutobreaks(true);
                PrintSetup printSetup = sheet.getPrintSetup();
                printSetup.setLandscape(true);
                printSetup.setFitWidth((short) 1);
                printSetup.setFitHeight((short) 1);
                printSetup.setPaperSize((short) 8); // A3
                sheet.setHorizontallyCenter(true);
        }

        private Map<String, PackingVolumeRow> buildVolumeLookup(
                        List<PackingVolumeRow> rows) {
                Map<String, PackingVolumeRow> lookup = new HashMap<>();

                if (rows == null) {
                        return lookup;
                }

                for (PackingVolumeRow row : rows) {
                        if (row == null) {
                                continue;
                        }

                        if (row.packetItemId() != null) {
                                lookup.put(
                                                normalizeLookupKey(row.packetItemId().toString()),
                                                row);
                        }

                        if (row.zohoItemId() != null && !row.zohoItemId().isBlank()) {
                                lookup.put(
                                                normalizeLookupKey(row.zohoItemId()),
                                                row);
                        }
                }

                return lookup;
        }

        private PackingVolumeRow findVolumeRow(
                        Object source,
                        Map<String, PackingVolumeRow> lookup) {
                if (source == null || lookup == null || lookup.isEmpty()) {
                        return null;
                }

                Object[] candidateValues = {
                                read(source, "packetItemId"),
                                read(source, "zohoItemId"),
                                read(source, "itemId"),
                                read(source, "id")
                };

                for (Object candidate : candidateValues) {
                        if (candidate == null) {
                                continue;
                        }

                        String key = normalizeLookupKey(String.valueOf(candidate));

                        if (key.isBlank()) {
                                continue;
                        }

                        PackingVolumeRow match = lookup.get(key);

                        if (match != null) {
                                return match;
                        }
                }

                return null;
        }

        private String normalizeLookupKey(String value) {
                return value == null
                                ? ""
                                : value.trim().toLowerCase(Locale.ROOT);
        }

        private String safeLabel(String value, String fallback) {
                if (value == null || value.trim().isBlank()) {
                        return fallback;
                }

                return value.trim();
        }

        private double round3(double value) {
                if (!Double.isFinite(value)) {
                        return 0d;
                }

                return Math.round(value * 1000d) / 1000d;
        }

        private String percent1(double value) {
                if (!Double.isFinite(value)) {
                        return "0.0%";
                }

                return String.format(
                                Locale.ROOT,
                                "%.1f%%",
                                value * 100d);
        }

        private void addRowsSheet(
                        Workbook workbook,
                        String sheetName,
                        String title,
                        String[] headers,
                        List<List<Object>> rows,
                        CellStyle titleStyle,
                        CellStyle headerStyle,
                        CellStyle dataStyle,
                        CellStyle warningStyle,
                        int warningColumnOneBased) {
                Sheet sheet = workbook.createSheet(
                                safeSheetName(sheetName));

                sheet.addMergedRegion(
                                new CellRangeAddress(
                                                0,
                                                0,
                                                0,
                                                headers.length - 1));

                Row titleRow = sheet.createRow(0);
                titleRow.setHeightInPoints(24);

                Cell titleCell = titleRow.createCell(0);

                titleCell.setCellValue(title);
                titleCell.setCellStyle(titleStyle);

                sheet.createRow(1);

                Row headerRow = sheet.createRow(2);

                for (int i = 0; i < headers.length; i++) {
                        Cell cell = headerRow.createCell(i);

                        cell.setCellValue(headers[i]);
                        cell.setCellStyle(headerStyle);
                }

                int rowIndex = 3;

                if (rows == null || rows.isEmpty()) {
                        Row row = sheet.createRow(rowIndex);
                        Cell cell = row.createCell(0);
                        cell.setCellValue("No data available.");
                        cell.setCellStyle(dataStyle);
                } else {
                        for (List<Object> values : rows) {
                                Row row = sheet.createRow(rowIndex++);

                                for (int i = 0; i < headers.length; i++) {
                                        Cell cell = row.createCell(i);

                                        Object value = i < values.size()
                                                        ? values.get(i)
                                                        : "";

                                        writeCell(cell, value);

                                        if (warningColumnOneBased > 0 &&
                                                        i + 1 == warningColumnOneBased &&
                                                        isWarningValue(value)) {
                                                cell.setCellStyle(warningStyle);
                                        } else {
                                                cell.setCellStyle(dataStyle);
                                        }
                                }
                        }
                }

                sheet.setAutoFilter(
                                new CellRangeAddress(
                                                2,
                                                Math.max(2, rowIndex - 1),
                                                0,
                                                headers.length - 1));

                sheet.createFreezePane(0, 3);
                sheet.setFitToPage(true);
                sheet.setAutobreaks(true);

                PrintSetup printSetup = sheet.getPrintSetup();

                printSetup.setLandscape(
                                headers.length > 8);

                printSetup.setFitWidth(
                                (short) 1);

                printSetup.setFitHeight(
                                (short) 0);

                sheet.setRepeatingRows(
                                CellRangeAddress.valueOf("3:3"));

                for (int i = 0; i < headers.length; i++) {
                        sheet.autoSizeColumn(i);
                        String header = headers[i] == null
                                        ? ""
                                        : headers[i].toLowerCase();

                        boolean longTextColumn = header.contains("item")
                                        || header.contains("description")
                                        || header.contains("client")
                                        || header.contains("address")
                                        || header.contains("remarks");

                        int maximumWidth = longTextColumn
                                        ? 16000
                                        : 9000;

                        sheet.setColumnWidth(
                                        i,
                                        Math.min(
                                                        sheet.getColumnWidth(i) + 1000,
                                                        maximumWidth));
                }
        }

        private boolean isWarningValue(Object value) {
                if (value == null) {
                        return false;
                }

                try {
                        return Double.parseDouble(
                                        String.valueOf(value)) > 0;
                } catch (Exception e) {
                        return false;
                }
        }

        private void writeCell(
                        Cell cell,
                        Object value) {
                if (value == null) {
                        cell.setCellValue("");
                        return;
                }

                if (value instanceof Number number) {
                        cell.setCellValue(
                                        number.doubleValue());
                        return;
                }

                if (value instanceof Boolean bool) {
                        cell.setCellValue(bool);
                        return;
                }

                cell.setCellValue(
                                String.valueOf(value));
        }

        private CellStyle titleStyle(
                        Workbook workbook) {
                CellStyle style = workbook.createCellStyle();

                Font font = workbook.createFont();

                font.setBold(true);
                font.setFontHeightInPoints((short) 18);
                font.setColor(
                                IndexedColors.WHITE.getIndex());

                style.setFont(font);
                style.setFillForegroundColor(
                                IndexedColors.DARK_BLUE.getIndex());
                style.setFillPattern(
                                FillPatternType.SOLID_FOREGROUND);
                style.setAlignment(
                                HorizontalAlignment.LEFT);
                style.setVerticalAlignment(
                                VerticalAlignment.CENTER);

                return style;
        }

        private CellStyle headerStyle(
                        Workbook workbook) {
                CellStyle style = workbook.createCellStyle();

                Font font = workbook.createFont();

                font.setBold(true);
                font.setColor(
                                IndexedColors.WHITE.getIndex());

                style.setFont(font);
                style.setFillForegroundColor(
                                IndexedColors.BLUE.getIndex());
                style.setFillPattern(
                                FillPatternType.SOLID_FOREGROUND);
                style.setAlignment(
                                HorizontalAlignment.CENTER);
                style.setVerticalAlignment(
                                VerticalAlignment.CENTER);
                style.setBorderBottom(
                                BorderStyle.THIN);
                style.setBorderTop(
                                BorderStyle.THIN);
                style.setBorderLeft(
                                BorderStyle.THIN);
                style.setBorderRight(
                                BorderStyle.THIN);

                return style;
        }

        private CellStyle dataStyle(
                        Workbook workbook) {
                CellStyle style = workbook.createCellStyle();

                style.setBorderBottom(
                                BorderStyle.THIN);
                style.setBorderTop(
                                BorderStyle.THIN);
                style.setBorderLeft(
                                BorderStyle.THIN);
                style.setBorderRight(
                                BorderStyle.THIN);
                style.setVerticalAlignment(
                                VerticalAlignment.TOP);
                style.setWrapText(true);

                return style;
        }

        private CellStyle warningStyle(
                        Workbook workbook) {
                CellStyle style = dataStyle(workbook);

                style.setFillForegroundColor(
                                IndexedColors.LIGHT_YELLOW.getIndex());
                style.setFillPattern(
                                FillPatternType.SOLID_FOREGROUND);

                Font font = workbook.createFont();

                font.setBold(true);

                style.setFont(font);

                return style;
        }

        private String safeSheetName(
                        String value) {
                String cleaned = value.replaceAll(
                                "[\\\\/?*\\[\\]:]",
                                "-");

                return cleaned.length() > 31
                                ? cleaned.substring(0, 31)
                                : cleaned;
        }

        private Object read(
                        Object source,
                        String... names) {
                if (source == null) {
                        return null;
                }

                Class<?> clazz = source.getClass();

                for (String name : names) {
                        Object fromGetter = readGetter(source, clazz, name);

                        if (fromGetter != null) {
                                return fromGetter;
                        }

                        Object fromField = readField(source, clazz, name);

                        if (fromField != null) {
                                return fromField;
                        }
                }

                return null;
        }

        private Object readGetter(
                        Object source,
                        Class<?> clazz,
                        String name) {
                String suffix = name.substring(0, 1).toUpperCase()
                                + name.substring(1);

                String[] methods = {
                                "get" + suffix,
                                "is" + suffix
                };

                for (String methodName : methods) {
                        try {
                                Method method = clazz.getMethod(methodName);

                                return method.invoke(source);
                        } catch (Exception ignored) {
                        }
                }

                return null;
        }

        private Object readField(
                        Object source,
                        Class<?> clazz,
                        String name) {
                Class<?> current = clazz;

                while (current != null) {
                        try {
                                Field field = current.getDeclaredField(name);

                                field.setAccessible(true);

                                return field.get(source);
                        } catch (Exception ignored) {
                                current = current.getSuperclass();
                        }
                }

                return null;
        }

        private String text(
                        Object source,
                        String... names) {
                Object value = read(source, names);

                if (value == null) {
                        return "-";
                }

                String text = String.valueOf(value).trim();

                return text.isBlank()
                                ? "-"
                                : text;
        }

        private long number(
                        Object source,
                        String... names) {
                Object value = read(source, names);

                if (value == null) {
                        return 0;
                }

                if (value instanceof Number number) {
                        return number.longValue();
                }

                try {
                        return Math.round(
                                        Double.parseDouble(
                                                        String.valueOf(value)));
                } catch (Exception e) {
                        return 0;
                }
        }

        private LocalDateTime dateTime(
                        Object source,
                        String... names) {
                Object value = read(source, names);

                if (value == null) {
                        return null;
                }

                if (value instanceof LocalDateTime dateTime) {
                        return dateTime;
                }

                if (value instanceof LocalDate date) {
                        return date.atStartOfDay();
                }

                if (value instanceof Date date) {
                        return LocalDateTime.ofInstant(
                                        date.toInstant(),
                                        java.time.ZoneId.systemDefault());
                }

                try {
                        return LocalDateTime.parse(
                                        String.valueOf(value));
                } catch (Exception ignored) {
                }

                try {
                        return LocalDate.parse(
                                        String.valueOf(value)).atStartOfDay();
                } catch (Exception ignored) {
                }

                return null;
        }

        private String packetNumber(
                        Object source) {
                return text(
                                source,
                                "packetNumber",
                                "packetNo",
                                "packetCode",
                                "packetId",
                                "packetName");
        }

        private String packetName(
                        Object source) {
                return text(
                                source,
                                "packetName",
                                "packetTitle",
                                "packetDescription",
                                "packetType");
        }

        private String dateKey(
                        LocalDateTime date) {
                if (date == null) {
                        return "Unknown";
                }

                return date.toLocalDate().toString();
        }

        private String dateLabel(
                        LocalDateTime date) {
                if (date == null) {
                        return "-";
                }

                return date.format(DATE_FORMAT);
        }

        private String dateTimeLabel(
                        LocalDateTime date) {
                if (date == null) {
                        return "-";
                }

                return date.format(DATE_TIME_FORMAT);
        }

        private String percent(
                        double value) {
                return Math.round(value * 100) + "%";
        }

        private long getAgeDays(
                        Object row) {
                long direct = number(
                                row,
                                "ageDays",
                                "agingDays",
                                "daysInInventory",
                                "days");

                if (direct > 0) {
                        return direct;
                }

                LocalDateTime created = dateTime(
                                row,
                                "createdAt",
                                "receivedAt",
                                "packedAt",
                                "date");

                if (created == null) {
                        return 0;
                }

                return Math.max(
                                java.time.Duration.between(
                                                created,
                                                LocalDateTime.now()).toDays(),
                                0);
        }

        private String agingBucket(
                        Object row) {
                String bucket = text(
                                row,
                                "agingBucket",
                                "bucket",
                                "ageBucket");

                if (!"-".equals(bucket)) {
                        return bucket;
                }

                long days = getAgeDays(row);

                if (days <= 7) {
                        return "0-7 Days";
                }

                if (days <= 30) {
                        return "8-30 Days";
                }

                if (days <= 90) {
                        return "31-90 Days";
                }

                return "90+ Days";
        }

        private static class KpiData {
                long totalInventory;
                long warehouseItems;
                long readyToDispatch;
                long readyItems;
                long packedItems;
                long dispatchedItems;
                long pendingItems;
                long stickersGenerated;
                long packedInRange;
                long dispatchedInRange;
                long agingItems;
                long criticalAging;
                long uniqueClients;
                long volumeKnownPackets;
                long volumeMissingPackets;
                double packedVolumeCbm;
                double averageVolumeCbm;
                double dimensionCoverage;
                double completionRate;
                String topVolumePacker;
                double topVolumePackerCbm;
                String peakVolumeDate;
                double peakVolumeDateCbm;
        }

        private static class CountRow {
                String label;
                long packed;
                long dispatched;
                long total;
                long volumeKnown;
                double packedVolumeCbm;

                CountRow(String label) {
                        this.label = label;
                }
        }

        private String cleanExcelText(
                        String value) {
                if (value == null || value.trim().isBlank()) {
                        return "-";
                }

                String text = value
                                .replace("\r", " ")
                                .replace("\n", " ")
                                .trim();

                if ("-".equals(text)) {
                        return "-";
                }

                /*
                 * Prevent formula injection when user-entered content
                 * starts with =, +, -, or @.
                 */
                if (text.startsWith("=")
                                || text.startsWith("+")
                                || text.startsWith("-")
                                || text.startsWith("@")) {
                        return "'" + text;
                }

                return text;
        }

        private static class UserCountRow {
                String user;
                long count;
                long volumeKnown;
                double volumeCbm;
                Set<String> clients = new HashSet<>();

                UserCountRow(String user) {
                        this.user = user;
                }
        }

}