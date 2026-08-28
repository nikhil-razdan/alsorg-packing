package com.alsorg.packing.reporting.export;

import java.io.ByteArrayOutputStream;
import java.lang.reflect.Field;
import java.lang.reflect.Modifier;
import java.util.Arrays;
import java.util.List;

import org.apache.poi.ss.usermodel.BorderStyle;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.HorizontalAlignment;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.ss.util.WorkbookUtil;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;

public final class ExcelExportUtil {

    private static final int MAX_AUTOSIZE_ROWS = 2500;
    private static final int MAX_COLUMN_WIDTH = 12000;

    private ExcelExportUtil() {
    }

    public static <T> byte[] exportToExcel(
            List<T> rows,
            String sheetName) {
        try (Workbook workbook = new XSSFWorkbook();
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {

            Sheet sheet = workbook.createSheet(safeSheetName(sheetName));

            CellStyle headerStyle = workbook.createCellStyle();
            Font headerFont = workbook.createFont();
            headerFont.setBold(true);
            headerFont.setColor(IndexedColors.WHITE.getIndex());
            headerStyle.setFont(headerFont);
            headerStyle.setFillForegroundColor(IndexedColors.DARK_BLUE.getIndex());
            headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            headerStyle.setAlignment(HorizontalAlignment.CENTER);
            headerStyle.setBorderBottom(BorderStyle.THIN);

            CellStyle dataStyle = workbook.createCellStyle();
            dataStyle.setBorderBottom(BorderStyle.THIN);

            Field[] fields = resolveFields(rows);

            if (fields.length == 0) {
                Row row = sheet.createRow(0);
                Cell cell = row.createCell(0);
                cell.setCellValue("No data available for this report.");
                workbook.write(out);
                return out.toByteArray();
            }

            Row header = sheet.createRow(0);

            for (int i = 0; i < fields.length; i++) {
                Cell cell = header.createCell(i);
                cell.setCellValue(toHeader(fields[i].getName()));
                cell.setCellStyle(headerStyle);
                fields[i].trySetAccessible();
            }

            int rowIdx = 1;

            if (rows != null) {
                for (T rowData : rows) {
                    if (rowData == null) {
                        continue;
                    }

                    Row row = sheet.createRow(rowIdx++);

                    for (int i = 0; i < fields.length; i++) {
                        Cell cell = row.createCell(i);
                        Object value = fields[i].get(rowData);
                        writeCell(cell, value);
                        cell.setCellStyle(dataStyle);
                    }
                }
            }

            sheet.setAutoFilter(new CellRangeAddress(
                    0,
                    Math.max(0, rowIdx - 1),
                    0,
                    fields.length - 1));
            sheet.createFreezePane(0, 1);

            boolean large = rows != null && rows.size() > MAX_AUTOSIZE_ROWS;

            for (int i = 0; i < fields.length; i++) {
                if (large) {
                    sheet.setColumnWidth(i, 5200);
                } else {
                    sheet.autoSizeColumn(i);
                    sheet.setColumnWidth(
                            i,
                            Math.min(sheet.getColumnWidth(i) + 800, MAX_COLUMN_WIDTH));
                }
            }

            workbook.write(out);
            return out.toByteArray();

        } catch (Exception exception) {
            throw new IllegalStateException("Excel export failed", exception);
        }
    }

    private static Field[] resolveFields(List<?> rows) {
        if (rows == null || rows.isEmpty()) {
            return new Field[0];
        }

        Object sample = rows.stream()
                .filter(java.util.Objects::nonNull)
                .findFirst()
                .orElse(null);

        if (sample == null) {
            return new Field[0];
        }

        return Arrays.stream(sample.getClass().getDeclaredFields())
                .filter(field -> !field.isSynthetic())
                .filter(field -> !Modifier.isStatic(field.getModifiers()))
                .toArray(Field[]::new);
    }

    private static void writeCell(
            Cell cell,
            Object value) {
        if (value == null) {
            cell.setCellValue("");
            return;
        }

        if (value instanceof Number number) {
            cell.setCellValue(number.doubleValue());
            return;
        }

        if (value instanceof Boolean bool) {
            cell.setCellValue(bool);
            return;
        }

        cell.setCellValue(safeSpreadsheetText(String.valueOf(value)));
    }

    private static String safeSpreadsheetText(String value) {
        if (value == null) {
            return "";
        }

        String text = value
                .replace("\u0000", "")
                .replace("\r", " ")
                .replace("\n", " ")
                .trim();

        if (text.isEmpty()) {
            return "";
        }

        if ("-".equals(text)) {
            return text;
        }

        char first = text.charAt(0);
        if (first == '=' || first == '+' || first == '-' || first == '@') {
            return "'" + text;
        }

        return text;
    }

    private static String safeSheetName(String value) {
        String clean = value == null || value.isBlank()
                ? "Report"
                : value.trim();

        String safe = WorkbookUtil.createSafeSheetName(clean, '_');
        return safe == null || safe.isBlank() ? "Report" : safe;
    }

    private static String toHeader(String fieldName) {
        if (fieldName == null || fieldName.isBlank()) {
            return "COLUMN";
        }

        return fieldName
                .replaceAll("([a-z0-9])([A-Z])", "$1 $2")
                .replace('_', ' ')
                .trim()
                .toUpperCase(java.util.Locale.ROOT);
    }
}
