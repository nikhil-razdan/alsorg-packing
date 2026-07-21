package com.alsorg.packing.reporting.service;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

import org.springframework.stereotype.Service;

import com.alsorg.packing.reporting.dto.CombinedReportRow;
import com.alsorg.packing.reporting.dto.DispatchReportRow;
import com.alsorg.packing.reporting.dto.PackingReportRow;
import com.alsorg.packing.reporting.export.ExcelExportUtil;

@Service
public class ReportExportService {

    private static final DateTimeFormatter DATE_TIME_FORMAT = DateTimeFormatter.ofPattern(
            "dd MMM yyyy HH:mm");

    public byte[] exportDispatchCsv(
            List<DispatchReportRow> rows) {
        StringBuilder csv = new StringBuilder();

        appendCsvRow(
                csv,
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
                "Status",
                "Packing Date",
                "Packed By",
                "Dispatch Date",
                "Dispatched By",
                "Challan No.",
                "Driver",
                "Vehicle",
                "Remarks");

        if (rows != null) {
            int serialNumber = 1;

            for (DispatchReportRow row : rows) {
                appendCsvRow(
                        csv,
                        serialNumber++,
                        row.getZohoItemId(),
                        row.getPdNo(),
                        row.getDrawingNo(),
                        row.getSku(),
                        row.getItemName(),
                        row.getDescription(),
                        row.getClientName(),
                        row.getClientAddress(),
                        row.getPlantCode(),
                        row.getFloor(),
                        row.getArea(),
                        row.getWarehouseCode(),
                        row.getPacketNumber(),
                        row.getPacketName(),
                        row.getQuantity(),
                        row.getStatus(),
                        formatDateTime(
                                row.getPackedAt()),
                        row.getPackedBy(),
                        formatDateTime(
                                row.getDispatchedAt()),
                        row.getDispatchedBy(),
                        row.getChallanNumber(),
                        row.getDriverName(),
                        row.getVehicleNumber(),
                        row.getRemarks());
            }
        }

        /*
         * UTF-8 BOM allows Microsoft Excel to open the
         * CSV with correct UTF-8 character recognition.
         */
        return ("\uFEFF" + csv)
                .getBytes(
                        StandardCharsets.UTF_8);
    }

    public byte[] exportDispatchExcel(
            List<DispatchReportRow> rows) {
        return ExcelExportUtil.exportToExcel(
                rows,
                "Dispatch Report");
    }

    public byte[] exportPackingExcel(
            List<PackingReportRow> rows) {
        return ExcelExportUtil.exportToExcel(
                rows,
                "Packing Report");
    }

    public byte[] exportCombinedExcel(
            List<CombinedReportRow> rows) {
        return ExcelExportUtil.exportToExcel(
                rows,
                "Packing + Dispatch Report");
    }

    public byte[] exportPackingCsv(
            List<PackingReportRow> rows) {
        StringBuilder csv = new StringBuilder();

        appendCsvRow(
                csv,
                "Zoho Item ID",
                "Item Name",
                "Client",
                "Packet Number",
                "Packet Name",
                "Packed At",
                "Packed By");

        if (rows != null) {
            for (PackingReportRow row : rows) {
                appendCsvRow(
                        csv,
                        row.getZohoItemId(),
                        row.getItemName(),
                        row.getClientName(),
                        row.getPacketNumber(),
                        row.getPacketName(),
                        formatDateTime(
                                row.getPackedAt()),
                        row.getPackedBy());
            }
        }

        return ("\uFEFF" + csv)
                .getBytes(
                        StandardCharsets.UTF_8);
    }

    private void appendCsvRow(
            StringBuilder csv,
            Object... values) {
        for (int i = 0; i < values.length; i++) {
            if (i > 0) {
                csv.append(',');
            }

            csv.append(
                    escapeCsv(
                            values[i]));
        }

        csv.append('\n');
    }

    private String escapeCsv(
            Object value) {
        String text = value == null
                ? ""
                : String.valueOf(value);

        text = text
                .replace("\r", " ")
                .replace("\n", " ")
                .trim();

        return "\""
                + text.replace(
                        "\"",
                        "\"\"")
                + "\"";
    }

    private String formatDateTime(
            LocalDateTime value) {
        return value == null
                ? ""
                : value.format(
                        DATE_TIME_FORMAT);
    }
}