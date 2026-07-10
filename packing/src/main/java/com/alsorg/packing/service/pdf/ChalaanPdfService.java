package com.alsorg.packing.service.pdf;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDFont;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import java.time.LocalDateTime;

import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

import com.alsorg.packing.controller.dto.challan.CustomChallanItemRequest;
import com.alsorg.packing.controller.dto.challan.CustomChallanRequest;

@Service
public class ChalaanPdfService {

        private static final float PAGE_WIDTH = 600;
        private static final float PAGE_HEIGHT = 800;

        private static final float LEFT = 40;
        private static final float RIGHT = 560;

        private static final float TABLE_TOP = 620;
        private static final float TABLE_HEADER_BOTTOM = 600;
        private static final float TABLE_BOTTOM = 130;

        private static final float SR_X = 40;
        private static final float SR_RIGHT = 100;
        private static final float DESC_RIGHT = 420;
        private static final float REMARK_RIGHT = 560;

        private static final float FOOTER_TOP = 118;
        private static final float FOOTER_BOTTOM = 40;

        public byte[] generateChalaan(
                        ChalaanPdfData data) {
                List<ChalaanItem> items = data != null && data.getItems() != null
                                ? data.getItems()
                                : Collections.emptyList();

                ChalaanItem firstItem = !items.isEmpty()
                                ? items.get(0)
                                : null;

                String pdNo = buildAllPdNos(items);

                String clientName = firstItem != null
                                ? safe(firstItem.getClientName())
                                : "-";

                String address = firstItem != null
                                ? safe(firstItem.getClientAddress())
                                : safe(data != null ? data.getAddress() : null);

                String challanNo = safe(data != null ? data.getVoucherNo() : null);

                String driverName = safe(data != null ? data.getDriverName() : null);

                String vehicleNo = safe(data != null ? data.getVehicleNumber() : null);

                String date = formatChallanDateTime(
                                data != null ? data.getDispatchTime() : null);

                try (PDDocument doc = new PDDocument()) {
                        PDFont bold = PDType1Font.HELVETICA_BOLD;
                        PDFont regular = PDType1Font.HELVETICA;

                        PDPage page = new PDPage(new PDRectangle(PAGE_WIDTH, PAGE_HEIGHT));

                        doc.addPage(page);

                        PDPageContentStream cs = new PDPageContentStream(doc, page);

                        drawPageHeader(
                                        cs,
                                        bold,
                                        regular,
                                        pdNo,
                                        clientName,
                                        address,
                                        date,
                                        challanNo,
                                        driverName,
                                        vehicleNo);

                        float y = 580;
                        int sr = 1;

                        if (items.isEmpty()) {
                                drawText(
                                                cs,
                                                regular,
                                                10,
                                                110,
                                                y,
                                                "No items found for this challan");
                        }

                        for (ChalaanItem item : items) {
                                if (item == null) {
                                        continue;
                                }

                                String fullDesc = "PD No: " + safe(item.getPdNo()) + " | "
                                                + "Item: " + safe(item.getItemName()) + " | "
                                                + "Dwg No: " + safe(item.getDrawingNo()) + " | "
                                                + "Desc: " + safe(item.getDescription());

                                String remarks = safe(item.getRemarks());

                                int descLines = countWrappedLines(
                                                regular,
                                                10,
                                                300,
                                                fullDesc);

                                int remarksLines = countWrappedLines(
                                                regular,
                                                10,
                                                120,
                                                remarks);

                                int lineCount = Math.max(
                                                Math.max(descLines, remarksLines),
                                                1);

                                float rowHeight = Math.max(28, lineCount * 14 + 12);

                                if (y - rowHeight < TABLE_BOTTOM + 8) {
                                        drawFooter(cs, regular);
                                        cs.close();

                                        page = new PDPage(new PDRectangle(PAGE_WIDTH, PAGE_HEIGHT));

                                        doc.addPage(page);

                                        cs = new PDPageContentStream(doc, page);

                                        drawPageHeader(
                                                        cs,
                                                        bold,
                                                        regular,
                                                        pdNo,
                                                        clientName,
                                                        address,
                                                        date,
                                                        challanNo,
                                                        driverName,
                                                        vehicleNo);

                                        y = 580;
                                }

                                float rowTop = y;
                                float rowBottom = y - rowHeight;

                                drawText(
                                                cs,
                                                regular,
                                                10,
                                                55,
                                                rowTop,
                                                String.valueOf(sr));

                                drawWrappedText(
                                                cs,
                                                regular,
                                                10,
                                                110,
                                                rowTop,
                                                300,
                                                fullDesc);

                                drawWrappedText(
                                                cs,
                                                regular,
                                                10,
                                                430,
                                                rowTop,
                                                120,
                                                remarks);

                                drawLine(
                                                cs,
                                                LEFT,
                                                rowBottom,
                                                RIGHT,
                                                rowBottom);

                                y = rowBottom - 14;
                                sr++;
                        }

                        drawFooter(cs, regular);
                        cs.close();

                        ByteArrayOutputStream out = new ByteArrayOutputStream();

                        doc.save(out);

                        return out.toByteArray();

                } catch (IOException e) {
                        throw new RuntimeException("Failed to generate challan PDF", e);
                }
        }

        public byte[] generateCustomChalaan(
                        CustomChallanRequest request,
                        String challanNo,
                        String createdBy) {
                List<CustomChallanItemRequest> sourceItems = request != null && request.items() != null
                                ? request.items()
                                : Collections.emptyList();

                java.util.List<CustomChallanItemRequest> items = new java.util.ArrayList<>();

                for (CustomChallanItemRequest item : sourceItems) {
                        if (item == null) {
                                continue;
                        }

                        if (item.description() == null || item.description().trim().isBlank()) {
                                continue;
                        }

                        items.add(item);
                }

                if (items.isEmpty()) {
                        throw new RuntimeException("No valid custom challan items found");
                }

                final int rowsPerPage = 16;

                int totalPages = (int) Math.ceil(items.size() / (double) rowsPerPage);

                if (totalPages <= 0) {
                        totalPages = 1;
                }

                try (PDDocument doc = new PDDocument()) {
                        PDFont bold = PDType1Font.HELVETICA_BOLD;
                        PDFont regular = PDType1Font.HELVETICA;

                        for (int pageIndex = 0; pageIndex < totalPages; pageIndex++) {
                                int fromIndex = pageIndex * rowsPerPage;
                                int toIndex = Math.min(fromIndex + rowsPerPage, items.size());

                                List<CustomChallanItemRequest> pageItems = items.subList(fromIndex, toIndex);

                                PDPage page = new PDPage(new PDRectangle(PAGE_WIDTH, PAGE_HEIGHT));

                                doc.addPage(page);

                                PDPageContentStream cs = new PDPageContentStream(doc, page);

                                drawCustomChallanPage(
                                                cs,
                                                bold,
                                                regular,
                                                request,
                                                challanNo,
                                                createdBy,
                                                pageItems,
                                                fromIndex,
                                                pageIndex + 1,
                                                totalPages);

                                cs.close();
                        }

                        ByteArrayOutputStream out = new ByteArrayOutputStream();

                        doc.save(out);

                        return out.toByteArray();

                } catch (IOException e) {
                        throw new RuntimeException("Failed to generate custom challan PDF", e);
                }
        }

        private void drawPageHeader(
                        PDPageContentStream cs,
                        PDFont bold,
                        PDFont regular,
                        String pdNo,
                        String clientName,
                        String address,
                        String date,
                        String challanNo,
                        String driverName,
                        String vehicleNo) throws IOException {

                drawCenteredText(
                                cs,
                                bold,
                                20,
                                760,
                                "External Movement Challan");

                drawLine(cs, LEFT, 740, RIGHT, 740);

                drawChallanHeader(
                                cs,
                                regular,
                                pdNo,
                                clientName,
                                address,
                                date,
                                challanNo,
                                driverName,
                                vehicleNo);

                drawLine(cs, LEFT, 640, RIGHT, 640);

                drawTableFrame(cs, bold);
        }

        private void drawTableFrame(
                        PDPageContentStream cs,
                        PDFont bold) throws IOException {

                drawLine(cs, LEFT, TABLE_TOP, LEFT, TABLE_BOTTOM);
                drawLine(cs, SR_RIGHT, TABLE_TOP, SR_RIGHT, TABLE_BOTTOM);
                drawLine(cs, DESC_RIGHT, TABLE_TOP, DESC_RIGHT, TABLE_BOTTOM);
                drawLine(cs, REMARK_RIGHT, TABLE_TOP, REMARK_RIGHT, TABLE_BOTTOM);

                drawLine(cs, LEFT, TABLE_TOP, RIGHT, TABLE_TOP);
                drawLine(cs, LEFT, TABLE_HEADER_BOTTOM, RIGHT, TABLE_HEADER_BOTTOM);
                drawLine(cs, LEFT, TABLE_BOTTOM, RIGHT, TABLE_BOTTOM);

                drawCenteredTextInBox(
                                cs,
                                bold,
                                10,
                                SR_X,
                                SR_RIGHT,
                                605,
                                "SR.NO");

                drawCenteredTextInBox(
                                cs,
                                bold,
                                10,
                                SR_RIGHT,
                                DESC_RIGHT,
                                605,
                                "DESCRIPTION");

                drawCenteredTextInBox(
                                cs,
                                bold,
                                10,
                                DESC_RIGHT,
                                REMARK_RIGHT,
                                605,
                                "REMARKS");
        }

        private void drawFooter(
                        PDPageContentStream cs,
                        PDFont regular) throws IOException {

                drawLine(cs, LEFT, FOOTER_TOP, RIGHT, FOOTER_TOP);
                drawLine(cs, LEFT, FOOTER_BOTTOM, RIGHT, FOOTER_BOTTOM);
                drawLine(cs, LEFT, FOOTER_TOP, LEFT, FOOTER_BOTTOM);
                drawLine(cs, RIGHT, FOOTER_TOP, RIGHT, FOOTER_BOTTOM);

                drawLine(cs, 300, FOOTER_TOP, 300, FOOTER_BOTTOM);

                float row1Y = 92;
                float row2Y = 66;

                drawLine(cs, LEFT, row1Y, RIGHT, row1Y);
                drawLine(cs, LEFT, row2Y, RIGHT, row2Y);

                drawText(cs, regular, 10, 50, 102, "Dispatched By");
                drawText(cs, regular, 10, 50, 76, "Prepared By");
                drawText(cs, regular, 10, 50, 50, "Security Out");

                drawText(cs, regular, 10, 310, 102, "Checked By");
                drawText(cs, regular, 10, 310, 76, "Authorised By");
                drawText(cs, regular, 10, 310, 50, "Receiver / Site Sign");
        }

        private void drawChallanHeader(
                        PDPageContentStream cs,
                        PDFont regular,
                        String pdNo,
                        String clientName,
                        String address,
                        String date,
                        String challanNo,
                        String driverName,
                        String vehicleNo) throws IOException {

                drawText(cs, regular, 10, 40, 710, "P.D. No:");

                float pdEndY = drawWrappedText(
                                cs,
                                regular,
                                9,
                                95,
                                710,
                                240,
                                pdNo);

                float clientY = Math.min(690, pdEndY - 18);

                float addressY = clientY - 18;

                drawText(
                                cs,
                                regular,
                                10,
                                40,
                                clientY,
                                "Client Name: " + safe(clientName));

                drawWrappedText(
                                cs,
                                regular,
                                9,
                                40,
                                addressY,
                                290,
                                "Address: " + safe(address));

                drawText(cs, regular, 10, 350, 710, "Date / Time: " + safe(date));
                drawText(cs, regular, 10, 350, 690, "Challan No: " + safe(challanNo));
                drawText(cs, regular, 10, 350, 670, "Driver Name: " + safe(driverName));
                drawText(cs, regular, 10, 350, 650, "Vehicle No: " + safe(vehicleNo));
        }

        private void drawCenteredText(
                        PDPageContentStream cs,
                        PDFont font,
                        int size,
                        float y,
                        String text) throws IOException {

                text = cleanPdfText(safe(text));

                float textWidth = font.getStringWidth(text) / 1000 * size;

                float x = (PAGE_WIDTH - textWidth) / 2;

                drawText(cs, font, size, x, y, text);
        }

        private void drawCenteredTextInBox(
                        PDPageContentStream cs,
                        PDFont font,
                        int size,
                        float x1,
                        float x2,
                        float y,
                        String text) throws IOException {

                text = cleanPdfText(safe(text));

                float textWidth = font.getStringWidth(text) / 1000 * size;

                float x = x1 + ((x2 - x1) - textWidth) / 2;

                drawText(cs, font, size, x, y, text);
        }

        private void drawText(
                        PDPageContentStream cs,
                        PDFont font,
                        int size,
                        float x,
                        float y,
                        String text) throws IOException {

                String safeText = cleanPdfText(safe(text));

                cs.beginText();
                cs.setFont(font, size);
                cs.newLineAtOffset(x, y);
                cs.showText(safeText);
                cs.endText();
        }

        private void drawLine(
                        PDPageContentStream cs,
                        float x1,
                        float y1,
                        float x2,
                        float y2) throws IOException {
                cs.moveTo(x1, y1);
                cs.lineTo(x2, y2);
                cs.stroke();
        }

        private float drawWrappedText(
                        PDPageContentStream cs,
                        PDFont font,
                        int fontSize,
                        float x,
                        float y,
                        float maxWidth,
                        String text) throws IOException {

                String safeText = cleanPdfText(safe(text));

                String[] words = safeText.split("\\s+");

                StringBuilder line = new StringBuilder();

                for (String word : words) {
                        String test = line.length() == 0
                                        ? word
                                        : line + " " + word;

                        float width = font.getStringWidth(test) / 1000 * fontSize;

                        if (width > maxWidth && line.length() > 0) {
                                drawText(
                                                cs,
                                                font,
                                                fontSize,
                                                x,
                                                y,
                                                line.toString());

                                line = new StringBuilder(word);

                                y -= 14;
                        } else {
                                line = new StringBuilder(test);
                        }
                }

                if (line.length() > 0) {
                        drawText(
                                        cs,
                                        font,
                                        fontSize,
                                        x,
                                        y,
                                        line.toString());
                }

                return y;
        }

        private int countWrappedLines(
                        PDFont font,
                        int fontSize,
                        float maxWidth,
                        String text) throws IOException {

                String safeText = cleanPdfText(safe(text));

                String[] words = safeText.split("\\s+");

                int lines = 1;

                StringBuilder line = new StringBuilder();

                for (String word : words) {
                        String test = line.length() == 0
                                        ? word
                                        : line + " " + word;

                        float width = font.getStringWidth(test) / 1000 * fontSize;

                        if (width > maxWidth && line.length() > 0) {
                                lines++;
                                line = new StringBuilder(word);
                        } else {
                                line = new StringBuilder(test);
                        }
                }

                return Math.max(lines, 1);
        }

        private String buildAllPdNos(
                        List<ChalaanItem> items) {
                Set<String> pdNos = new LinkedHashSet<>();

                if (items != null) {
                        for (ChalaanItem item : items) {
                                if (item == null) {
                                        continue;
                                }

                                String pd = safe(item.getPdNo());

                                if (!"-".equals(pd)) {
                                        pdNos.add(pd);
                                }
                        }
                }

                if (pdNos.isEmpty()) {
                        return "-";
                }

                return String.join(", ", pdNos);
        }

        private String safe(
                        Object value) {
                if (value == null) {
                        return "-";
                }

                String text = value.toString().trim();

                return text.isEmpty()
                                ? "-"
                                : text;
        }

        private String cleanPdfText(
                        String text) {
                if (text == null || text.isBlank()) {
                        return "-";
                }

                return text
                                .replace("\r", " ")
                                .replace("\n", " ")
                                .replace("₹", "Rs.")
                                .replaceAll("[^\\x20-\\x7E]", " ")
                                .replaceAll("\\s+", " ")
                                .trim();
        }

        private void drawCustomChallanPage(
                        PDPageContentStream cs,
                        PDFont bold,
                        PDFont regular,
                        CustomChallanRequest request,
                        String challanNo,
                        String createdBy,
                        List<CustomChallanItemRequest> pageItems,
                        int rowOffset,
                        int pageNo,
                        int totalPages) throws IOException {

                String title = "REQUIREMENT CHALLAN";

                String subTitle = customChallanTypeLabel(request == null ? null : request.challanType());

                String date = formatChallanDateTime(
                                request == null ? null : request.dispatchTime());

                drawCenteredText(
                                cs,
                                bold,
                                20,
                                760,
                                title);

                drawCenteredText(
                                cs,
                                bold,
                                12,
                                738,
                                subTitle);

                drawCenteredText(
                                cs,
                                bold,
                                11,
                                718,
                                "Challan No: " + safe(challanNo));

                drawText(
                                cs,
                                regular,
                                8,
                                RIGHT - 62,
                                718,
                                "Page: " + pageNo + "/" + totalPages);

                drawLine(cs, LEFT, 704, RIGHT, 704);

                drawCustomChallanTopForm(
                                cs,
                                bold,
                                regular,
                                request,
                                challanNo,
                                date,
                                createdBy,
                                pageNo,
                                totalPages);

                drawCustomChallanTable(
                                cs,
                                bold,
                                regular,
                                pageItems,
                                rowOffset);

                drawFooter(cs, regular);
        }

        private void drawCustomChallanTopForm(
                        PDPageContentStream cs,
                        PDFont bold,
                        PDFont regular,
                        CustomChallanRequest request,
                        String challanNo,
                        String date,
                        String createdBy,
                        int pageNo,
                        int totalPages) throws IOException {

                float x0 = LEFT;
                float x1 = 105;
                float x2 = 330;
                float x3 = 410;
                float x4 = RIGHT;

                boolean siteReturn = isCustomType(
                                request == null ? null : request.challanType(),
                                "SITE_RETURN");

                float topY = 690;
                float rowHeight = siteReturn ? 18 : 22;
                int rowCount = siteReturn ? 6 : 5;

                float bottomY = topY - (rowHeight * rowCount);

                drawRect(
                                cs,
                                x0,
                                bottomY,
                                RIGHT - LEFT,
                                topY - bottomY);

                drawLine(cs, x1, bottomY, x1, topY);
                drawLine(cs, x2, bottomY, x2, topY);
                drawLine(cs, x3, bottomY, x3, topY);

                for (int i = 1; i < rowCount; i++) {
                        float y = topY - (rowHeight * i);
                        drawLine(cs, x0, y, x4, y);
                }

                drawCustomCell(
                                cs,
                                bold,
                                regular,
                                x0,
                                x1,
                                topY,
                                rowHeight,
                                "From",
                                request == null ? "-" : safe(request.fromLocation()));

                drawCustomCell(
                                cs,
                                bold,
                                regular,
                                x2,
                                x3,
                                topY,
                                rowHeight,
                                "Date / Time",
                                safe(date));

                drawCustomCell(
                                cs,
                                bold,
                                regular,
                                x0,
                                x1,
                                topY - rowHeight,
                                rowHeight,
                                "To",
                                request == null ? "-" : safe(request.toLocation()));

                drawCustomCell(
                                cs,
                                bold,
                                regular,
                                x2,
                                x3,
                                topY - rowHeight,
                                rowHeight,
                                "Challan",
                                safe(challanNo));

                drawCustomCell(
                                cs,
                                bold,
                                regular,
                                x0,
                                x1,
                                topY - (rowHeight * 2),
                                rowHeight,
                                "PD No.",
                                request == null ? "-" : safe(request.pdNo()));

                drawCustomCell(
                                cs,
                                bold,
                                regular,
                                x2,
                                x3,
                                topY - (rowHeight * 2),
                                rowHeight,
                                "Driver",
                                request == null ? "-" : safe(request.driverName()));

                drawCustomCell(
                                cs,
                                bold,
                                regular,
                                x0,
                                x1,
                                topY - (rowHeight * 3),
                                rowHeight,
                                "Client",
                                request == null ? "-" : safe(request.clientName()));

                drawCustomCell(
                                cs,
                                bold,
                                regular,
                                x2,
                                x3,
                                topY - (rowHeight * 3),
                                rowHeight,
                                "Vehicle",
                                request == null ? "-" : safe(request.vehicleNumber()));

                drawCustomCell(
                                cs,
                                bold,
                                regular,
                                x0,
                                x1,
                                topY - (rowHeight * 4),
                                rowHeight,
                                "Purpose",
                                request == null ? "-" : safe(request.purpose()));

                if (siteReturn) {
                        drawCustomCell(
                                        cs,
                                        bold,
                                        regular,
                                        x2,
                                        x3,
                                        topY - (rowHeight * 4),
                                        rowHeight,
                                        "Mode",
                                        request == null ? "-" : safe(request.movementMode()));

                        drawCustomCell(
                                        cs,
                                        bold,
                                        regular,
                                        x0,
                                        x1,
                                        topY - (rowHeight * 5),
                                        rowHeight,
                                        "Handed Over To",
                                        request == null ? "-" : safe(request.handedOverTo()));

                        drawCustomCell(
                                        cs,
                                        bold,
                                        regular,
                                        x2,
                                        x3,
                                        topY - (rowHeight * 5),
                                        rowHeight,
                                        "By",
                                        safe(createdBy));
                } else {
                        drawCustomCell(
                                        cs,
                                        bold,
                                        regular,
                                        x2,
                                        x3,
                                        topY - (rowHeight * 4),
                                        rowHeight,
                                        "By",
                                        safe(createdBy));
                }
        }

        private void drawCustomChallanTable(
                        PDPageContentStream cs,
                        PDFont bold,
                        PDFont regular,
                        List<CustomChallanItemRequest> pageItems,
                        int rowOffset) throws IOException {

                float tableTopY = 560;
                float headerHeight = 36;
                float rowHeight = 24;
                int rowsPerPage = 16;

                float x0 = LEFT; // 40
                float x1 = 75; // S.No
                float x2 = 285; // Description
                float x3 = 340; // Dwg No
                float x4 = 385; // Qty
                float x5 = 435; // UOM
                float x6 = 500; // Returnable / Non Returnable
                float x7 = RIGHT; // Remarks

                float tableBottomY = tableTopY - headerHeight - (rowsPerPage * rowHeight);

                drawRect(
                                cs,
                                x0,
                                tableBottomY,
                                x7 - x0,
                                tableTopY - tableBottomY);

                drawLine(cs, x1, tableBottomY, x1, tableTopY);
                drawLine(cs, x2, tableBottomY, x2, tableTopY);
                drawLine(cs, x3, tableBottomY, x3, tableTopY);
                drawLine(cs, x4, tableBottomY, x4, tableTopY);
                drawLine(cs, x5, tableBottomY, x5, tableTopY);
                drawLine(cs, x6, tableBottomY, x6, tableTopY);

                drawLine(
                                cs,
                                x0,
                                tableTopY - headerHeight,
                                x7,
                                tableTopY - headerHeight);

                for (int i = 0; i <= rowsPerPage; i++) {
                        float y = tableTopY - headerHeight - (i * rowHeight);

                        drawLine(cs, x0, y, x7, y);
                }

                drawCenteredTextInBox(cs, bold, 9, x0, x1, tableTopY - 22, "S.No.");
                drawCenteredTextInBox(cs, bold, 10, x1, x2, tableTopY - 22, "Description");

                drawCenteredTextInBox(cs, bold, 9, x2, x3, tableTopY - 15, "Dwg.");
                drawCenteredTextInBox(cs, bold, 9, x2, x3, tableTopY - 28, "No.");

                drawCenteredTextInBox(cs, bold, 9, x3, x4, tableTopY - 22, "Qty");
                drawCenteredTextInBox(cs, bold, 9, x4, x5, tableTopY - 22, "UOM");

                drawCenteredTextInBox(cs, bold, 7, x5, x6, tableTopY - 15, "Returnable /");
                drawCenteredTextInBox(cs, bold, 7, x5, x6, tableTopY - 28, "Non Returnable");

                drawCenteredTextInBox(cs, bold, 9, x6, x7, tableTopY - 22, "Remarks");

                for (int i = 0; i < pageItems.size(); i++) {
                        CustomChallanItemRequest item = pageItems.get(i);

                        float rowTop = tableTopY - headerHeight - (i * rowHeight);

                        float textY = rowTop - 15;

                        drawText(
                                        cs,
                                        regular,
                                        9,
                                        x0 + 8,
                                        textY,
                                        String.valueOf(rowOffset + i + 1));

                        drawCustomWrappedText(
                                        cs,
                                        regular,
                                        8,
                                        x1 + 5,
                                        rowTop - 10,
                                        x2 - x1 - 10,
                                        safe(item.description()),
                                        2,
                                        9);

                        drawCustomWrappedText(
                                        cs,
                                        regular,
                                        8,
                                        x2 + 4,
                                        rowTop - 10,
                                        x3 - x2 - 8,
                                        safe(item.drawingNo()),
                                        2,
                                        9);

                        drawCenteredTextInBox(
                                        cs,
                                        regular,
                                        8,
                                        x3,
                                        x4,
                                        textY,
                                        formatCustomQty(item.quantity()));

                        drawCenteredTextInBox(
                                        cs,
                                        regular,
                                        8,
                                        x4,
                                        x5,
                                        textY,
                                        formatCustomUom(item.uom()));

                        drawCustomWrappedText(
                                        cs,
                                        regular,
                                        7,
                                        x5 + 4,
                                        rowTop - 10,
                                        x6 - x5 - 8,
                                        Boolean.TRUE.equals(item.returnable())
                                                        ? "Returnable"
                                                        : "Non Returnable",
                                        2,
                                        8);

                        drawCustomWrappedText(
                                        cs,
                                        regular,
                                        8,
                                        x6 + 5,
                                        rowTop - 10,
                                        x7 - x6 - 10,
                                        safe(item.remarks()),
                                        2,
                                        9);
                }
        }

        private void drawCustomCell(
                        PDPageContentStream cs,
                        PDFont labelFont,
                        PDFont valueFont,
                        float labelX1,
                        float labelX2,
                        float rowTopY,
                        float rowHeight,
                        String label,
                        String value) throws IOException {
                float valueX1 = labelX2;

                float valueX2 = labelX1 < 330
                                ? 330
                                : RIGHT;

                drawText(
                                cs,
                                labelFont,
                                8,
                                labelX1 + 5,
                                rowTopY - 14,
                                label);

                drawCustomWrappedText(
                                cs,
                                valueFont,
                                8,
                                valueX1 + 5,
                                rowTopY - 9,
                                valueX2 - valueX1 - 10,
                                value,
                                2,
                                8);
        }

        private void drawCustomWrappedText(
                        PDPageContentStream cs,
                        PDFont font,
                        int fontSize,
                        float x,
                        float y,
                        float maxWidth,
                        String text,
                        int maxLines,
                        float lineHeight) throws IOException {
                List<String> lines = customWrapLines(
                                font,
                                fontSize,
                                safe(text),
                                maxWidth);

                int count = Math.min(lines.size(), maxLines);

                for (int i = 0; i < count; i++) {
                        String line = lines.get(i);

                        if (i == count - 1 && lines.size() > maxLines) {
                                line = trimCustomTextToWidth(
                                                font,
                                                fontSize,
                                                line + "...",
                                                maxWidth);
                        }

                        drawText(
                                        cs,
                                        font,
                                        fontSize,
                                        x,
                                        y - (i * lineHeight),
                                        line);
                }
        }

        private List<String> customWrapLines(
                        PDFont font,
                        int fontSize,
                        String text,
                        float maxWidth) throws IOException {
                java.util.List<String> lines = new java.util.ArrayList<>();

                String clean = cleanPdfText(safe(text));

                String[] words = clean.split("\\s+");

                StringBuilder current = new StringBuilder();

                for (String word : words) {
                        String candidate = current.length() == 0
                                        ? word
                                        : current + " " + word;

                        float width = font.getStringWidth(candidate) / 1000f * fontSize;

                        if (width <= maxWidth) {
                                current = new StringBuilder(candidate);
                        } else {
                                if (current.length() > 0) {
                                        lines.add(current.toString());
                                }

                                current = new StringBuilder(word);
                        }
                }

                if (current.length() > 0) {
                        lines.add(current.toString());
                }

                if (lines.isEmpty()) {
                        lines.add("-");
                }

                return lines;
        }

        private String trimCustomTextToWidth(
                        PDFont font,
                        int fontSize,
                        String text,
                        float maxWidth) throws IOException {
                String clean = cleanPdfText(safe(text));

                while (clean.length() > 1 &&
                                font.getStringWidth(clean) / 1000f * fontSize > maxWidth) {
                        clean = clean.substring(0, clean.length() - 1);
                }

                return clean;
        }

        private void drawRect(
                        PDPageContentStream cs,
                        float x,
                        float y,
                        float width,
                        float height) throws IOException {
                cs.addRect(x, y, width, height);
                cs.stroke();
        }

        private String customChallanTypeLabel(
                        String value) {
                String clean = value == null
                                ? ""
                                : value.trim().toUpperCase();

                if ("CUSTOMER_CARE".equals(clean)) {
                        return "CUSTOMER CARE MOVEMENT";
                }

                if ("HARDWARE_SITE_REQUIREMENT".equals(clean)) {
                        return "HARDWARE / SITE REQUIREMENT";
                }

                if ("ASSEMBLY_SITE_REQUIREMENT".equals(clean)) {
                        return "ASSEMBLY / SITE REQUIREMENT";
                }

                if ("JOB_WORK".equals(clean)) {
                        return "JOB WORK";
                }

                if ("SITE_RETURN".equals(clean)) {
                        return "SITE RETURN";
                }

                return "SPECIAL MOVEMENT";
        }

        private String formatChallanDateTime(
                        LocalDateTime value) {
                LocalDateTime finalValue = value != null
                                ? value
                                : LocalDateTime.now(ZoneId.of("Asia/Kolkata"));

                return finalValue.format(
                                DateTimeFormatter.ofPattern("dd-MM-yyyy HH:mm"));
        }

        private String formatCustomQty(
                        Double quantity) {
                double qty = quantity == null || quantity <= 0
                                ? 1D
                                : quantity;

                if (qty == Math.floor(qty)) {
                        return String.valueOf((long) qty);
                }

                return String.format(
                                java.util.Locale.US,
                                "%.2f",
                                qty)
                                .replaceAll("0+$", "")
                                .replaceAll("\\.$", "");
        }

        private String formatCustomUom(
                        String uom) {
                String clean = uom == null
                                ? ""
                                : uom.trim().toUpperCase();

                return switch (clean) {
                        case "KG" -> "Kg";
                        case "LTR" -> "Ltr";
                        case "ML" -> "ML";
                        case "SQFT" -> "sqft";
                        case "FT" -> "ft";
                        case "PIECES" -> "pieces";
                        case "PCS" -> "pieces";
                        case "PC" -> "pieces";
                        case "MTR" -> "mtr";
                        case "SQMTR" -> "sqmtr";
                        default -> "pieces";
                };
        }

        private boolean isCustomType(
                        String value,
                        String expected) {
                if (value == null || expected == null) {
                        return false;
                }

                return value.trim()
                                .equalsIgnoreCase(expected.trim());
        }
}