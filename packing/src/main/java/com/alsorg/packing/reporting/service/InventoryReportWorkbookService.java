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

@Service
public class InventoryReportWorkbookService {

    private static final DateTimeFormatter DATE_FORMAT =
            DateTimeFormatter.ofPattern("dd MMM yyyy");

    private static final DateTimeFormatter DATE_TIME_FORMAT =
            DateTimeFormatter.ofPattern("dd MMM yyyy HH:mm");

    private final DashboardReportService dashboardService;
    private final PackingReportService packingService;
    private final DispatchReportService dispatchService;
    private final InventoryAgingReportService agingService;

    public InventoryReportWorkbookService(
            DashboardReportService dashboardService,
            PackingReportService packingService,
            DispatchReportService dispatchService,
            InventoryAgingReportService agingService
    ) {
        this.dashboardService = dashboardService;
        this.packingService = packingService;
        this.dispatchService = dispatchService;
        this.agingService = agingService;
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
            "Age Days"
    };
    
    private List<Object> row(
            Object... values
    ) {
        return new ArrayList<>(
                Arrays.asList(values)
        );
    }
    
    public byte[] exportInventoryReport(
            String reportType,
            LocalDateTime from,
            LocalDateTime to
    ) {
        String type = normalizeType(reportType);

        boolean includePacking =
                "inventory".equals(type)
                        || "combined".equals(type)
                        || "packing".equals(type);

        boolean includeDispatch =
                "inventory".equals(type)
                        || "combined".equals(type)
                        || "dispatch".equals(type);

        boolean includeAging =
                "inventory".equals(type)
                        || "combined".equals(type);

        DashboardStatsDTO stats =
                dashboardService.getDashboardStats();

        List<PackingReportRow> packingRows =
                includePacking
                        ? packingService.getPackingReport(from, to)
                        : List.of();

        List<DispatchReportRow> dispatchRows =
                includeDispatch
                        ? dispatchService.getDispatchReport(from, to)
                        : List.of();

        List<InventoryAgingRow> agingRows =
                includeAging
                        ? agingService.getInventoryAgingReport()
                        : List.of();

        try (
                Workbook workbook = new XSSFWorkbook();
                ByteArrayOutputStream out = new ByteArrayOutputStream()
        ) {
            CellStyle titleStyle = titleStyle(workbook);
            CellStyle headerStyle = headerStyle(workbook);
            CellStyle dataStyle = dataStyle(workbook);
            CellStyle warningStyle = warningStyle(workbook);

            KpiData kpis = buildKpis(
                    stats,
                    packingRows,
                    dispatchRows,
                    agingRows
            );

            List<List<Object>> dateWiseRows =
                    buildDateWiseRows(
                            packingRows,
                            dispatchRows
                    );

            List<List<Object>> packingUserRows =
                    buildPackingUserRows(
                            packingRows
                    );

            List<List<Object>> dispatchUserRows =
                    buildDispatchUserRows(
                            dispatchRows
                    );

            List<List<Object>> clientRows =
                    buildClientRows(
                            packingRows,
                            dispatchRows
                    );

            List<List<Object>> agingBucketRows =
                    buildAgingBucketRows(
                            agingRows
                    );
            
            List<List<Object>> packingItemPacketRows =
                    buildPackingItemPacketRows(
                            packingRows
                    );

            List<List<Object>> dispatchItemPacketRows =
                    buildDispatchItemPacketRows(
                            dispatchRows
                    );

            List<List<Object>> inventoryItemPacketRows =
                    buildInventoryItemPacketRows(
                            agingRows
                    );

            List<List<Object>> allItemPacketRows =
                    new ArrayList<>();

            allItemPacketRows.addAll(
                    inventoryItemPacketRows
            );

            allItemPacketRows.addAll(
                    packingItemPacketRows
            );

            allItemPacketRows.addAll(
                    dispatchItemPacketRows
            );

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
                    -1
            );

            addRowsSheet(
                    workbook,
                    "Date Wise",
                    "Date-wise Inventory Throughput",
                    new String[] {
                            "Date",
                            "Packed",
                            "Dispatched",
                            "Total"
                    },
                    dateWiseRows,
                    titleStyle,
                    headerStyle,
                    dataStyle,
                    warningStyle,
                    -1
            );

            if (includePacking) {
                addRowsSheet(
                        workbook,
                        "Packing User Wise",
                        "Packing User-wise Report",
                        new String[] {
                                "User",
                                "Packed",
                                "Clients"
                        },
                        packingUserRows,
                        titleStyle,
                        headerStyle,
                        dataStyle,
                        warningStyle,
                        -1
                );

                addRowsSheet(
                        workbook,
                        "Raw Packing",
                        "Raw Packing Data",
                        new String[] {
                                "Zoho Item ID",
                                "Item Name",
                                "Client",
                                "Packed At",
                                "Packed By"
                        },
                        buildRawPackingRows(packingRows),
                        titleStyle,
                        headerStyle,
                        dataStyle,
                        warningStyle,
                        -1
                );
                
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
                        -1
                );
            }

            if (includeDispatch) {
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
                        -1
                );

                addRowsSheet(
                        workbook,
                        "Raw Dispatch",
                        "Raw Dispatch Data",
                        new String[] {
                                "Zoho Item ID",
                                "Item Name",
                                "Client",
                                "Dispatched At",
                                "Dispatched By"
                        },
                        buildRawDispatchRows(dispatchRows),
                        titleStyle,
                        headerStyle,
                        dataStyle,
                        warningStyle,
                        -1
                );
                
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
                        -1
                );
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
                                "Dispatched",
                                "Total"
                        },
                        clientRows,
                        titleStyle,
                        headerStyle,
                        dataStyle,
                        warningStyle,
                        -1
                );

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
                        2
                );
                
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
                            -1
                    );

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
                            10
                    );
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
                        6
                );
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
                            dispatchItemPacketRows
                    ),
                    titleStyle,
                    headerStyle,
                    dataStyle,
                    warningStyle,
                    -1
            );

            workbook.write(out);

            return out.toByteArray();

        } catch (Exception e) {
            throw new RuntimeException(
                    "Professional inventory Excel export failed",
                    e
            );
        }
    }

    private String normalizeType(String type) {
        if (type == null || type.isBlank()) {
            return "inventory";
        }

        String value =
                type.trim().toLowerCase();

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
            List<InventoryAgingRow> agingRows
    ) {
        KpiData kpis = new KpiData();

        kpis.totalInventory =
                number(stats, "totalItems");

        kpis.warehouseItems =
                number(stats, "warehouseItems");

        kpis.readyToDispatch =
                number(stats, "readyToDispatchItems");

        kpis.readyItems =
                number(stats, "readyItems");

        kpis.packedItems =
                number(stats, "packedItems");

        kpis.dispatchedItems =
                number(stats, "dispatchedItems");

        kpis.pendingItems =
                number(stats, "pendingItems");

        if (kpis.pendingItems == 0) {
            kpis.pendingItems =
                    Math.max(
                            kpis.totalInventory
                                    - kpis.packedItems
                                    - kpis.dispatchedItems,
                            0
                    );
        }

        kpis.stickersGenerated =
                number(stats, "stickersGenerated");

        kpis.packedInRange =
                packingRows.size();

        kpis.dispatchedInRange =
                dispatchRows.size();

        kpis.agingItems =
                agingRows.size();

        kpis.criticalAging =
                agingRows.stream()
                        .filter(row -> getAgeDays(row) > 30)
                        .count();

        Set<String> clients = new HashSet<>();

        for (PackingReportRow row : packingRows) {
            clients.add(
                    text(row, "clientName", "client")
            );
        }

        for (DispatchReportRow row : dispatchRows) {
            clients.add(
                    text(row, "clientName", "client")
            );
        }

        clients.remove("-");
        clients.remove("");

        kpis.uniqueClients = clients.size();

        kpis.completionRate =
                kpis.totalInventory == 0
                        ? 0
                        : (double) kpis.dispatchedItems
                        / kpis.totalInventory;

        return kpis;
    }

    private List<List<Object>> buildKpiRows(
            KpiData kpis
    ) {
        return List.of(
                row(
                        "Inventory Items",
                        kpis.totalInventory,
                        "Warehouse + Ready To Dispatch + Ready"
                ),
                row(
                        "Warehouse Items",
                        kpis.warehouseItems,
                        "Current warehouse stock"
                ),
                row(
                        "Ready To Dispatch",
                        kpis.readyToDispatch,
                        "Items waiting for dispatch"
                ),
                row(
                        "Ready Items",
                        kpis.readyItems,
                        "Ready / processed stock"
                ),
                row(
                        "Packed Items",
                        kpis.packedItems,
                        "Sticker generated / packed stock"
                ),
                row(
                        "Dispatched Items",
                        kpis.dispatchedItems,
                        "Challan generated / dispatched stock"
                ),
                row(
                        "Pending Items",
                        kpis.pendingItems,
                        "Items still pending in flow"
                ),
                row(
                        "Stickers Generated",
                        kpis.stickersGenerated,
                        "Total labels printed"
                ),
                row(
                        "Packing In Selected Range",
                        kpis.packedInRange,
                        "Date-filtered packing activity"
                ),
                row(
                        "Dispatch In Selected Range",
                        kpis.dispatchedInRange,
                        "Date-filtered dispatch activity"
                ),
                row(
                        "Unique Clients",
                        kpis.uniqueClients,
                        "Clients involved in selected range"
                ),
                row(
                        "Critical Aging Items",
                        kpis.criticalAging,
                        "Inventory older than 30 days"
                ),
                row(
                        "Dispatch Completion Rate",
                        percent(kpis.completionRate),
                        "Dispatched items divided by total inventory"
                )
        );
    }

    private List<List<Object>> buildDateWiseRows(
            List<PackingReportRow> packingRows,
            List<DispatchReportRow> dispatchRows
    ) {
        Map<String, CountRow> map =
                new HashMap<>();

        for (PackingReportRow row : packingRows) {
            LocalDateTime date =
                    dateTime(row, "packedAt", "date");

            String key = dateKey(date);
            String label = dateLabel(date);

            CountRow current =
                    map.computeIfAbsent(
                            key,
                            k -> new CountRow(label)
                    );

            current.packed++;
            current.total++;
        }

        for (DispatchReportRow row : dispatchRows) {
            LocalDateTime date =
                    dateTime(row, "dispatchedAt", "date");

            String key = dateKey(date);
            String label = dateLabel(date);

            CountRow current =
                    map.computeIfAbsent(
                            key,
                            k -> new CountRow(label)
                    );

            current.dispatched++;
            current.total++;
        }

        return map.entrySet()
                .stream()
                .sorted((a, b) ->
                        b.getKey().compareTo(a.getKey()))
                .map(entry -> row(
                        entry.getValue().label,
                        entry.getValue().packed,
                        entry.getValue().dispatched,
                        entry.getValue().total
                ))
                .toList();
    }

    private List<List<Object>> buildPackingUserRows(
            List<PackingReportRow> rows
    ) {
        Map<String, UserCountRow> map =
                new HashMap<>();

        for (PackingReportRow row : rows) {
            String user =
                    text(row, "packedBy", "createdBy");

            UserCountRow current =
                    map.computeIfAbsent(
                            user,
                            UserCountRow::new
                    );

            current.count++;
            current.clients.add(
                    text(row, "clientName", "client")
            );
        }

        return map.values()
                .stream()
                .sorted((a, b) ->
                        Long.compare(b.count, a.count))
                .map(row -> row(
                        row.user,
                        row.count,
                        row.clients.size()
                ))
                .toList();
    }

    private List<List<Object>> buildDispatchUserRows(
            List<DispatchReportRow> rows
    ) {
        Map<String, UserCountRow> map =
                new HashMap<>();

        for (DispatchReportRow row : rows) {
            String user =
                    text(row, "dispatchedBy", "createdBy");

            UserCountRow current =
                    map.computeIfAbsent(
                            user,
                            UserCountRow::new
                    );

            current.count++;
            current.clients.add(
                    text(row, "clientName", "client")
            );
        }

        return map.values()
                .stream()
                .sorted((a, b) ->
                        Long.compare(b.count, a.count))
                .map(row -> row(
                        row.user,
                        row.count,
                        row.clients.size()
                ))
                .toList();
    }

    private List<List<Object>> buildClientRows(
            List<PackingReportRow> packingRows,
            List<DispatchReportRow> dispatchRows
    ) {
        Map<String, CountRow> map =
                new HashMap<>();

        for (PackingReportRow row : packingRows) {
            String client =
                    text(row, "clientName", "client");

            CountRow current =
                    map.computeIfAbsent(
                            client,
                            CountRow::new
                    );

            current.packed++;
            current.total++;
        }

        for (DispatchReportRow row : dispatchRows) {
            String client =
                    text(row, "clientName", "client");

            CountRow current =
                    map.computeIfAbsent(
                            client,
                            CountRow::new
                    );

            current.dispatched++;
            current.total++;
        }

        return map.values()
                .stream()
                .sorted((a, b) ->
                        Long.compare(b.total, a.total))
                .map(row -> row(
                        row.label,
                        row.packed,
                        row.dispatched,
                        row.total
                ))
                .toList();
    }

    private List<List<Object>> buildAgingBucketRows(
            List<InventoryAgingRow> rows
    ) {
        Map<String, Long> map =
                new HashMap<>();

        for (InventoryAgingRow row : rows) {
            String bucket = agingBucket(row);

            map.put(
                    bucket,
                    map.getOrDefault(bucket, 0L) + 1
            );
        }

        return map.entrySet()
                .stream()
                .sorted((a, b) ->
                        Long.compare(
                                b.getValue(),
                                a.getValue()
                        ))
                .map(entry -> row(
                        entry.getKey(),
                        entry.getValue()
                ))
                .toList();
    }

    private List<List<Object>> buildRawPackingRows(
            List<PackingReportRow> rows
    ) {
        List<List<Object>> result =
                new ArrayList<>();

        for (PackingReportRow row : rows) {
        	result.add(row(
        	        text(row, "zohoItemId"),
        	        text(row, "itemName"),
        	        text(row, "clientName", "client"),
        	        dateTimeLabel(
        	                dateTime(row, "packedAt")
        	        ),
        	        text(row, "packedBy")
        	));
        }

        return result;
    }

    private List<List<Object>> buildRawDispatchRows(
            List<DispatchReportRow> rows
    ) {
        List<List<Object>> result =
                new ArrayList<>();

        for (DispatchReportRow row : rows) {
        	result.add(row(
        	        text(row, "zohoItemId"),
        	        text(row, "itemName"),
        	        text(row, "clientName", "client"),
        	        dateTimeLabel(
        	                dateTime(row, "dispatchedAt")
        	        ),
        	        text(row, "dispatchedBy")
        	));
        }

        return result;
    }

    private List<List<Object>> buildRawAgingRows(
            List<InventoryAgingRow> rows
    ) {
        List<List<Object>> result =
                new ArrayList<>();

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
        	                        "date"
        	                )
        	        ),
        	        getAgeDays(row),
        	        agingBucket(row)
        	));
        }

        return result;
    }
    
    private List<List<Object>> buildPackingItemPacketRows(
            List<PackingReportRow> rows
    ) {
        List<List<Object>> result =
                new ArrayList<>();

        for (PackingReportRow row : rows) {
            result.add(row(
                    "Packing",
                    text(row, "zohoItemId", "itemId"),
                    text(row, "itemName", "name"),
                    text(row, "clientName", "client"),
                    packetNumber(row),
                    packetName(row),
                    "PACKED",
                    dateTimeLabel(
                            dateTime(row, "packedAt")
                    ),
                    text(row, "packedBy", "createdBy"),
                    "-"
            ));
        }

        return result;
    }

    private List<List<Object>> buildDispatchItemPacketRows(
            List<DispatchReportRow> rows
    ) {
        List<List<Object>> result =
                new ArrayList<>();

        for (DispatchReportRow row : rows) {
            result.add(row(
                    "Dispatch",
                    text(row, "zohoItemId", "itemId"),
                    text(row, "itemName", "name"),
                    text(row, "clientName", "client"),
                    packetNumber(row),
                    packetName(row),
                    "DISPATCHED",
                    dateTimeLabel(
                            dateTime(row, "dispatchedAt")
                    ),
                    text(row, "dispatchedBy", "createdBy"),
                    "-"
            ));
        }

        return result;
    }

    private List<List<Object>> buildInventoryItemPacketRows(
            List<InventoryAgingRow> rows
    ) {
        List<List<Object>> result =
                new ArrayList<>();

        for (InventoryAgingRow row : rows) {
            result.add(row(
                    "Inventory",
                    text(row, "zohoItemId", "itemId"),
                    text(row, "itemName", "name"),
                    text(row, "clientName", "client"),
                    packetNumber(row),
                    packetName(row),
                    text(row, "status", "itemStatus"),
                    dateTimeLabel(
                            dateTime(
                                    row,
                                    "createdAt",
                                    "receivedAt",
                                    "packedAt",
                                    "date"
                            )
                    ),
                    text(
                            row,
                            "createdBy",
                            "packedBy",
                            "dispatchedBy"
                    ),
                    getAgeDays(row)
            ));
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
            List<List<Object>> dispatchItemPacketRows
    ) {
        String topPacker =
                packingUserRows.isEmpty()
                        ? "-"
                        : packingUserRows.get(0).get(0)
                        + " - "
                        + packingUserRows.get(0).get(1)
                        + " packed";

        String topDispatcher =
                dispatchUserRows.isEmpty()
                        ? "-"
                        : dispatchUserRows.get(0).get(0)
                        + " - "
                        + dispatchUserRows.get(0).get(1)
                        + " dispatched";

        String busiestDate =
                dateWiseRows.isEmpty()
                        ? "-"
                        : dateWiseRows.get(0).get(0)
                        + " - "
                        + dateWiseRows.get(0).get(3)
                        + " total movements";

        String criticalBucket =
                agingBucketRows.isEmpty()
                        ? "-"
                        : agingBucketRows.get(0).get(0)
                        + " - "
                        + agingBucketRows.get(0).get(1)
                        + " items";

        return List.of(
                row(
                        "Top Packing User",
                        topPacker,
                        "Use this user as benchmark for packing productivity."
                ),
                row(
                        "Top Dispatch User",
                        topDispatcher,
                        "Review dispatch process and replicate best practices."
                ),
                row(
                        "Busiest Date",
                        busiestDate,
                        "Check manpower and dispatch planning for this date."
                ),
                row(
                        "Critical Aging Bucket",
                        criticalBucket,
                        "Prioritize old inventory for dispatch or warehouse review."
                ),
                row(
                        "Item / Packet Detail Rows",
                        allItemPacketRows.size(),
                        "Use this for full inventory, packing and dispatch packet-level traceability."
                ),
                row(
                        "Packing Item / Packet Rows",
                        packingItemPacketRows.size(),
                        "Use this to audit packed packets and item-wise user productivity."
                ),
                row(
                        "Dispatch Item / Packet Rows",
                        dispatchItemPacketRows.size(),
                        "Use this to validate dispatched packets against challan movement."
                ),
                row(
                        "Pending Items",
                        kpis.pendingItems,
                        kpis.pendingItems > 0
                                ? "Review pending queue and ownership."
                                : "Pending inventory is under control."
                ),
                row(
                        "Dispatch Completion Rate",
                        percent(kpis.completionRate),
                        kpis.completionRate >= 0.8
                                ? "Completion rate is healthy."
                                : "Completion rate needs improvement."
                )
        );
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
            int warningColumnOneBased
    ) {
        Sheet sheet =
                workbook.createSheet(
                        safeSheetName(sheetName)
                );

        sheet.addMergedRegion(
                new CellRangeAddress(
                        0,
                        0,
                        0,
                        headers.length - 1
                )
        );

        Row titleRow = sheet.createRow(0);
        titleRow.setHeightInPoints(24);

        Cell titleCell =
                titleRow.createCell(0);

        titleCell.setCellValue(title);
        titleCell.setCellStyle(titleStyle);

        sheet.createRow(1);

        Row headerRow = sheet.createRow(2);

        for (int i = 0; i < headers.length; i++) {
            Cell cell =
                    headerRow.createCell(i);

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
                Row row =
                        sheet.createRow(rowIndex++);

                for (int i = 0; i < headers.length; i++) {
                    Cell cell =
                            row.createCell(i);

                    Object value =
                            i < values.size()
                                    ? values.get(i)
                                    : "";

                    writeCell(cell, value);

                    if (
                            warningColumnOneBased > 0 &&
                            i + 1 == warningColumnOneBased &&
                            isWarningValue(value)
                    ) {
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
                        headers.length - 1
                )
        );

        sheet.createFreezePane(0, 3);

        for (int i = 0; i < headers.length; i++) {
            sheet.autoSizeColumn(i);
            sheet.setColumnWidth(
                    i,
                    Math.min(
                            sheet.getColumnWidth(i) + 1000,
                            9000
                    )
            );
        }
    }

    private boolean isWarningValue(Object value) {
        if (value == null) {
            return false;
        }

        try {
            return Double.parseDouble(
                    String.valueOf(value)
            ) > 0;
        } catch (Exception e) {
            return false;
        }
    }

    private void writeCell(
            Cell cell,
            Object value
    ) {
        if (value == null) {
            cell.setCellValue("");
            return;
        }

        if (value instanceof Number number) {
            cell.setCellValue(
                    number.doubleValue()
            );
            return;
        }

        if (value instanceof Boolean bool) {
            cell.setCellValue(bool);
            return;
        }

        cell.setCellValue(
                String.valueOf(value)
        );
    }

    private CellStyle titleStyle(
            Workbook workbook
    ) {
        CellStyle style =
                workbook.createCellStyle();

        Font font =
                workbook.createFont();

        font.setBold(true);
        font.setFontHeightInPoints((short) 18);
        font.setColor(
                IndexedColors.WHITE.getIndex()
        );

        style.setFont(font);
        style.setFillForegroundColor(
                IndexedColors.DARK_BLUE.getIndex()
        );
        style.setFillPattern(
                FillPatternType.SOLID_FOREGROUND
        );
        style.setAlignment(
                HorizontalAlignment.LEFT
        );
        style.setVerticalAlignment(
                VerticalAlignment.CENTER
        );

        return style;
    }

    private CellStyle headerStyle(
            Workbook workbook
    ) {
        CellStyle style =
                workbook.createCellStyle();

        Font font =
                workbook.createFont();

        font.setBold(true);
        font.setColor(
                IndexedColors.WHITE.getIndex()
        );

        style.setFont(font);
        style.setFillForegroundColor(
                IndexedColors.BLUE.getIndex()
        );
        style.setFillPattern(
                FillPatternType.SOLID_FOREGROUND
        );
        style.setAlignment(
                HorizontalAlignment.CENTER
        );
        style.setVerticalAlignment(
                VerticalAlignment.CENTER
        );
        style.setBorderBottom(
                BorderStyle.THIN
        );
        style.setBorderTop(
                BorderStyle.THIN
        );
        style.setBorderLeft(
                BorderStyle.THIN
        );
        style.setBorderRight(
                BorderStyle.THIN
        );

        return style;
    }

    private CellStyle dataStyle(
            Workbook workbook
    ) {
        CellStyle style =
                workbook.createCellStyle();

        style.setBorderBottom(
                BorderStyle.THIN
        );
        style.setBorderTop(
                BorderStyle.THIN
        );
        style.setBorderLeft(
                BorderStyle.THIN
        );
        style.setBorderRight(
                BorderStyle.THIN
        );
        style.setVerticalAlignment(
                VerticalAlignment.CENTER
        );

        return style;
    }

    private CellStyle warningStyle(
            Workbook workbook
    ) {
        CellStyle style =
                dataStyle(workbook);

        style.setFillForegroundColor(
                IndexedColors.LIGHT_YELLOW.getIndex()
        );
        style.setFillPattern(
                FillPatternType.SOLID_FOREGROUND
        );

        Font font =
                workbook.createFont();

        font.setBold(true);

        style.setFont(font);

        return style;
    }

    private String safeSheetName(
            String value
    ) {
        String cleaned =
                value.replaceAll(
                        "[\\\\/?*\\[\\]:]",
                        "-"
                );

        return cleaned.length() > 31
                ? cleaned.substring(0, 31)
                : cleaned;
    }

    private Object read(
            Object source,
            String... names
    ) {
        if (source == null) {
            return null;
        }

        Class<?> clazz =
                source.getClass();

        for (String name : names) {
            Object fromGetter =
                    readGetter(source, clazz, name);

            if (fromGetter != null) {
                return fromGetter;
            }

            Object fromField =
                    readField(source, clazz, name);

            if (fromField != null) {
                return fromField;
            }
        }

        return null;
    }

    private Object readGetter(
            Object source,
            Class<?> clazz,
            String name
    ) {
        String suffix =
                name.substring(0, 1).toUpperCase()
                        + name.substring(1);

        String[] methods = {
                "get" + suffix,
                "is" + suffix
        };

        for (String methodName : methods) {
            try {
                Method method =
                        clazz.getMethod(methodName);

                return method.invoke(source);
            } catch (Exception ignored) {
            }
        }

        return null;
    }

    private Object readField(
            Object source,
            Class<?> clazz,
            String name
    ) {
        Class<?> current = clazz;

        while (current != null) {
            try {
                Field field =
                        current.getDeclaredField(name);

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
            String... names
    ) {
        Object value =
                read(source, names);

        if (value == null) {
            return "-";
        }

        String text =
                String.valueOf(value).trim();

        return text.isBlank()
                ? "-"
                : text;
    }

    private long number(
            Object source,
            String... names
    ) {
        Object value =
                read(source, names);

        if (value == null) {
            return 0;
        }

        if (value instanceof Number number) {
            return number.longValue();
        }

        try {
            return Math.round(
                    Double.parseDouble(
                            String.valueOf(value)
                    )
            );
        } catch (Exception e) {
            return 0;
        }
    }

    private LocalDateTime dateTime(
            Object source,
            String... names
    ) {
        Object value =
                read(source, names);

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
                    java.time.ZoneId.systemDefault()
            );
        }

        try {
            return LocalDateTime.parse(
                    String.valueOf(value)
            );
        } catch (Exception ignored) {
        }

        try {
            return LocalDate.parse(
                    String.valueOf(value)
            ).atStartOfDay();
        } catch (Exception ignored) {
        }

        return null;
    }
    
    private String packetNumber(
            Object source
    ) {
        return text(
                source,
                "packetNumber",
                "packetNo",
                "packetCode",
                "packetId",
                "packetName"
        );
    }

    private String packetName(
            Object source
    ) {
        return text(
                source,
                "packetName",
                "packetTitle",
                "packetDescription",
                "packetType"
        );
    }

    private String dateKey(
            LocalDateTime date
    ) {
        if (date == null) {
            return "Unknown";
        }

        return date.toLocalDate().toString();
    }

    private String dateLabel(
            LocalDateTime date
    ) {
        if (date == null) {
            return "-";
        }

        return date.format(DATE_FORMAT);
    }

    private String dateTimeLabel(
            LocalDateTime date
    ) {
        if (date == null) {
            return "-";
        }

        return date.format(DATE_TIME_FORMAT);
    }

    private String percent(
            double value
    ) {
        return Math.round(value * 100) + "%";
    }

    private long getAgeDays(
            Object row
    ) {
        long direct =
                number(
                        row,
                        "ageDays",
                        "agingDays",
                        "daysInInventory",
                        "days"
                );

        if (direct > 0) {
            return direct;
        }

        LocalDateTime created =
                dateTime(
                        row,
                        "createdAt",
                        "receivedAt",
                        "packedAt",
                        "date"
                );

        if (created == null) {
            return 0;
        }

        return Math.max(
                java.time.Duration.between(
                        created,
                        LocalDateTime.now()
                ).toDays(),
                0
        );
    }

    private String agingBucket(
            Object row
    ) {
        String bucket =
                text(
                        row,
                        "agingBucket",
                        "bucket",
                        "ageBucket"
                );

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
        double completionRate;
    }

    private static class CountRow {
        String label;
        long packed;
        long dispatched;
        long total;

        CountRow(String label) {
            this.label = label;
        }
    }

    private static class UserCountRow {
        String user;
        long count;
        Set<String> clients =
                new HashSet<>();

        UserCountRow(String user) {
            this.user = user;
        }
    }
    
    
}