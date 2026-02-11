package com.alsorg.packing.reporting.service;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;

import org.springframework.stereotype.Service;

import com.alsorg.packing.reporting.dto.CombinedReportRow;
import com.alsorg.packing.reporting.dto.DispatchReportRow;
import com.alsorg.packing.reporting.dto.PackingReportRow;
import com.alsorg.packing.reporting.export.ExcelExportUtil;

@Service
public class ReportExportService {

    public byte[] exportDispatchCsv(List<DispatchReportRow> rows) {
        StringBuilder sb = new StringBuilder();
        sb.append("Zoho Item ID,Item Name,Client,Dispatched At,Dispatched By\n");

        for (DispatchReportRow r : rows) {
            sb.append(r.getZohoItemId()).append(",")
              .append(r.getItemName()).append(",")
              .append(r.getClientName()).append(",")
              .append(r.getDispatchedAt()).append(",")
              .append(r.getDispatchedBy()).append("\n");
        }

        return sb.toString().getBytes(StandardCharsets.UTF_8);
    }
    
    public byte[] exportDispatchExcel(List<DispatchReportRow> rows) {
        return ExcelExportUtil.exportToExcel(
                rows,
                "Dispatch Report"
        );
    }

    public byte[] exportPackingExcel(List<PackingReportRow> rows) {
        return ExcelExportUtil.exportToExcel(
                rows,
                "Packing Report"
        );
    }
    
    public byte[] exportCombinedExcel(List<CombinedReportRow> rows) {
        return ExcelExportUtil.exportToExcel(
                rows,
                "Packing + Dispatch Report"
        );
    }
    
    public byte[] exportPackingCsv(List<PackingReportRow> rows) {

        StringBuilder sb = new StringBuilder();

        sb.append("Zoho Item ID,Item Name,Client,Packed At,Packed By\n");

        for (PackingReportRow r : rows) {
            sb.append(r.getZohoItemId()).append(",")
              .append(r.getItemName()).append(",")
              .append(r.getClientName()).append(",")
              .append(r.getPackedAt()).append(",")
              .append(r.getPackedBy()).append("\n");
        }

        return sb.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8);
    }
}
