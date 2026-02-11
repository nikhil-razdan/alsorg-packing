package com.alsorg.packing.reporting.export;

import java.io.ByteArrayOutputStream;
import java.lang.reflect.Field;
import java.util.List;

import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;

public class ExcelExportUtil {

    public static <T> byte[] exportToExcel(
            List<T> rows,
            String sheetName
    ) {
        try (Workbook workbook = new XSSFWorkbook()) {

            Sheet sheet = workbook.createSheet(sheetName);

            if (rows == null || rows.isEmpty()) {
                return new byte[0];
            }

            Field[] fields = rows.get(0).getClass().getDeclaredFields();

            // Header row
            Row header = sheet.createRow(0);
            for (int i = 0; i < fields.length; i++) {
                Cell cell = header.createCell(i);
                cell.setCellValue(fields[i].getName());
            }

            // Data rows
            int rowIdx = 1;
            for (T rowData : rows) {
                Row row = sheet.createRow(rowIdx++);
                for (int i = 0; i < fields.length; i++) {
                    fields[i].setAccessible(true);
                    Object value = fields[i].get(rowData);
                    row.createCell(i)
                       .setCellValue(value != null ? value.toString() : "");
                }
            }

            // Autosize
            for (int i = 0; i < fields.length; i++) {
                sheet.autoSizeColumn(i);
            }

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            workbook.write(out);
            return out.toByteArray();

        } catch (Exception e) {
            throw new RuntimeException("Excel export failed", e);
        }
    }
}
