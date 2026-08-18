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
import org.apache.poi.xddf.usermodel.chart.*;
import org.apache.poi.xssf.usermodel.XSSFChart;
import org.apache.poi.xssf.usermodel.XSSFClientAnchor;
import org.apache.poi.xssf.usermodel.XSSFDrawing;
import org.apache.poi.xssf.usermodel.XSSFSheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;

import com.alsorg.packing.reporting.dto.DashboardStatsDTO;
import com.alsorg.packing.reporting.dto.DispatchReportRow;
import com.alsorg.packing.reporting.dto.InventoryAgingRow;
import com.alsorg.packing.reporting.dto.MasterItemReportRow;
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
        private final MasterItemReportService masterItemReportService;

        public InventoryReportWorkbookService(
                        DashboardReportService dashboardService,
                        PackingReportService packingService,
                        DispatchReportService dispatchService,
                        InventoryAgingReportService agingService,
                        PackingVolumeReportService packingVolumeService,
                        DimensionVolumeCalculator volumeCalculator,
                        MasterItemReportService masterItemReportService) {
                this.dashboardService = dashboardService;
                this.packingService = packingService;
                this.dispatchService = dispatchService;
                this.agingService = agingService;
                this.packingVolumeService = packingVolumeService;
                this.volumeCalculator = volumeCalculator;
                this.masterItemReportService = masterItemReportService;
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

                List<MasterItemReportRow> directorMasterRows =
                                includePacking && includeDispatch && includeAging
                                                ? masterItemReportService.getMasterItems(
                                                                "ALL",
                                                                null,
                                                                null,
                                                                null,
                                                                from,
                                                                to,
                                                                5000,
                                                                0)
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

                        if (includePacking && includeDispatch && includeAging) {
                                DirectorData directorData = buildDirectorData(
                                                from,
                                                to,
                                                packingRows,
                                                dispatchRows,
                                                agingRows,
                                                directorMasterRows,
                                                kpis);

                                addDirectorDashboardSheet(
                                                workbook,
                                                from,
                                                to,
                                                directorData,
                                                kpis);
                        }

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

        private DirectorData buildDirectorData(
                        LocalDateTime from,
                        LocalDateTime to,
                        List<PackingReportRow> packingRows,
                        List<DispatchReportRow> dispatchRows,
                        List<InventoryAgingRow> agingRows,
                        List<MasterItemReportRow> masterRows,
                        KpiData kpis) {
                DirectorData data = new DirectorData();

                LocalDate startDate = from == null
                                ? LocalDate.now().withDayOfMonth(1)
                                : from.toLocalDate();

                LocalDate endDate = to == null
                                ? LocalDate.now()
                                : to.toLocalDate();

                if (endDate.isBefore(startDate)) {
                        LocalDate swap = startDate;
                        startDate = endDate;
                        endDate = swap;
                }

                Map<LocalDate, DirectorDailyPoint> dailyMap = new TreeMap<>();

                LocalDate cursor = startDate;
                while (!cursor.isAfter(endDate)) {
                        dailyMap.put(
                                        cursor,
                                        new DirectorDailyPoint(
                                                        cursor,
                                                        0,
                                                        0));
                        cursor = cursor.plusDays(1);
                }

                for (PackingReportRow row : packingRows) {
                        LocalDateTime packedAt = dateTime(
                                        row,
                                        "packedAt",
                                        "date");

                        if (packedAt == null) {
                                continue;
                        }

                        LocalDate date = packedAt.toLocalDate();
                        DirectorDailyPoint point = dailyMap.computeIfAbsent(
                                        date,
                                        key -> new DirectorDailyPoint(
                                                        key,
                                                        0,
                                                        0));
                        point.packed++;
                }

                for (DispatchReportRow row : dispatchRows) {
                        LocalDateTime dispatchedAt = dateTime(
                                        row,
                                        "dispatchedAt",
                                        "date");

                        if (dispatchedAt != null) {
                                LocalDate date = dispatchedAt.toLocalDate();
                                DirectorDailyPoint point = dailyMap.computeIfAbsent(
                                                date,
                                                key -> new DirectorDailyPoint(
                                                                key,
                                                                0,
                                                                0));
                                point.dispatched++;
                        }
                }

                data.dailyRows.addAll(dailyMap.values());

                Map<String, Long> statusCounts = new LinkedHashMap<>();
                statusCounts.put("READY", 0L);
                statusCounts.put("READY_TO_DISPATCH", 0L);
                statusCounts.put("IN_WAREHOUSE", 0L);
                statusCounts.put("WAREHOUSE_REQUESTED", 0L);
                statusCounts.put("READY_TO_STORE", 0L);

                long age0To7 = 0;
                long age8To30 = 0;
                long age31To90 = 0;
                long age90Plus = 0;
                long ninetyPlusInWarehouse = 0;
                long agedReadyToDispatch = 0;

                for (InventoryAgingRow row : agingRows) {
                        String status = directorStatus(row);
                        statusCounts.put(
                                        status,
                                        statusCounts.getOrDefault(status, 0L) + 1);

                        long days = getAgeDays(row);

                        if (days <= 7) {
                                age0To7++;
                        } else if (days <= 30) {
                                age8To30++;
                        } else if (days <= 90) {
                                age31To90++;
                        } else {
                                age90Plus++;
                        }

                        if (days > 90 && "IN_WAREHOUSE".equals(status)) {
                                ninetyPlusInWarehouse++;
                        }

                        if (days > 30
                                        && days <= 90
                                        && "READY_TO_DISPATCH".equals(status)) {
                                agedReadyToDispatch++;
                        }
                }

                data.currentInventoryPackets = agingRows.size();
                data.coreInventory = statusCounts.getOrDefault("READY", 0L)
                                + statusCounts.getOrDefault("READY_TO_DISPATCH", 0L)
                                + statusCounts.getOrDefault("IN_WAREHOUSE", 0L);
                data.transitionInventory = statusCounts.getOrDefault("WAREHOUSE_REQUESTED", 0L)
                                + statusCounts.getOrDefault("READY_TO_STORE", 0L);

                if (data.currentInventoryPackets == 0) {
                        data.currentInventoryPackets = data.coreInventory + data.transitionInventory;
                }

                data.age0To7 = age0To7;
                data.age8To30 = age8To30;
                data.age31To90 = age31To90;
                data.age90Plus = age90Plus;
                data.agedOver30 = age31To90 + age90Plus;
                data.ninetyPlusInWarehouse = ninetyPlusInWarehouse;
                data.agedReadyToDispatch = agedReadyToDispatch;

                data.agingBars.add(new DirectorBarPoint("0-7 Days", age0To7));
                data.agingBars.add(new DirectorBarPoint("8-30 Days", age8To30));
                data.agingBars.add(new DirectorBarPoint("31-90 Days", age31To90));
                data.agingBars.add(new DirectorBarPoint("90+ Days", age90Plus));

                for (String status : List.of(
                                "READY",
                                "READY_TO_DISPATCH",
                                "IN_WAREHOUSE",
                                "WAREHOUSE_REQUESTED",
                                "READY_TO_STORE")) {
                        data.statusBars.add(
                                        new DirectorBarPoint(
                                                        status,
                                                        statusCounts.getOrDefault(status, 0L)));
                }

                List<Double> leadTimes = new ArrayList<>();
                long delayedOver7 = 0;
                long negativeTimestamps = 0;
                long missingPackingDate = 0;
                long missingVehicle = 0;
                long missingDriver = 0;

                Map<String, Long> challanCounts = new HashMap<>();
                Map<String, Long> dispatchPlantCounts = new HashMap<>();

                for (DispatchReportRow row : dispatchRows) {
                        LocalDateTime packedAt = dateTime(
                                        row,
                                        "packedAt",
                                        "packingDate");

                        LocalDateTime dispatchedAt = dateTime(
                                        row,
                                        "dispatchedAt",
                                        "dispatchDate");

                        if (packedAt == null) {
                                missingPackingDate++;
                        }

                        if (packedAt != null && dispatchedAt != null) {
                                double days = java.time.Duration.between(
                                                packedAt,
                                                dispatchedAt).toMinutes()
                                                / 1440.0;

                                if (days < 0) {
                                        negativeTimestamps++;
                                } else {
                                        leadTimes.add(days);
                                        if (days > 7) {
                                                delayedOver7++;
                                        }
                                }
                        }

                        String vehicle = text(
                                        row,
                                        "vehicleNumber",
                                        "vehicleNo");
                        if (isDirectorBlank(vehicle)) {
                                missingVehicle++;
                        }

                        String driver = text(
                                        row,
                                        "driverName",
                                        "driver");
                        if (isDirectorBlank(driver)) {
                                missingDriver++;
                        }

                        String challan = text(
                                        row,
                                        "challanNumber",
                                        "chalaanNumber");
                        if (!isDirectorBlank(challan)) {
                                challanCounts.put(
                                                challan,
                                                challanCounts.getOrDefault(challan, 0L) + 1);
                        }

                        String plant = text(
                                        row,
                                        "plantCode",
                                        "plant");
                        if (isDirectorBlank(plant)) {
                                plant = "Unassigned";
                        }

                        dispatchPlantCounts.put(
                                        plant,
                                        dispatchPlantCounts.getOrDefault(plant, 0L) + 1);
                }

                data.medianPackToDispatchDays = medianDouble(leadTimes);
                data.averagePackToDispatchDays = leadTimes.isEmpty()
                                ? 0
                                : leadTimes.stream()
                                                .mapToDouble(Double::doubleValue)
                                                .average()
                                                .orElse(0);
                data.validPackToDispatchRows = leadTimes.size();
                data.dispatchOverSevenDays = delayedOver7;
                data.negativeDispatchTimestamps = negativeTimestamps;
                data.missingPackingDateRows = missingPackingDate;
                data.missingVehicleRows = missingVehicle;
                data.missingDriverRows = missingDriver;

                List<Double> packetsPerChallan = challanCounts.values()
                                .stream()
                                .map(Long::doubleValue)
                                .sorted()
                                .toList();

                data.uniqueChallans = challanCounts.size();
                data.averagePacketsPerChallan = packetsPerChallan.isEmpty()
                                ? 0
                                : packetsPerChallan.stream()
                                                .mapToDouble(Double::doubleValue)
                                                .average()
                                                .orElse(0);
                data.medianPacketsPerChallan = medianDouble(packetsPerChallan);

                dispatchPlantCounts.entrySet()
                                .stream()
                                .sorted((a, b) -> Long.compare(b.getValue(), a.getValue()))
                                .limit(8)
                                .forEach(entry -> data.dispatchPlantBars.add(
                                                new DirectorBarPoint(
                                                                entry.getKey(),
                                                                entry.getValue())));

                DirectorDailyPoint peakMovement = data.dailyRows.stream()
                                .max(Comparator.comparingLong(DirectorDailyPoint::total))
                                .orElse(null);

                if (peakMovement != null) {
                        data.peakMovement = peakMovement.total();
                        data.peakMovementDate = peakMovement.date;
                }

                DirectorDailyPoint peakPacking = data.dailyRows.stream()
                                .max(Comparator.comparingLong(point -> point.packed))
                                .orElse(null);
                if (peakPacking != null) {
                        data.peakPacking = peakPacking.packed;
                        data.peakPackingDate = peakPacking.date;
                }

                DirectorDailyPoint peakDispatch = data.dailyRows.stream()
                                .max(Comparator.comparingLong(point -> point.dispatched))
                                .orElse(null);
                if (peakDispatch != null) {
                        data.peakDispatch = peakDispatch.dispatched;
                        data.peakDispatchDate = peakDispatch.date;
                }

                LocalDate today = LocalDate.now(java.time.ZoneId.of("Asia/Kolkata"));
                LocalDate comparisonEnd = endDate.equals(today)
                                ? endDate.minusDays(1)
                                : endDate;
                LocalDate latestStart = comparisonEnd.minusDays(6);
                LocalDate previousEnd = latestStart.minusDays(1);
                LocalDate previousStart = previousEnd.minusDays(6);

                data.previousStart = previousStart;
                data.previousEnd = previousEnd;
                data.latestStart = latestStart;
                data.latestEnd = comparisonEnd;
                data.comparisonAvailable = !previousStart.isBefore(startDate);

                if (data.comparisonAvailable) {
                        data.previousPacked = sumDirectorDaily(
                                        data.dailyRows,
                                        previousStart,
                                        previousEnd,
                                        true);
                        data.latestPacked = sumDirectorDaily(
                                        data.dailyRows,
                                        latestStart,
                                        comparisonEnd,
                                        true);
                        data.previousDispatched = sumDirectorDaily(
                                        data.dailyRows,
                                        previousStart,
                                        previousEnd,
                                        false);
                        data.latestDispatched = sumDirectorDaily(
                                        data.dailyRows,
                                        latestStart,
                                        comparisonEnd,
                                        false);

                        data.packingWow = directorGrowth(
                                        data.previousPacked,
                                        data.latestPacked);
                        data.dispatchWow = directorGrowth(
                                        data.previousDispatched,
                                        data.latestDispatched);
                        data.throughputWow = directorGrowth(
                                        data.previousPacked + data.previousDispatched,
                                        data.latestPacked + data.latestDispatched);
                }

                Set<String> rawClients = new HashSet<>();
                Set<String> normalizedClients = new HashSet<>();

                List<Object> clientSources = new ArrayList<>();
                clientSources.addAll(agingRows);
                clientSources.addAll(packingRows);
                clientSources.addAll(dispatchRows);

                for (Object row : clientSources) {
                        String client = text(
                                        row,
                                        "clientName",
                                        "client");

                        if (isDirectorBlank(client)) {
                                continue;
                        }

                        rawClients.add(client);
                        normalizedClients.add(
                                        client.trim()
                                                        .replaceAll("\\s+", " ")
                                                        .toUpperCase(Locale.ROOT));
                }

                data.rawClientLabels = rawClients.size();
                data.normalizedClientLabels = normalizedClients.size();

                for (MasterItemReportRow row : masterRows) {
                        Object progress = read(
                                        row,
                                        "packingProgress");

                        if (progress != null) {
                                try {
                                        double value = Double.parseDouble(
                                                        String.valueOf(progress)
                                                                        .replace("%", "")
                                                                        .trim());
                                        if (Math.abs(value) < 0.000001) {
                                                data.masterZeroProgress++;
                                        }
                                } catch (Exception ignored) {
                                }
                        }

                        String latestStatus = text(
                                        row,
                                        "latestStatus");
                        if (isDirectorBlank(latestStatus)) {
                                data.masterBlankLatestStatus++;
                        }
                }

                data.masterRows = masterRows.size();
                data.packedInRange = packingRows.size();
                data.dispatchedInRange = dispatchRows.size();
                data.netClearance = data.dispatchedInRange - data.packedInRange;
                data.packedPerDay = data.dailyRows.isEmpty()
                                ? 0
                                : (double) data.packedInRange / data.dailyRows.size();
                data.dispatchPackingRatio = data.packedInRange == 0
                                ? 0
                                : (double) data.dispatchedInRange / data.packedInRange;
                data.agedOver30Share = data.currentInventoryPackets == 0
                                ? 0
                                : (double) data.agedOver30 / data.currentInventoryPackets;
                data.ninetyPlusWarehouseShare = data.age90Plus == 0
                                ? 0
                                : (double) data.ninetyPlusInWarehouse / data.age90Plus;
                data.delayedDispatchShare = data.validPackToDispatchRows == 0
                                ? 0
                                : (double) data.dispatchOverSevenDays / data.validPackToDispatchRows;
                data.missingVehicleShare = data.dispatchedInRange == 0
                                ? 0
                                : (double) data.missingVehicleRows / data.dispatchedInRange;

                data.actions.add(new DirectorAction(
                                data.age90Plus > 0 ? "CRITICAL" : "LOW",
                                "Reconcile and disposition the 90+ day inventory",
                                data.age90Plus + " rows are 90+ days; "
                                                + data.ninetyPlusInWarehouse
                                                + " are in warehouse",
                                "Stores + Dispatch",
                                "72 hours"));

                data.actions.add(new DirectorAction(
                                data.agedReadyToDispatch > 0 ? "HIGH" : "LOW",
                                "Create a client-wise dispatch plan for aged READY_TO_DISPATCH",
                                data.agedReadyToDispatch
                                                + " aged RTD rows are 31-90 days old",
                                "Dispatch",
                                "48 hours"));

                data.actions.add(new DirectorAction(
                                data.agedOver30Share >= 0.25
                                                ? "HIGH"
                                                : data.agedOver30 > 0
                                                                ? "MEDIUM"
                                                                : "LOW",
                                "Run >30-day inventory clean-out by top-risk clients",
                                percent1(data.agedOver30Share)
                                                + " of inventory packet rows are >30 days",
                                "Ops / Plant Heads",
                                "7 days"));

                data.actions.add(new DirectorAction(
                                data.negativeDispatchTimestamps > 0
                                                || data.missingVehicleShare >= 0.10
                                                                ? "HIGH"
                                                                : data.missingVehicleRows > 0
                                                                                || data.missingDriverRows > 0
                                                                                                ? "MEDIUM"
                                                                                                : "LOW",
                                "Tighten dispatch data controls",
                                data.negativeDispatchTimestamps
                                                + " negative timestamps; "
                                                + percent1(data.missingVehicleShare)
                                                + " vehicle field missing",
                                "IT + Dispatch",
                                "Immediate"));

                data.actions.add(new DirectorAction(
                                data.comparisonAvailable && data.packingWow < 0
                                                ? "MEDIUM"
                                                : "LOW",
                                "Protect packing capacity while dispatch catches up",
                                data.comparisonAvailable
                                                ? "Dispatch "
                                                                + signedPercent1(data.dispatchWow)
                                                                + " WoW, packing "
                                                                + signedPercent1(data.packingWow)
                                                : data.packedInRange
                                                                + " packets / "
                                                                + round3(kpis.packedVolumeCbm)
                                                                + " m³ packed in selected period",
                                "Packing",
                                "This week"));

                data.actions.add(new DirectorAction(
                                data.masterZeroProgress > 0
                                                || data.masterBlankLatestStatus > 0
                                                                ? "MEDIUM"
                                                                : "LOW",
                                "Repair Master Items progress / latest-status logic",
                                data.masterZeroProgress
                                                + "/"
                                                + data.masterRows
                                                + " rows show 0% progress; latest status blank on "
                                                + data.masterBlankLatestStatus,
                                "IT / Product",
                                "This sprint"));

                return data;
        }

        private void addDirectorDashboardSheet(
                        Workbook workbook,
                        LocalDateTime from,
                        LocalDateTime to,
                        DirectorData data,
                        KpiData kpis) {
                XSSFSheet sheet = (XSSFSheet) workbook.createSheet("Director Dashboard");
                sheet.setDisplayGridlines(false);
                sheet.createFreezePane(0, 4);
                sheet.setFitToPage(true);
                sheet.setAutobreaks(true);
                sheet.setRepeatingRows(CellRangeAddress.valueOf("1:3"));
                workbook.setPrintArea(
                                workbook.getSheetIndex(sheet),
                                0,
                                15,
                                0,
                                67);

                PrintSetup printSetup = sheet.getPrintSetup();
                printSetup.setLandscape(true);
                printSetup.setPaperSize(PrintSetup.A3_PAPERSIZE);
                printSetup.setFitWidth((short) 1);
                printSetup.setFitHeight((short) 1);

                for (int column = 0; column < 16; column++) {
                        sheet.setColumnWidth(column, 12 * 256);
                }

                CellStyle navyTitle = directorStyle(
                                workbook,
                                IndexedColors.DARK_BLUE,
                                IndexedColors.WHITE,
                                true,
                                20,
                                HorizontalAlignment.LEFT);

                CellStyle navySection = directorStyle(
                                workbook,
                                IndexedColors.DARK_BLUE,
                                IndexedColors.WHITE,
                                true,
                                10,
                                HorizontalAlignment.LEFT);

                CellStyle metaStyle = directorStyle(
                                workbook,
                                IndexedColors.DARK_BLUE,
                                IndexedColors.WHITE,
                                false,
                                9,
                                HorizontalAlignment.LEFT);

                sheet.addMergedRegion(new CellRangeAddress(0, 1, 0, 15));
                Row titleRow = sheet.createRow(0);
                titleRow.setHeightInPoints(26);
                Cell title = titleRow.createCell(0);
                title.setCellValue("DIRECTOR INVENTORY & DISPATCH PERFORMANCE REPORT");
                title.setCellStyle(navyTitle);
                Row titleSpacerRow = sheet.createRow(1);
                titleSpacerRow.setHeightInPoints(10);

                sheet.addMergedRegion(new CellRangeAddress(2, 2, 0, 15));
                Row metaRow = sheet.createRow(2);
                Cell meta = metaRow.createCell(0);
                meta.setCellValue(
                                "Reporting period: "
                                                + dateLabel(from)
                                                + " - "
                                                + dateLabel(to)
                                                + "  |  Snapshot: "
                                                + LocalDateTime.now(java.time.ZoneId.of("Asia/Kolkata"))
                                                                .format(DateTimeFormatter.ofPattern("dd MMM yyyy, HH:mm"))
                                                + " IST  |  Source: PackFlow Reports");
                meta.setCellStyle(metaStyle);

                List<DirectorKpiCard> cards = List.of(
                                new DirectorKpiCard(
                                                "CURRENT INVENTORY PACKETS",
                                                data.currentInventoryPackets,
                                                data.coreInventory
                                                                + " core states + "
                                                                + data.transitionInventory
                                                                + " transition-state rows",
                                                IndexedColors.LIGHT_CORNFLOWER_BLUE),
                                new DirectorKpiCard(
                                                "PACKED | "
                                                                + shortDirectorDate(from)
                                                                + "-"
                                                                + shortDirectorDate(to),
                                                data.packedInRange,
                                                oneDecimal(data.packedPerDay)
                                                                + " packets/day | "
                                                                + round3(kpis.packedVolumeCbm)
                                                                + " m³ packed",
                                                IndexedColors.LIGHT_GREEN),
                                new DirectorKpiCard(
                                                "DISPATCHED | "
                                                                + shortDirectorDate(from)
                                                                + "-"
                                                                + shortDirectorDate(to),
                                                data.dispatchedInRange,
                                                oneDecimal(data.dispatchPackingRatio * 100)
                                                                + "% of period packing throughput",
                                                IndexedColors.LIGHT_GREEN),
                                new DirectorKpiCard(
                                                "INVENTORY >30 DAYS",
                                                data.agedOver30,
                                                oneDecimal(data.agedOver30Share * 100)
                                                                + "% of current inventory packet rows",
                                                IndexedColors.ROSE),
                                new DirectorKpiCard(
                                                "INVENTORY 90+ DAYS",
                                                data.age90Plus,
                                                data.ninetyPlusInWarehouse
                                                                + " ("
                                                                + oneDecimal(data.ninetyPlusWarehouseShare * 100)
                                                                + "%) of 90+ rows are in warehouse",
                                                IndexedColors.ROSE),
                                new DirectorKpiCard(
                                                "NET CLEARANCE",
                                                data.netClearance,
                                                data.netClearance >= 0
                                                                ? "More dispatched than packed in the selected period"
                                                                : "Packing exceeded dispatch in the selected period",
                                                IndexedColors.LIGHT_GREEN),
                                new DirectorKpiCard(
                                                "MEDIAN PACK -> DISPATCH",
                                                oneDecimal(data.medianPackToDispatchDays) + " d",
                                                data.dispatchOverSevenDays
                                                                + " valid dispatches ("
                                                                + oneDecimal(data.delayedDispatchShare * 100)
                                                                + "%) took >7 days",
                                                IndexedColors.LIGHT_YELLOW),
                                new DirectorKpiCard(
                                                "UNIQUE CHALLANS",
                                                data.uniqueChallans,
                                                "Median "
                                                                + oneDecimal(data.medianPacketsPerChallan)
                                                                + " packets/challan; average "
                                                                + oneDecimal(data.averagePacketsPerChallan),
                                                IndexedColors.LIGHT_CORNFLOWER_BLUE));

                int[][] cardRanges = {
                                { 4, 7, 0, 3 },
                                { 4, 7, 4, 7 },
                                { 4, 7, 8, 11 },
                                { 4, 7, 12, 15 },
                                { 9, 12, 0, 3 },
                                { 9, 12, 4, 7 },
                                { 9, 12, 8, 11 },
                                { 9, 12, 12, 15 }
                };

                for (int i = 0; i < cards.size(); i++) {
                        int[] range = cardRanges[i];
                        writeDirectorKpiCard(
                                        workbook,
                                        sheet,
                                        range[0],
                                        range[1],
                                        range[2],
                                        range[3],
                                        cards.get(i));
                }

                sheet.addMergedRegion(new CellRangeAddress(14, 14, 0, 15));
                Row executiveTitleRow = sheet.createRow(14);
                Cell executiveTitle = executiveTitleRow.createCell(0);
                executiveTitle.setCellValue("EXECUTIVE READOUT - WHAT THE DIRECTOR NEEDS TO KNOW");
                executiveTitle.setCellStyle(navySection);

                List<DirectorReadout> readouts = List.of(
                                new DirectorReadout(
                                                "CLEARANCE / THROUGHPUT",
                                                List.of(
                                                                data.dispatchedInRange
                                                                                + " dispatched vs "
                                                                                + data.packedInRange
                                                                                + " packed -> net clearance of "
                                                                                + data.netClearance
                                                                                + ".",
                                                                data.comparisonAvailable
                                                                                ? "Latest completed week: dispatch "
                                                                                                + signedPercent1(data.dispatchWow)
                                                                                                + "; packing "
                                                                                                + signedPercent1(data.packingWow)
                                                                                                + "."
                                                                                : "Select at least 14 completed days for week-on-week comparison.",
                                                                data.comparisonAvailable
                                                                                ? "Total throughput "
                                                                                                + signedPercent1(data.throughputWow)
                                                                                                + "."
                                                                                : "Selected-period packed volume: "
                                                                                                + round3(kpis.packedVolumeCbm)
                                                                                                + " m³."),
                                                IndexedColors.LIGHT_GREEN),
                                new DirectorReadout(
                                                "AGING / CASH & SPACE RISK",
                                                List.of(
                                                                data.agedOver30
                                                                                + " inventory packet rows are >30 days ("
                                                                                + oneDecimal(data.agedOver30Share * 100)
                                                                                + "%).",
                                                                data.age90Plus
                                                                                + " are 90+ days; "
                                                                                + data.ninetyPlusInWarehouse
                                                                                + " are in warehouse.",
                                                                data.agedReadyToDispatch
                                                                                + " dispatch-ready rows are already 31-90 days old."),
                                                IndexedColors.ROSE),
                                new DirectorReadout(
                                                "FLOW / CAPACITY SIGNAL",
                                                List.of(
                                                                data.peakMovementDate == null
                                                                                ? "No movement data in selected period."
                                                                                : "Peak movement: "
                                                                                                + data.peakMovementDate.format(DATE_FORMAT)
                                                                                                + " with "
                                                                                                + data.peakMovement
                                                                                                + " movements.",
                                                                "Median pack-to-dispatch = "
                                                                                + oneDecimal(data.medianPackToDispatchDays)
                                                                                + " days; average = "
                                                                                + oneDecimal(data.averagePackToDispatchDays)
                                                                                + " days.",
                                                                data.comparisonAvailable
                                                                                ? "Dispatch "
                                                                                                + signedPercent1(data.dispatchWow)
                                                                                                + " WoW; packing "
                                                                                                + signedPercent1(data.packingWow)
                                                                                                + " WoW."
                                                                                : "Peak packing "
                                                                                                + data.peakPacking
                                                                                                + "; peak dispatch "
                                                                                                + data.peakDispatch
                                                                                                + "."),
                                                IndexedColors.LIGHT_YELLOW),
                                new DirectorReadout(
                                                "DATA / CONTROL SIGNAL",
                                                List.of(
                                                                data.negativeDispatchTimestamps
                                                                                + " dispatch rows have dispatch time before packing time.",
                                                                data.missingVehicleRows
                                                                                + " dispatch rows ("
                                                                                + oneDecimal(data.missingVehicleShare * 100)
                                                                                + "%) have no vehicle; "
                                                                                + data.missingDriverRows
                                                                                + " have no driver.",
                                                                "Client labels: "
                                                                                + data.rawClientLabels
                                                                                + " raw -> "
                                                                                + data.normalizedClientLabels
                                                                                + " after case/space normalization."),
                                                IndexedColors.LIGHT_CORNFLOWER_BLUE));

                int[][] readoutRanges = {
                                { 15, 19, 0, 3 },
                                { 15, 19, 4, 7 },
                                { 15, 19, 8, 11 },
                                { 15, 19, 12, 15 }
                };

                for (int i = 0; i < readouts.size(); i++) {
                        int[] range = readoutRanges[i];
                        writeDirectorReadout(
                                        workbook,
                                        sheet,
                                        range[0],
                                        range[1],
                                        range[2],
                                        range[3],
                                        readouts.get(i));
                }

                writeDirectorChartData(sheet, data);

                XSSFDrawing drawing = sheet.createDrawingPatriarch();

                if (!data.dailyRows.isEmpty()) {
                        createDirectorLineChart(
                                        sheet,
                                        drawing,
                                        0,
                                        21,
                                        8,
                                        38,
                                        "Daily Packing vs Dispatch Throughput",
                                        17,
                                        18,
                                        19,
                                        1,
                                        data.dailyRows.size());
                }

                createDirectorBarChart(
                                sheet,
                                drawing,
                                8,
                                21,
                                16,
                                38,
                                "Inventory Aging Profile",
                                21,
                                22,
                                1,
                                data.agingBars.size(),
                                "Items");

                createDirectorBarChart(
                                sheet,
                                drawing,
                                0,
                                39,
                                8,
                                56,
                                "Current Inventory Status Mix",
                                24,
                                25,
                                1,
                                data.statusBars.size(),
                                "Items");

                createDirectorBarChart(
                                sheet,
                                drawing,
                                8,
                                39,
                                16,
                                56,
                                "Selected-Period Dispatch by Plant",
                                27,
                                28,
                                1,
                                data.dispatchPlantBars.size(),
                                "Dispatched");

                sheet.addMergedRegion(new CellRangeAddress(57, 57, 0, 15));
                Row actionTitleRow = sheet.createRow(57);
                Cell actionTitle = actionTitleRow.createCell(0);
                actionTitle.setCellValue("DIRECTOR ACTION PRIORITIES");
                actionTitle.setCellStyle(navySection);

                String[] actionHeaders = {
                                "Priority",
                                "Decision / Action",
                                "Why Now",
                                "Owner",
                                "Suggested Timeframe"
                };

                int[][] headerRanges = {
                                { 0, 1 },
                                { 2, 7 },
                                { 8, 11 },
                                { 12, 13 },
                                { 14, 15 }
                };

                CellStyle actionHeaderStyle = directorStyle(
                                workbook,
                                IndexedColors.LIGHT_CORNFLOWER_BLUE,
                                IndexedColors.DARK_BLUE,
                                true,
                                9,
                                HorizontalAlignment.CENTER);

                Row actionHeaderRow = sheet.createRow(58);
                for (int i = 0; i < actionHeaders.length; i++) {
                        int startCol = headerRanges[i][0];
                        int endCol = headerRanges[i][1];
                        sheet.addMergedRegion(new CellRangeAddress(58, 58, startCol, endCol));
                        Cell cell = actionHeaderRow.createCell(startCol);
                        cell.setCellValue(actionHeaders[i]);
                        cell.setCellStyle(actionHeaderStyle);
                }

                int actionRowIndex = 59;
                for (DirectorAction action : data.actions) {
                        int startRow = actionRowIndex++;
                        int[][] ranges = {
                                        { 0, 1 },
                                        { 2, 7 },
                                        { 8, 11 },
                                        { 12, 13 },
                                        { 14, 15 }
                        };

                        for (int[] range : ranges) {
                                sheet.addMergedRegion(new CellRangeAddress(
                                                startRow,
                                                startRow,
                                                range[0],
                                                range[1]));
                        }

                        Row row = sheet.createRow(startRow);
                        row.setHeightInPoints(26);

                        IndexedColors rowColor = switch (action.priority) {
                                case "CRITICAL" -> IndexedColors.ROSE;
                                case "HIGH" -> IndexedColors.LIGHT_YELLOW;
                                case "LOW" -> IndexedColors.LIGHT_GREEN;
                                default -> IndexedColors.LIGHT_CORNFLOWER_BLUE;
                        };

                        CellStyle actionStyle = directorStyle(
                                        workbook,
                                        rowColor,
                                        IndexedColors.DARK_BLUE,
                                        false,
                                        8,
                                        HorizontalAlignment.LEFT);
                        actionStyle.setWrapText(true);

                        Cell priorityCell = row.createCell(0);
                        priorityCell.setCellValue(action.priority);
                        priorityCell.setCellStyle(actionStyle);

                        Cell actionCell = row.createCell(2);
                        actionCell.setCellValue(action.action);
                        actionCell.setCellStyle(actionStyle);

                        Cell whyCell = row.createCell(8);
                        whyCell.setCellValue(action.why);
                        whyCell.setCellStyle(actionStyle);

                        Cell ownerCell = row.createCell(12);
                        ownerCell.setCellValue(action.owner);
                        ownerCell.setCellStyle(actionStyle);

                        Cell timeframeCell = row.createCell(14);
                        timeframeCell.setCellValue(action.timeframe);
                        timeframeCell.setCellStyle(actionStyle);

                        for (int col = 0; col < 16; col++) {
                                Cell cell = row.getCell(
                                                col,
                                                Row.MissingCellPolicy.CREATE_NULL_AS_BLANK);
                                cell.setCellStyle(actionStyle);
                        }
                }

                sheet.addMergedRegion(new CellRangeAddress(67, 67, 0, 15));
                Row noteRow = sheet.createRow(67);
                Cell note = noteRow.createCell(0);
                note.setCellValue(
                                data.comparisonAvailable
                                                ? "Management note: week-on-week comparison uses completed periods "
                                                                + directorComparisonLabel(data)
                                                                + ". If the selected end date is today, today's partial activity is excluded."
                                                : "Management note: select at least 14 completed days to enable a full two-week comparison. Current inventory aging remains a live snapshot.");

                CellStyle noteStyle = workbook.createCellStyle();
                Font noteFont = workbook.createFont();
                noteFont.setItalic(true);
                noteFont.setFontHeightInPoints((short) 8);
                noteFont.setColor(IndexedColors.GREY_50_PERCENT.getIndex());
                noteStyle.setFont(noteFont);
                noteStyle.setWrapText(true);
                note.setCellStyle(noteStyle);

                for (int hiddenColumn = 17; hiddenColumn <= 28; hiddenColumn++) {
                        sheet.setColumnHidden(hiddenColumn, true);
                }
        }

        private void writeDirectorKpiCard(
                        Workbook workbook,
                        Sheet sheet,
                        int firstRow,
                        int lastRow,
                        int firstColumn,
                        int lastColumn,
                        DirectorKpiCard card) {
                sheet.addMergedRegion(new CellRangeAddress(
                                firstRow,
                                firstRow,
                                firstColumn,
                                lastColumn));
                sheet.addMergedRegion(new CellRangeAddress(
                                firstRow + 1,
                                firstRow + 2,
                                firstColumn,
                                lastColumn));
                sheet.addMergedRegion(new CellRangeAddress(
                                lastRow,
                                lastRow,
                                firstColumn,
                                lastColumn));

                CellStyle labelStyle = directorStyle(
                                workbook,
                                card.fill,
                                IndexedColors.DARK_BLUE,
                                true,
                                9,
                                HorizontalAlignment.LEFT);

                CellStyle valueStyle = directorStyle(
                                workbook,
                                card.fill,
                                IndexedColors.DARK_BLUE,
                                true,
                                20,
                                HorizontalAlignment.CENTER);

                CellStyle detailStyle = directorStyle(
                                workbook,
                                card.fill,
                                IndexedColors.GREY_50_PERCENT,
                                false,
                                8,
                                HorizontalAlignment.LEFT);
                detailStyle.setWrapText(true);

                for (int rowIndex = firstRow; rowIndex <= lastRow; rowIndex++) {
                        Row row = sheet.getRow(rowIndex);
                        if (row == null) {
                                row = sheet.createRow(rowIndex);
                        }

                        for (int col = firstColumn; col <= lastColumn; col++) {
                                Cell cell = row.getCell(col, Row.MissingCellPolicy.CREATE_NULL_AS_BLANK);
                                cell.setCellStyle(detailStyle);
                        }
                }

                Cell titleCell = sheet.getRow(firstRow).getCell(firstColumn);
                titleCell.setCellValue(card.title);
                titleCell.setCellStyle(labelStyle);

                Cell valueCell = sheet.getRow(firstRow + 1).getCell(firstColumn);
                if (card.value instanceof Number number) {
                        valueCell.setCellValue(number.doubleValue());
                } else {
                        valueCell.setCellValue(String.valueOf(card.value));
                }
                valueCell.setCellStyle(valueStyle);

                Cell detailCell = sheet.getRow(lastRow).getCell(firstColumn);
                detailCell.setCellValue(card.detail);
                detailCell.setCellStyle(detailStyle);
        }

        private void writeDirectorReadout(
                        Workbook workbook,
                        Sheet sheet,
                        int firstRow,
                        int lastRow,
                        int firstColumn,
                        int lastColumn,
                        DirectorReadout readout) {
                sheet.addMergedRegion(new CellRangeAddress(
                                firstRow,
                                firstRow,
                                firstColumn,
                                lastColumn));
                sheet.addMergedRegion(new CellRangeAddress(
                                firstRow + 1,
                                lastRow,
                                firstColumn,
                                lastColumn));

                CellStyle headingStyle = directorStyle(
                                workbook,
                                readout.fill,
                                IndexedColors.DARK_BLUE,
                                true,
                                9,
                                HorizontalAlignment.LEFT);

                CellStyle bodyStyle = directorStyle(
                                workbook,
                                readout.fill,
                                IndexedColors.DARK_BLUE,
                                false,
                                8,
                                HorizontalAlignment.LEFT);
                bodyStyle.setWrapText(true);
                bodyStyle.setVerticalAlignment(VerticalAlignment.TOP);

                Row headingRow = sheet.getRow(firstRow);
                if (headingRow == null) {
                        headingRow = sheet.createRow(firstRow);
                }
                Cell heading = headingRow.getCell(
                                firstColumn,
                                Row.MissingCellPolicy.CREATE_NULL_AS_BLANK);
                heading.setCellValue(readout.title);
                heading.setCellStyle(headingStyle);

                Row bodyRow = sheet.getRow(firstRow + 1);
                if (bodyRow == null) {
                        bodyRow = sheet.createRow(firstRow + 1);
                }
                Cell body = bodyRow.getCell(
                                firstColumn,
                                Row.MissingCellPolicy.CREATE_NULL_AS_BLANK);
                body.setCellValue(
                                readout.lines.stream()
                                                .map(line -> "• " + line)
                                                .reduce((a, b) -> a + "\n" + b)
                                                .orElse("-"));
                body.setCellStyle(bodyStyle);

                for (int rowIndex = firstRow; rowIndex <= lastRow; rowIndex++) {
                        Row row = sheet.getRow(rowIndex);
                        if (row == null) {
                                row = sheet.createRow(rowIndex);
                        }
                        for (int col = firstColumn; col <= lastColumn; col++) {
                                Cell cell = row.getCell(col, Row.MissingCellPolicy.CREATE_NULL_AS_BLANK);
                                if (rowIndex == firstRow) {
                                        cell.setCellStyle(headingStyle);
                                } else {
                                        cell.setCellStyle(bodyStyle);
                                }
                        }
                }
        }

        private CellStyle directorStyle(
                        Workbook workbook,
                        IndexedColors fill,
                        IndexedColors fontColor,
                        boolean bold,
                        int fontSize,
                        HorizontalAlignment alignment) {
                CellStyle style = workbook.createCellStyle();
                Font font = workbook.createFont();
                font.setBold(bold);
                font.setFontHeightInPoints((short) fontSize);
                font.setColor(fontColor.getIndex());
                style.setFont(font);
                style.setFillForegroundColor(fill.getIndex());
                style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
                style.setAlignment(alignment);
                style.setVerticalAlignment(VerticalAlignment.CENTER);
                style.setBorderBottom(BorderStyle.HAIR);
                style.setBorderTop(BorderStyle.HAIR);
                style.setBorderLeft(BorderStyle.HAIR);
                style.setBorderRight(BorderStyle.HAIR);
                return style;
        }

        private void writeDirectorChartData(
                        XSSFSheet sheet,
                        DirectorData data) {
                int dailyHeaderRow = 0;
                Row dailyHeader = sheet.getRow(dailyHeaderRow);
                if (dailyHeader == null) {
                        dailyHeader = sheet.createRow(dailyHeaderRow);
                }
                dailyHeader.createCell(17).setCellValue("Date");
                dailyHeader.createCell(18).setCellValue("Packed");
                dailyHeader.createCell(19).setCellValue("Dispatched");

                int rowIndex = 1;
                for (DirectorDailyPoint point : data.dailyRows) {
                        Row row = sheet.getRow(rowIndex);
                        if (row == null) {
                                row = sheet.createRow(rowIndex);
                        }
                        row.createCell(17).setCellValue(point.date.format(DateTimeFormatter.ofPattern("dd MMM")));
                        row.createCell(18).setCellValue(point.packed);
                        row.createCell(19).setCellValue(point.dispatched);
                        rowIndex++;
                }

                writeDirectorBarData(sheet, 21, 22, data.agingBars);
                writeDirectorBarData(sheet, 24, 25, data.statusBars);
                writeDirectorBarData(sheet, 27, 28, data.dispatchPlantBars);
        }

        private void writeDirectorBarData(
                        XSSFSheet sheet,
                        int categoryColumn,
                        int valueColumn,
                        List<DirectorBarPoint> rows) {
                Row header = sheet.getRow(0);
                if (header == null) {
                        header = sheet.createRow(0);
                }
                header.createCell(categoryColumn).setCellValue("Category");
                header.createCell(valueColumn).setCellValue("Value");

                int rowIndex = 1;
                for (DirectorBarPoint point : rows) {
                        Row row = sheet.getRow(rowIndex);
                        if (row == null) {
                                row = sheet.createRow(rowIndex);
                        }
                        row.createCell(categoryColumn).setCellValue(point.label);
                        row.createCell(valueColumn).setCellValue(point.value);
                        rowIndex++;
                }
        }

        private void createDirectorLineChart(
                        XSSFSheet sheet,
                        XSSFDrawing drawing,
                        int col1,
                        int row1,
                        int col2,
                        int row2,
                        String title,
                        int categoryColumn,
                        int packedColumn,
                        int dispatchedColumn,
                        int firstDataRow,
                        int dataCount) {
                if (dataCount <= 0) {
                        return;
                }

                XSSFClientAnchor anchor = drawing.createAnchor(
                                0,
                                0,
                                0,
                                0,
                                col1,
                                row1,
                                col2,
                                row2);
                XSSFChart chart = drawing.createChart(anchor);
                chart.setTitleText(title);
                chart.setTitleOverlay(false);

                XDDFCategoryAxis bottomAxis = chart.createCategoryAxis(AxisPosition.BOTTOM);
                XDDFValueAxis leftAxis = chart.createValueAxis(AxisPosition.LEFT);
                leftAxis.setCrosses(AxisCrosses.AUTO_ZERO);

                int lastDataRow = firstDataRow + dataCount - 1;

                XDDFDataSource<String> categories = XDDFDataSourcesFactory.fromStringCellRange(
                                sheet,
                                new CellRangeAddress(
                                                firstDataRow,
                                                lastDataRow,
                                                categoryColumn,
                                                categoryColumn));

                XDDFNumericalDataSource<Double> packed = XDDFDataSourcesFactory.fromNumericCellRange(
                                sheet,
                                new CellRangeAddress(
                                                firstDataRow,
                                                lastDataRow,
                                                packedColumn,
                                                packedColumn));

                XDDFNumericalDataSource<Double> dispatched = XDDFDataSourcesFactory.fromNumericCellRange(
                                sheet,
                                new CellRangeAddress(
                                                firstDataRow,
                                                lastDataRow,
                                                dispatchedColumn,
                                                dispatchedColumn));

                XDDFLineChartData chartData = (XDDFLineChartData) chart.createData(
                                ChartTypes.LINE,
                                bottomAxis,
                                leftAxis);

                XDDFLineChartData.Series packedSeries = (XDDFLineChartData.Series) chartData.addSeries(
                                categories,
                                packed);
                packedSeries.setTitle("Packed", null);
                packedSeries.setMarkerStyle(MarkerStyle.NONE);

                XDDFLineChartData.Series dispatchedSeries = (XDDFLineChartData.Series) chartData.addSeries(
                                categories,
                                dispatched);
                dispatchedSeries.setTitle("Dispatched", null);
                dispatchedSeries.setMarkerStyle(MarkerStyle.NONE);

                chart.plot(chartData);
                chart.getOrAddLegend().setPosition(LegendPosition.BOTTOM);
        }

        private void createDirectorBarChart(
                        XSSFSheet sheet,
                        XSSFDrawing drawing,
                        int col1,
                        int row1,
                        int col2,
                        int row2,
                        String title,
                        int categoryColumn,
                        int valueColumn,
                        int firstDataRow,
                        int dataCount,
                        String seriesTitle) {
                if (dataCount <= 0) {
                        return;
                }

                XSSFClientAnchor anchor = drawing.createAnchor(
                                0,
                                0,
                                0,
                                0,
                                col1,
                                row1,
                                col2,
                                row2);
                XSSFChart chart = drawing.createChart(anchor);
                chart.setTitleText(title);
                chart.setTitleOverlay(false);

                XDDFCategoryAxis bottomAxis = chart.createCategoryAxis(AxisPosition.BOTTOM);
                XDDFValueAxis leftAxis = chart.createValueAxis(AxisPosition.LEFT);
                leftAxis.setCrosses(AxisCrosses.AUTO_ZERO);

                int lastDataRow = firstDataRow + dataCount - 1;

                XDDFDataSource<String> categories = XDDFDataSourcesFactory.fromStringCellRange(
                                sheet,
                                new CellRangeAddress(
                                                firstDataRow,
                                                lastDataRow,
                                                categoryColumn,
                                                categoryColumn));

                XDDFNumericalDataSource<Double> values = XDDFDataSourcesFactory.fromNumericCellRange(
                                sheet,
                                new CellRangeAddress(
                                                firstDataRow,
                                                lastDataRow,
                                                valueColumn,
                                                valueColumn));

                XDDFBarChartData chartData = (XDDFBarChartData) chart.createData(
                                ChartTypes.BAR,
                                bottomAxis,
                                leftAxis);
                chartData.setBarDirection(BarDirection.COL);
                chartData.setBarGrouping(BarGrouping.CLUSTERED);
                chartData.setVaryColors(false);

                XDDFBarChartData.Series series = (XDDFBarChartData.Series) chartData.addSeries(
                                categories,
                                values);
                series.setTitle(seriesTitle, null);

                chart.plot(chartData);
        }

        private long sumDirectorDaily(
                        List<DirectorDailyPoint> rows,
                        LocalDate from,
                        LocalDate to,
                        boolean packed) {
                return rows.stream()
                                .filter(row -> !row.date.isBefore(from)
                                                && !row.date.isAfter(to))
                                .mapToLong(row -> packed ? row.packed : row.dispatched)
                                .sum();
        }

        private double directorGrowth(
                        long previous,
                        long current) {
                if (previous <= 0) {
                        return 0;
                }

                return (double) (current - previous) / previous;
        }

        private double medianDouble(
                        List<Double> values) {
                if (values == null || values.isEmpty()) {
                        return 0;
                }

                List<Double> sorted = values.stream()
                                .filter(Objects::nonNull)
                                .filter(Double::isFinite)
                                .sorted()
                                .toList();

                if (sorted.isEmpty()) {
                        return 0;
                }

                int middle = sorted.size() / 2;
                if (sorted.size() % 2 == 0) {
                        return (sorted.get(middle - 1) + sorted.get(middle)) / 2.0;
                }

                return sorted.get(middle);
        }

        private String directorStatus(
                        Object row) {
                String value = text(
                                row,
                                "status",
                                "itemStatus",
                                "currentStatus",
                                "dispatchStatus");

                return value == null
                                ? "UNKNOWN"
                                : value.trim().toUpperCase(Locale.ROOT);
        }

        private boolean isDirectorBlank(
                        String value) {
                if (value == null) {
                        return true;
                }

                String clean = value.trim();
                return clean.isBlank()
                                || "-".equals(clean)
                                || "NULL".equalsIgnoreCase(clean)
                                || "UNASSIGNED".equalsIgnoreCase(clean);
        }

        private String oneDecimal(
                        double value) {
                return String.format(Locale.US, "%.1f", value);
        }

        private String signedPercent1(
                        double value) {
                return String.format(
                                Locale.US,
                                "%+.1f%%",
                                value * 100);
        }

        private String shortDirectorDate(
                        LocalDateTime value) {
                if (value == null) {
                        return "-";
                }

                return value.format(DateTimeFormatter.ofPattern("dd MMM"));
        }

        private String directorComparisonLabel(
                        DirectorData data) {
                if (!data.comparisonAvailable) {
                        return "insufficient completed periods";
                }

                DateTimeFormatter formatter = DateTimeFormatter.ofPattern("dd MMM");
                return data.previousStart.format(formatter)
                                + "-"
                                + data.previousEnd.format(formatter)
                                + " vs "
                                + data.latestStart.format(formatter)
                                + "-"
                                + data.latestEnd.format(formatter);
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

        private static class DirectorData {
                long currentInventoryPackets;
                long coreInventory;
                long transitionInventory;
                long packedInRange;
                long dispatchedInRange;
                long agedOver30;
                long age0To7;
                long age8To30;
                long age31To90;
                long age90Plus;
                long ninetyPlusInWarehouse;
                long agedReadyToDispatch;
                long netClearance;
                long validPackToDispatchRows;
                long dispatchOverSevenDays;
                long uniqueChallans;
                long missingVehicleRows;
                long missingDriverRows;
                long negativeDispatchTimestamps;
                long missingPackingDateRows;
                long rawClientLabels;
                long normalizedClientLabels;
                long masterRows;
                long masterZeroProgress;
                long masterBlankLatestStatus;
                long peakMovement;
                long peakPacking;
                long peakDispatch;
                long previousPacked;
                long latestPacked;
                long previousDispatched;
                long latestDispatched;
                double packedPerDay;
                double dispatchPackingRatio;
                double agedOver30Share;
                double ninetyPlusWarehouseShare;
                double medianPackToDispatchDays;
                double averagePackToDispatchDays;
                double delayedDispatchShare;
                double averagePacketsPerChallan;
                double medianPacketsPerChallan;
                double missingVehicleShare;
                double packingWow;
                double dispatchWow;
                double throughputWow;
                boolean comparisonAvailable;
                LocalDate peakMovementDate;
                LocalDate peakPackingDate;
                LocalDate peakDispatchDate;
                LocalDate previousStart;
                LocalDate previousEnd;
                LocalDate latestStart;
                LocalDate latestEnd;
                List<DirectorDailyPoint> dailyRows = new ArrayList<>();
                List<DirectorBarPoint> agingBars = new ArrayList<>();
                List<DirectorBarPoint> statusBars = new ArrayList<>();
                List<DirectorBarPoint> dispatchPlantBars = new ArrayList<>();
                List<DirectorAction> actions = new ArrayList<>();
        }

        private static class DirectorDailyPoint {
                final LocalDate date;
                long packed;
                long dispatched;

                DirectorDailyPoint(
                                LocalDate date,
                                long packed,
                                long dispatched) {
                        this.date = date;
                        this.packed = packed;
                        this.dispatched = dispatched;
                }

                long total() {
                        return packed + dispatched;
                }
        }

        private static class DirectorBarPoint {
                final String label;
                final long value;

                DirectorBarPoint(
                                String label,
                                long value) {
                        this.label = label;
                        this.value = value;
                }
        }

        private static class DirectorAction {
                final String priority;
                final String action;
                final String why;
                final String owner;
                final String timeframe;

                DirectorAction(
                                String priority,
                                String action,
                                String why,
                                String owner,
                                String timeframe) {
                        this.priority = priority;
                        this.action = action;
                        this.why = why;
                        this.owner = owner;
                        this.timeframe = timeframe;
                }
        }

        private static class DirectorKpiCard {
                final String title;
                final Object value;
                final String detail;
                final IndexedColors fill;

                DirectorKpiCard(
                                String title,
                                Object value,
                                String detail,
                                IndexedColors fill) {
                        this.title = title;
                        this.value = value;
                        this.detail = detail;
                        this.fill = fill;
                }
        }

        private static class DirectorReadout {
                final String title;
                final List<String> lines;
                final IndexedColors fill;

                DirectorReadout(
                                String title,
                                List<String> lines,
                                IndexedColors fill) {
                        this.title = title;
                        this.lines = lines;
                        this.fill = fill;
                }
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