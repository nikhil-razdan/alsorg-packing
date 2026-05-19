package com.alsorg.packing.reporting.export;

import java.io.ByteArrayOutputStream;
import java.lang.reflect.Field;
import java.util.List;

import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;

public class ExcelExportUtil {

    public static <T> byte[] exportToExcel(List<T> rows, String sheetName) {

        try (Workbook workbook = new XSSFWorkbook();
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {

            Sheet sheet = workbook.createSheet(sheetName);

            /* ================= HEADER STYLE ================= */
            CellStyle headerStyle = workbook.createCellStyle();
            Font headerFont = workbook.createFont();
            headerFont.setBold(true);
            headerFont.setColor(IndexedColors.WHITE.getIndex());
            headerStyle.setFont(headerFont);
            headerStyle.setFillForegroundColor(IndexedColors.DARK_BLUE.getIndex());
            headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            headerStyle.setAlignment(HorizontalAlignment.CENTER);
            headerStyle.setBorderBottom(BorderStyle.THIN);

            /* ================= DATA STYLE ================= */
            CellStyle dataStyle = workbook.createCellStyle();
            dataStyle.setBorderBottom(BorderStyle.THIN);

            Field[] fields = null;

            if (rows != null && !rows.isEmpty()) {
                fields = rows.get(0).getClass().getDeclaredFields();
            }

            /* ================= HEADER ROW ================= */
            if (fields != null) {

                Row header = sheet.createRow(0);

                for (int i = 0; i < fields.length; i++) {

                    Cell cell = header.createCell(i);

                    cell.setCellValue(
                            fields[i].getName()
                                    .replaceAll("([A-Z])", " $1")
                                    .toUpperCase()
                    );

                    cell.setCellStyle(headerStyle);
                }

                /* ================= DATA ROWS ================= */

                int rowIdx = 1;

                for (T rowData : rows) {

                    Row row = sheet.createRow(rowIdx++);

                    for (int i = 0; i < fields.length; i++) {

                        fields[i].setAccessible(true);

                        Object value = fields[i].get(rowData);

                        Cell cell = row.createCell(i);

                        cell.setCellValue(value != null ? value.toString() : "");

                        cell.setCellStyle(dataStyle);
                    }
                }

                /* ================= UX ENHANCEMENTS ================= */

                sheet.setAutoFilter(
                        new org.apache.poi.ss.util.CellRangeAddress(
                                0, 0, 0, fields.length - 1
                        )
                );

                sheet.createFreezePane(0, 1);

                for (int i = 0; i < fields.length; i++) {
                    sheet.autoSizeColumn(i);
                }

            } else {

                /* If no data at all, create a simple message sheet */

                Row row = sheet.createRow(0);
                Cell cell = row.createCell(0);
                cell.setCellValue("No data available for this report.");
            }

            workbook.write(out);

            return out.toByteArray();

        } catch (Exception e) {

            throw new RuntimeException("Excel export failed", e);
        }
    }
}