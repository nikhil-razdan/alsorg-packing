package com.alsorg.packing.service.pdf;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDFont;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.graphics.state.PDExtendedGraphicsState;
import org.apache.pdfbox.util.Matrix;

import java.time.LocalDateTime;
import java.util.ArrayList;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.format.DateTimeFormatter;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import com.alsorg.packing.config.TimeZoneConfig;
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
        private static final int CUSTOM_ROWS_PER_PAGE = 16;
        private static final int MAX_STANDARD_ITEMS = 1000;
        private static final int MAX_CUSTOM_ITEMS = 500;

        public byte[] generateChalaan(
                        ChalaanPdfData data) {

                List<ChalaanItem> sourceItems = data != null && data.getItems() != null
                                ? data.getItems()
                                : Collections.emptyList();

                if (sourceItems.size() > MAX_STANDARD_ITEMS) {
                        throw new IllegalArgumentException(
                                        "A challan cannot contain more than " + MAX_STANDARD_ITEMS + " items");
                }

                /*
                 * Standard packet challans are now grouped by the business identity
                 * that actually tells the factory/site team which packets belong
                 * together: Client + PD No. + Drawing No. + Item Name.
                 *
                 * This removes the repeated PD/DWG/Item text from every packet row
                 * while preserving every packet description and remark inside the
                 * same visual section.  The outer challan layout, header, table
                 * columns and signature footer remain unchanged.
                 */
                List<StandardChallanGroup> groups = groupStandardChallanItems(sourceItems);

                /*
                 * Keep a flattened copy for the existing header PD-number summary.
                 */
                List<ChalaanItem> items = flattenStandardChallanGroups(groups);

                /*
                 * Preserve the existing header-data behaviour by taking client/address
                 * information from the first original valid item, not from the sorted list.
                 */
                ChalaanItem firstItem = findFirstValidChalaanItem(sourceItems);

                String helperLoaderText = data != null &&
                                data.getHelperLoaderCount() != null &&
                                data.getHelperLoaderCount() > 0
                                                ? String.valueOf(
                                                                data.getHelperLoaderCount())
                                                : "-";

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
                                        vehicleNo,
                                        helperLoaderText);

                        float y = 580;

                        if (groups.isEmpty()) {
                                drawText(
                                                cs,
                                                regular,
                                                10,
                                                110,
                                                y,
                                                "No items found for this challan");
                        }

                        int groupNumber = 1;

                        for (StandardChallanGroup group : groups) {
                                int packetIndex = 0;

                                while (packetIndex < group.items.size()) {
                                        boolean continued = packetIndex > 0;

                                        float headerHeight = calculateStandardGroupHeaderHeight(
                                                        bold,
                                                        group,
                                                        continued);

                                        float firstPacketHeight = calculateStandardPacketHeight(
                                                        regular,
                                                        group.items.get(packetIndex),
                                                        packetIndex + 1);

                                        float availableHeight = y - (TABLE_BOTTOM + 8);

                                        /*
                                         * Do not start a new business section at the very bottom of
                                         * a page when its first packet cannot fit beneath the group
                                         * identity.  Continue on a clean challan page instead.
                                         */
                                        if (availableHeight < headerHeight + firstPacketHeight + 8
                                                        && y < 579) {
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
                                                                vehicleNo,
                                                                helperLoaderText);

                                                y = 580;
                                                availableHeight = y - (TABLE_BOTTOM + 8);
                                        }

                                        int chunkEnd = packetIndex;
                                        float sectionHeight = headerHeight + 6;

                                        while (chunkEnd < group.items.size()) {
                                                float packetHeight = calculateStandardPacketHeight(
                                                                regular,
                                                                group.items.get(chunkEnd),
                                                                chunkEnd + 1);

                                                if (sectionHeight + packetHeight + 4 > availableHeight
                                                                && chunkEnd > packetIndex) {
                                                        break;
                                                }

                                                /*
                                                 * A normal packet description is far smaller than a page.
                                                 * If a single unusually long value reaches this branch,
                                                 * still render that one packet instead of looping forever.
                                                 */
                                                if (sectionHeight + packetHeight + 4 > availableHeight
                                                                && chunkEnd == packetIndex) {
                                                        sectionHeight += packetHeight;
                                                        chunkEnd++;
                                                        break;
                                                }

                                                sectionHeight += packetHeight;
                                                chunkEnd++;
                                        }

                                        sectionHeight += 4;

                                        drawStandardGroupSection(
                                                        cs,
                                                        bold,
                                                        regular,
                                                        group,
                                                        groupNumber,
                                                        packetIndex,
                                                        chunkEnd,
                                                        continued,
                                                        y,
                                                        sectionHeight);

                                        y -= sectionHeight + 6;
                                        packetIndex = chunkEnd;

                                        if (packetIndex < group.items.size()) {
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
                                                                vehicleNo,
                                                                helperLoaderText);

                                                y = 580;
                                        }
                                }

                                groupNumber++;
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

                if (sourceItems.size() > MAX_CUSTOM_ITEMS) {
                        throw new IllegalArgumentException(
                                        "A custom challan cannot contain more than " + MAX_CUSTOM_ITEMS + " items");
                }

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

                /*
                 * In the current DTO, drawingNo is used for the PDF's "PD No." column
                 * for backward compatibility. Therefore custom challan rows must be
                 * grouped and sorted using drawingNo().
                 *
                 * List.sort() is stable, so items having the same PD number retain
                 * their original relative order.
                 */
                items.sort(
                                (left, right) -> comparePdValues(
                                                left == null ? null : left.drawingNo(),
                                                right == null ? null : right.drawingNo()));

                final int rowsPerPage = CUSTOM_ROWS_PER_PAGE;

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
                        String vehicleNo,
                        String helperLoadertext) throws IOException {

                drawCenteredText(
                                cs,
                                bold,
                                20,
                                760,
                                "Packing Details");

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
                                vehicleNo,
                                helperLoadertext);

                drawLine(cs, LEFT, 636, RIGHT, 636);

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
                        String vehicleNo,
                        String helperLoaderText) throws IOException {

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

                drawText(
                                cs,
                                regular,
                                9,
                                350,
                                712,
                                "Date / Time: " +
                                                safe(date));

                drawText(
                                cs,
                                regular,
                                9,
                                350,
                                696,
                                "Challan No: " +
                                                safe(challanNo));

                drawText(
                                cs,
                                regular,
                                9,
                                350,
                                680,
                                "Driver Name: " +
                                                safe(driverName));

                drawText(
                                cs,
                                regular,
                                9,
                                350,
                                664,
                                "Vehicle No: " +
                                                safe(vehicleNo));

                drawText(
                                cs,
                                regular,
                                9,
                                350,
                                648,
                                "Helpers / Loaders: " +
                                                safe(helperLoaderText));
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

        private List<StandardChallanGroup> groupStandardChallanItems(
                        List<ChalaanItem> sourceItems) {

                List<ChalaanItem> sortedItems = new ArrayList<>();

                if (sourceItems != null) {
                        for (ChalaanItem item : sourceItems) {
                                if (item != null) {
                                        sortedItems.add(item);
                                }
                        }
                }

                sortedItems.sort(this::compareStandardChallanItems);

                Map<String, StandardChallanGroup> grouped = new LinkedHashMap<>();
                int anonymousIndex = 0;

                for (ChalaanItem item : sortedItems) {
                        String clientKey = normalizeGroupingValue(item.getClientName());
                        String pdKey = normalizeGroupingValue(item.getPdNo());
                        String drawingKey = normalizeGroupingValue(item.getDrawingNo());
                        String itemKey = normalizeGroupingValue(item.getItemName());

                        String key = clientKey + "\u001f"
                                        + pdKey + "\u001f"
                                        + drawingKey + "\u001f"
                                        + itemKey;

                        /*
                         * Do not accidentally merge completely unidentified legacy rows.
                         */
                        if (clientKey.isEmpty()
                                        && pdKey.isEmpty()
                                        && drawingKey.isEmpty()
                                        && itemKey.isEmpty()) {
                                key = key + "\u001fANON-" + (++anonymousIndex);
                        }

                        StandardChallanGroup group = grouped.computeIfAbsent(
                                        key,
                                        ignored -> new StandardChallanGroup(
                                                        safe(item.getClientName()),
                                                        safe(item.getPdNo()),
                                                        safe(item.getDrawingNo()),
                                                        safe(item.getItemName())));

                        group.items.add(item);
                }

                return new ArrayList<>(grouped.values());
        }

        private List<ChalaanItem> flattenStandardChallanGroups(
                        List<StandardChallanGroup> groups) {

                List<ChalaanItem> items = new ArrayList<>();

                if (groups == null) {
                        return items;
                }

                for (StandardChallanGroup group : groups) {
                        if (group != null && group.items != null) {
                                items.addAll(group.items);
                        }
                }

                return items;
        }

        private int compareStandardChallanItems(
                        ChalaanItem left,
                        ChalaanItem right) {

                if (left == right) {
                        return 0;
                }

                if (left == null) {
                        return 1;
                }

                if (right == null) {
                        return -1;
                }

                int pdComparison = comparePdValues(
                                left.getPdNo(),
                                right.getPdNo());

                if (pdComparison != 0) {
                        return pdComparison;
                }

                int drawingComparison = compareGroupingText(
                                left.getDrawingNo(),
                                right.getDrawingNo());

                if (drawingComparison != 0) {
                        return drawingComparison;
                }

                int itemComparison = compareGroupingText(
                                left.getItemName(),
                                right.getItemName());

                if (itemComparison != 0) {
                        return itemComparison;
                }

                return compareGroupingText(
                                left.getClientName(),
                                right.getClientName());
        }

        private int compareGroupingText(
                        String leftValue,
                        String rightValue) {

                String left = normalizeGroupingValue(leftValue);
                String right = normalizeGroupingValue(rightValue);

                if (left.isEmpty() && right.isEmpty()) {
                        return 0;
                }

                if (left.isEmpty()) {
                        return 1;
                }

                if (right.isEmpty()) {
                        return -1;
                }

                return compareNaturalText(left, right);
        }

        private String normalizeGroupingValue(
                        String value) {

                if (value == null) {
                        return "";
                }

                String normalized = value
                                .trim()
                                .replaceAll("\\s+", " ")
                                .toUpperCase(Locale.ROOT);

                return "-".equals(normalized)
                                ? ""
                                : normalized;
        }

        private float calculateStandardGroupHeaderHeight(
                        PDFont bold,
                        StandardChallanGroup group,
                        boolean continued) throws IOException {

                String identityLine = buildStandardGroupIdentityLine(
                                group,
                                continued);

                String itemLine = "Item: " + safe(group.itemName);

                int identityLines = countWrappedLines(
                                bold,
                                9,
                                300,
                                identityLine);

                int itemLines = countWrappedLines(
                                bold,
                                9,
                                300,
                                itemLine);

                return Math.max(
                                36,
                                12 + ((identityLines + itemLines) * 11));
        }

        private float calculateStandardPacketHeight(
                        PDFont regular,
                        ChalaanItem item,
                        int packetNumber) throws IOException {

                String description = buildStandardPacketDescription(
                                item,
                                packetNumber);

                String remarks = buildStandardPacketRemarks(
                                item,
                                packetNumber);

                int descriptionLines = countWrappedLines(
                                regular,
                                9,
                                300,
                                description);

                int remarkLines = countWrappedLines(
                                regular,
                                8,
                                120,
                                remarks);

                return Math.max(
                                20,
                                (Math.max(descriptionLines, remarkLines) * 12) + 6);
        }

        private void drawStandardGroupSection(
                        PDPageContentStream cs,
                        PDFont bold,
                        PDFont regular,
                        StandardChallanGroup group,
                        int groupNumber,
                        int fromPacketIndex,
                        int toPacketIndex,
                        boolean continued,
                        float rowTop,
                        float sectionHeight) throws IOException {

                float rowBottom = rowTop - sectionHeight;

                drawText(
                                cs,
                                bold,
                                10,
                                55,
                                rowTop - 15,
                                String.valueOf(groupNumber));

                drawText(
                                cs,
                                regular,
                                7,
                                47,
                                rowTop - 29,
                                group.items.size() + " pkts");

                if (continued) {
                        drawText(
                                        cs,
                                        regular,
                                        6,
                                        48,
                                        rowTop - 40,
                                        "cont.");
                }

                String identityLine = buildStandardGroupIdentityLine(
                                group,
                                continued);

                float identityEndY = drawWrappedTextWithLineHeight(
                                cs,
                                bold,
                                9,
                                110,
                                rowTop - 13,
                                300,
                                identityLine,
                                11);

                float itemEndY = drawWrappedTextWithLineHeight(
                                cs,
                                bold,
                                9,
                                110,
                                identityEndY - 11,
                                300,
                                "Item: " + safe(group.itemName),
                                11);

                /*
                 * A short rule beneath the group identity makes the separation
                 * between different PD/DWG/Item sections immediately visible.
                 */
                float headerRuleY = itemEndY - 8;
                cs.setLineWidth(0.55f);
                drawLine(cs, SR_RIGHT + 6, headerRuleY, RIGHT - 6, headerRuleY);
                cs.setLineWidth(1f);

                float packetY = headerRuleY - 13;

                for (int index = fromPacketIndex; index < toPacketIndex; index++) {
                        ChalaanItem item = group.items.get(index);
                        int packetNumber = index + 1;

                        float packetHeight = calculateStandardPacketHeight(
                                        regular,
                                        item,
                                        packetNumber);

                        drawWrappedTextWithLineHeight(
                                        cs,
                                        regular,
                                        9,
                                        110,
                                        packetY,
                                        300,
                                        buildStandardPacketDescription(
                                                        item,
                                                        packetNumber),
                                        12);

                        drawWrappedTextWithLineHeight(
                                        cs,
                                        regular,
                                        8,
                                        430,
                                        packetY,
                                        120,
                                        buildStandardPacketRemarks(
                                                        item,
                                                        packetNumber),
                                        12);

                        packetY -= packetHeight;
                }

                cs.setLineWidth(1.35f);
                drawLine(
                                cs,
                                LEFT,
                                rowBottom,
                                RIGHT,
                                rowBottom);
                cs.setLineWidth(1f);
        }

        private String buildStandardGroupIdentityLine(
                        StandardChallanGroup group,
                        boolean continued) {

                String text = "PD No: " + safe(group.pdNo)
                                + " | Dwg No: " + safe(group.drawingNo)
                                + " | Packets: " + group.items.size();

                if (continued) {
                        text += " | Continued";
                }

                return text;
        }

        private String buildStandardPacketDescription(
                        ChalaanItem item,
                        int packetNumber) {

                return "Packet " + packetNumber + ": "
                                + safe(item == null ? null : item.getDescription());
        }

        private String buildStandardPacketRemarks(
                        ChalaanItem item,
                        int packetNumber) {

                return "P" + packetNumber + ": "
                                + safe(item == null ? null : item.getRemarks());
        }

        private float drawWrappedTextWithLineHeight(
                        PDPageContentStream cs,
                        PDFont font,
                        int fontSize,
                        float x,
                        float y,
                        float maxWidth,
                        String text,
                        float lineHeight) throws IOException {

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
                                y -= lineHeight;
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

        private static final class StandardChallanGroup {
                private final String clientName;
                private final String pdNo;
                private final String drawingNo;
                private final String itemName;
                private final List<ChalaanItem> items = new ArrayList<>();

                private StandardChallanGroup(
                                String clientName,
                                String pdNo,
                                String drawingNo,
                                String itemName) {
                        this.clientName = clientName;
                        this.pdNo = pdNo;
                        this.drawingNo = drawingNo;
                        this.itemName = itemName;
                }
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

        /**
         * Finds the first valid item from the original unsorted list.
         *
         * This prevents sorting from unexpectedly changing which item supplies
         * the client name and address in the challan header.
         */
        private ChalaanItem findFirstValidChalaanItem(
                        List<ChalaanItem> items) {

                if (items == null) {
                        return null;
                }

                for (ChalaanItem item : items) {
                        if (item != null) {
                                return item;
                        }
                }

                return null;
        }

        /**
         * Compares PD values in natural alphanumeric order.
         *
         * Examples:
         * PD-1
         * PD-2
         * PD-9
         * PD-10
         * PD-11
         *
         * Missing PD values are placed after valid PD values.
         */
        private int comparePdValues(
                        String leftValue,
                        String rightValue) {

                String left = normalizePdForSorting(leftValue);
                String right = normalizePdForSorting(rightValue);

                boolean leftMissing = left.isEmpty();
                boolean rightMissing = right.isEmpty();

                if (leftMissing && rightMissing) {
                        return 0;
                }

                if (leftMissing) {
                        return 1;
                }

                if (rightMissing) {
                        return -1;
                }

                return compareNaturalText(left, right);
        }

        /**
         * Normalizes PD values so differences in case or extra spaces do not
         * separate otherwise matching PD groups.
         */
        private String normalizePdForSorting(
                        String value) {

                if (value == null) {
                        return "";
                }

                String normalized = value
                                .trim()
                                .replaceAll("\\s+", " ")
                                .toUpperCase(java.util.Locale.ROOT);

                if (normalized.isEmpty() || "-".equals(normalized)) {
                        return "";
                }

                return normalized;
        }

        /**
         * Natural alphanumeric comparison.
         *
         * Unlike ordinary String comparison, this compares numeric portions
         * numerically, so PD-2 appears before PD-10.
         */
        private int compareNaturalText(
                        String left,
                        String right) {

                int leftIndex = 0;
                int rightIndex = 0;

                while (leftIndex < left.length()
                                && rightIndex < right.length()) {

                        char leftCharacter = left.charAt(leftIndex);
                        char rightCharacter = right.charAt(rightIndex);

                        boolean leftIsDigit = Character.isDigit(leftCharacter);

                        boolean rightIsDigit = Character.isDigit(rightCharacter);

                        if (leftIsDigit && rightIsDigit) {
                                int leftNumberStart = leftIndex;
                                int rightNumberStart = rightIndex;

                                while (leftIndex < left.length()
                                                && Character.isDigit(
                                                                left.charAt(leftIndex))) {
                                        leftIndex++;
                                }

                                while (rightIndex < right.length()
                                                && Character.isDigit(
                                                                right.charAt(rightIndex))) {
                                        rightIndex++;
                                }

                                String leftNumber = left.substring(
                                                leftNumberStart,
                                                leftIndex);

                                String rightNumber = right.substring(
                                                rightNumberStart,
                                                rightIndex);

                                String leftSignificant = removeLeadingZeros(leftNumber);

                                String rightSignificant = removeLeadingZeros(rightNumber);

                                /*
                                 * Compare numeric length first so very large PD numbers
                                 * can be handled without parsing them into long/int.
                                 */
                                int lengthComparison = Integer.compare(
                                                leftSignificant.length(),
                                                rightSignificant.length());

                                if (lengthComparison != 0) {
                                        return lengthComparison;
                                }

                                int numericComparison = leftSignificant.compareTo(
                                                rightSignificant);

                                if (numericComparison != 0) {
                                        return numericComparison;
                                }

                                /*
                                 * When numeric values match, prefer the representation
                                 * with fewer leading zeroes:
                                 * PD-1 before PD-001.
                                 */
                                int rawLengthComparison = Integer.compare(
                                                leftNumber.length(),
                                                rightNumber.length());

                                if (rawLengthComparison != 0) {
                                        return rawLengthComparison;
                                }

                                continue;
                        }

                        int characterComparison = Character.compare(
                                        leftCharacter,
                                        rightCharacter);

                        if (characterComparison != 0) {
                                return characterComparison;
                        }

                        leftIndex++;
                        rightIndex++;
                }

                return Integer.compare(
                                left.length(),
                                right.length());
        }

        /**
         * Removes leading zeroes without returning an empty string.
         */
        private String removeLeadingZeros(
                        String number) {

                if (number == null || number.isEmpty()) {
                        return "0";
                }

                int index = 0;

                while (index < number.length() - 1
                                && number.charAt(index) == '0') {
                        index++;
                }

                return number.substring(index);
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

                String title = "REQUIREMENT MATERIAL DETAILS";

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
                int rowsPerPage = CUSTOM_ROWS_PER_PAGE;

                /*
                 * Revised column widths:
                 * S.No = 35
                 * Description = 185
                 * PD No. = 90
                 * Qty = 40
                 * UOM = 45
                 * Returnable = 70
                 * Remarks = 55
                 */
                float x0 = LEFT; // 40
                float x1 = 75;
                float x2 = 260;
                float x3 = 350;
                float x4 = 390;
                float x5 = 435;
                float x6 = 505;
                float x7 = RIGHT; // 560

                float tableBottomY = tableTopY
                                - headerHeight
                                - (rowsPerPage * rowHeight);

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
                        float y = tableTopY
                                        - headerHeight
                                        - (i * rowHeight);

                        drawLine(cs, x0, y, x7, y);
                }

                /* Table headings */
                drawCenteredTextInBox(
                                cs,
                                bold,
                                9,
                                x0,
                                x1,
                                tableTopY - 22,
                                "S.No.");

                drawCenteredTextInBox(
                                cs,
                                bold,
                                10,
                                x1,
                                x2,
                                tableTopY - 22,
                                "Description");

                // Changed from Dwg. No. to PD No.
                drawCenteredTextInBox(
                                cs,
                                bold,
                                9,
                                x2,
                                x3,
                                tableTopY - 22,
                                "PD No.");

                drawCenteredTextInBox(
                                cs,
                                bold,
                                9,
                                x3,
                                x4,
                                tableTopY - 22,
                                "Qty");

                drawCenteredTextInBox(
                                cs,
                                bold,
                                9,
                                x4,
                                x5,
                                tableTopY - 22,
                                "UOM");

                drawCenteredTextInBox(
                                cs,
                                bold,
                                7,
                                x5,
                                x6,
                                tableTopY - 15,
                                "Returnable /");

                drawCenteredTextInBox(
                                cs,
                                bold,
                                7,
                                x5,
                                x6,
                                tableTopY - 28,
                                "Non Returnable");

                drawCenteredTextInBox(
                                cs,
                                bold,
                                9,
                                x6,
                                x7,
                                tableTopY - 22,
                                "Remarks");

                /* Table values */
                for (int i = 0; i < pageItems.size(); i++) {
                        CustomChallanItemRequest item = pageItems.get(i);

                        float rowTop = tableTopY
                                        - headerHeight
                                        - (i * rowHeight);

                        drawCustomTableCellText(
                                        cs,
                                        regular,
                                        9,
                                        7,
                                        x0,
                                        x1,
                                        rowTop,
                                        rowHeight,
                                        String.valueOf(rowOffset + i + 1),
                                        1,
                                        true);

                        drawCustomTableCellText(
                                        cs,
                                        regular,
                                        8,
                                        7,
                                        x1,
                                        x2,
                                        rowTop,
                                        rowHeight,
                                        safe(item.description()),
                                        2,
                                        false);

                        /*
                         * The DTO property remains drawingNo for backward compatibility,
                         * but it is displayed in the PDF as PD No.
                         */
                        drawCustomTableCellText(
                                        cs,
                                        regular,
                                        8,
                                        6,
                                        x2,
                                        x3,
                                        rowTop,
                                        rowHeight,
                                        safe(item.drawingNo()),
                                        2,
                                        false);

                        drawCustomTableCellText(
                                        cs,
                                        regular,
                                        8,
                                        6,
                                        x3,
                                        x4,
                                        rowTop,
                                        rowHeight,
                                        formatCustomQty(item.quantity()),
                                        1,
                                        true);

                        drawCustomTableCellText(
                                        cs,
                                        regular,
                                        8,
                                        6,
                                        x4,
                                        x5,
                                        rowTop,
                                        rowHeight,
                                        formatCustomUom(item.uom()),
                                        2,
                                        true);

                        drawCustomTableCellText(
                                        cs,
                                        regular,
                                        7,
                                        6,
                                        x5,
                                        x6,
                                        rowTop,
                                        rowHeight,
                                        Boolean.TRUE.equals(item.returnable())
                                                        ? "Returnable"
                                                        : "Non Returnable",
                                        2,
                                        true);

                        drawCustomTableCellText(
                                        cs,
                                        regular,
                                        8,
                                        6,
                                        x6,
                                        x7,
                                        rowTop,
                                        rowHeight,
                                        safe(item.remarks()),
                                        2,
                                        false);
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

        private void drawCustomTableCellText(
                        PDPageContentStream cs,
                        PDFont font,
                        int preferredFontSize,
                        int minimumFontSize,
                        float cellLeft,
                        float cellRight,
                        float rowTop,
                        float rowHeight,
                        String text,
                        int maxLines,
                        boolean centered) throws IOException {

                float horizontalPadding = 4f;

                float maxWidth = Math.max(
                                1f,
                                cellRight - cellLeft - (horizontalPadding * 2));

                int actualFontSize = preferredFontSize;

                List<String> lines = customWrapLines(
                                font,
                                actualFontSize,
                                safe(text),
                                maxWidth);

                /*
                 * Reduce font size only when wrapping alone cannot fit the
                 * value in the available number of lines.
                 */
                while (lines.size() > maxLines
                                && actualFontSize > minimumFontSize) {

                        actualFontSize--;

                        lines = customWrapLines(
                                        font,
                                        actualFontSize,
                                        safe(text),
                                        maxWidth);
                }

                int visibleLineCount = Math.min(
                                lines.size(),
                                Math.max(maxLines, 1));

                float lineHeight = actualFontSize + 1f;

                float textBlockHeight = actualFontSize
                                + ((visibleLineCount - 1) * lineHeight);

                /*
                 * Vertically centers both one-line and two-line values.
                 */
                float firstBaseline = rowTop
                                - ((rowHeight - textBlockHeight) / 2f)
                                - actualFontSize
                                + 1f;

                for (int i = 0; i < visibleLineCount; i++) {
                        String line = lines.get(i);

                        if (i == visibleLineCount - 1
                                        && lines.size() > maxLines) {

                                line = fitCustomTextWithEllipsis(
                                                font,
                                                actualFontSize,
                                                line,
                                                maxWidth);
                        }

                        float textWidth = pdfTextWidth(
                                        font,
                                        actualFontSize,
                                        line);

                        float drawX = centered
                                        ? cellLeft
                                                        + ((cellRight - cellLeft - textWidth) / 2f)
                                        : cellLeft + horizontalPadding;

                        drawText(
                                        cs,
                                        font,
                                        actualFontSize,
                                        drawX,
                                        firstBaseline - (i * lineHeight),
                                        line);
                }
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

                List<String> lines = new ArrayList<>();

                String clean = cleanPdfText(safe(text));

                String[] words = clean.split("\\s+");

                StringBuilder currentLine = new StringBuilder();

                for (String word : words) {
                        /*
                         * Splits long values even when they contain no spaces,
                         * for example: F-233,234,235,236.
                         */
                        List<String> pieces = splitCustomTokenToWidth(
                                        font,
                                        fontSize,
                                        word,
                                        maxWidth);

                        for (int pieceIndex = 0; pieceIndex < pieces.size(); pieceIndex++) {

                                String piece = pieces.get(pieceIndex);

                                String candidate = currentLine.length() == 0
                                                ? piece
                                                : currentLine + " " + piece;

                                if (pdfTextWidth(
                                                font,
                                                fontSize,
                                                candidate) <= maxWidth) {

                                        currentLine.setLength(0);
                                        currentLine.append(candidate);

                                } else {
                                        if (currentLine.length() > 0) {
                                                lines.add(currentLine.toString());
                                                currentLine.setLength(0);
                                        }

                                        currentLine.append(piece);
                                }

                                /*
                                 * An intermediate piece came from a force-split token,
                                 * so finish that line before continuing.
                                 */
                                if (pieceIndex < pieces.size() - 1
                                                && currentLine.length() > 0) {

                                        lines.add(currentLine.toString());
                                        currentLine.setLength(0);
                                }
                        }
                }

                if (currentLine.length() > 0) {
                        lines.add(currentLine.toString());
                }

                if (lines.isEmpty()) {
                        lines.add("-");
                }

                return lines;
        }

        private List<String> splitCustomTokenToWidth(
                        PDFont font,
                        int fontSize,
                        String token,
                        float maxWidth) throws IOException {

                List<String> pieces = new ArrayList<>();

                String remaining = token == null
                                ? ""
                                : token.trim();

                while (!remaining.isEmpty()
                                && pdfTextWidth(
                                                font,
                                                fontSize,
                                                remaining) > maxWidth) {

                        int cutPosition = findLargestFittingPrefix(
                                        font,
                                        fontSize,
                                        remaining,
                                        maxWidth);

                        int preferredBreak = findPreferredCustomBreak(
                                        remaining,
                                        cutPosition);

                        if (preferredBreak > 0) {
                                cutPosition = preferredBreak;
                        }

                        cutPosition = Math.max(
                                        1,
                                        Math.min(cutPosition, remaining.length()));

                        String piece = remaining
                                        .substring(0, cutPosition)
                                        .trim();

                        if (!piece.isEmpty()) {
                                pieces.add(piece);
                        }

                        remaining = remaining
                                        .substring(cutPosition)
                                        .trim();
                }

                if (!remaining.isEmpty()) {
                        pieces.add(remaining);
                }

                if (pieces.isEmpty()) {
                        pieces.add("-");
                }

                return pieces;
        }

        private int findLargestFittingPrefix(
                        PDFont font,
                        int fontSize,
                        String value,
                        float maxWidth) throws IOException {

                int largestFittingPosition = 0;

                for (int i = 1; i <= value.length(); i++) {
                        String candidate = value.substring(0, i);

                        if (pdfTextWidth(
                                        font,
                                        fontSize,
                                        candidate) <= maxWidth) {

                                largestFittingPosition = i;
                        } else {
                                break;
                        }
                }

                /*
                 * Guarantees progress even if the available width is extremely small.
                 */
                return Math.max(largestFittingPosition, 1);
        }

        private int findPreferredCustomBreak(
                        String value,
                        int maximumPosition) {

                int startIndex = Math.min(
                                maximumPosition,
                                value.length()) - 1;

                int minimumIndex = Math.max(
                                1,
                                maximumPosition / 3);

                for (int i = startIndex; i >= minimumIndex; i--) {
                        char character = value.charAt(i);

                        if (character == ','
                                        || character == '-'
                                        || character == '/'
                                        || character == '.'
                                        || character == ';'
                                        || character == ':'
                                        || character == '_'
                                        || character == '|') {

                                // Retain the separator at the end of the current line.
                                return i + 1;
                        }
                }

                return -1;
        }

        private float pdfTextWidth(
                        PDFont font,
                        int fontSize,
                        String text) throws IOException {

                String value = text == null
                                ? ""
                                : text;

                return font.getStringWidth(value)
                                / 1000f
                                * fontSize;
        }

        private String fitCustomTextWithEllipsis(
                        PDFont font,
                        int fontSize,
                        String text,
                        float maxWidth) throws IOException {

                String clean = cleanPdfText(safe(text));
                String ellipsis = "...";

                while (!clean.isEmpty()
                                && pdfTextWidth(
                                                font,
                                                fontSize,
                                                clean + ellipsis) > maxWidth) {

                        clean = clean
                                        .substring(0, clean.length() - 1)
                                        .trim();
                }

                if (clean.isEmpty()) {
                        return trimCustomTextToWidth(
                                        font,
                                        fontSize,
                                        ellipsis,
                                        maxWidth);
                }

                return clean + ellipsis;
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
                                : LocalDateTime.now(TimeZoneConfig.APP_ZONE);

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
                        case "GRAM", "GM", "GMS" -> "Gram";
                        case "ML" -> "ML";
                        case "SQFT" -> "sqft";
                        case "FT" -> "ft";
                        case "MM" -> "MM";
                        case "SET", "SETS" -> "Set";
                        case "PIECES" -> "pieces";
                        case "PCS" -> "pieces";
                        case "PC" -> "pieces";
                        case "MTR" -> "mtr";
                        case "SQMTR" -> "sqmtr";
                        default -> "pieces";
                };
        }

        private void drawPreviewWatermark(
                        PDPageContentStream cs,
                        PDPage page,
                        PDFont bold) throws IOException {

                if (cs == null ||
                                page == null ||
                                bold == null) {
                        return;
                }

                String watermark = "PREVIEW - NOT A VALID CHALLAN";

                float fontSize = 38f;

                float textWidth = bold.getStringWidth(
                                watermark)
                                / 1000f
                                * fontSize;

                PDRectangle mediaBox = page.getMediaBox();

                float centerX = mediaBox.getLowerLeftX()
                                + (mediaBox.getWidth()
                                                / 2f);

                float centerY = mediaBox.getLowerLeftY()
                                + (mediaBox.getHeight()
                                                / 2f);

                cs.saveGraphicsState();

                try {
                        PDExtendedGraphicsState graphicsState = new PDExtendedGraphicsState();

                        graphicsState.setNonStrokingAlphaConstant(
                                        0.14f);

                        cs.setGraphicsStateParameters(
                                        graphicsState);

                        /*
                         * Faint red watermark.
                         */
                        cs.setNonStrokingColor(
                                        185,
                                        28,
                                        28);

                        cs.beginText();

                        cs.setFont(
                                        bold,
                                        fontSize);

                        Matrix matrix = Matrix.getRotateInstance(
                                        Math.toRadians(
                                                        32),
                                        centerX,
                                        centerY);

                        matrix.translate(
                                        -textWidth / 2f,
                                        0);

                        cs.setTextMatrix(
                                        matrix);

                        cs.showText(
                                        watermark);

                        cs.endText();

                } finally {
                        cs.restoreGraphicsState();
                }
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