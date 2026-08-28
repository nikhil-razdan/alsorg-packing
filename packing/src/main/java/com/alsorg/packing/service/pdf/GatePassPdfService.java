package com.alsorg.packing.service.pdf;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDFont;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.springframework.stereotype.Service;

import com.alsorg.packing.config.TimeZoneConfig;
import com.alsorg.packing.domain.dispatch.DispatchedItem;
import com.alsorg.packing.domain.qrcodegenerator.QRCodeGenerator;
import com.alsorg.packing.repository.ZohoStickerRepository;

@Service
public class GatePassPdfService {

    private static final PDRectangle PAGE_SIZE = PDRectangle.A4;

    private static final float PAGE_WIDTH = PAGE_SIZE.getWidth();
    private static final float PAGE_HEIGHT = PAGE_SIZE.getHeight();

    private static final float MARGIN = 25f;
    private static final float CONTENT_WIDTH = PAGE_WIDTH - (MARGIN * 2);

    private static final int ROWS_PER_PAGE = 18;
    private static final int MAX_GATE_PASS_ITEMS = 2000;

    private final ZohoStickerRepository stickerRepo;

    public GatePassPdfService(
            ZohoStickerRepository stickerRepo
    ) {
        this.stickerRepo = stickerRepo;
    }

    public byte[] generateGatePass(
            DispatchedItem item
    ) throws Exception {
        return generateBulkGatePass(
                java.util.Collections.singletonList(item)
        );
    }

    public byte[] generateBulkGatePass(
            List<DispatchedItem> items
    ) throws Exception {

        if (items == null || items.isEmpty()) {
            throw new RuntimeException("No items found for gate pass");
        }

        if (items.size() > MAX_GATE_PASS_ITEMS) {
            throw new IllegalArgumentException(
                    "A gate pass cannot contain more than " + MAX_GATE_PASS_ITEMS + " items");
        }

        try (PDDocument doc = new PDDocument()) {

            int totalPages =
                    (int) Math.ceil(
                            items.size() / (double) ROWS_PER_PAGE
                    );

            if (totalPages <= 0) {
                totalPages = 1;
            }

            for (int pageIndex = 0; pageIndex < totalPages; pageIndex++) {

                int fromIndex =
                        pageIndex * ROWS_PER_PAGE;

                int toIndex =
                        Math.min(
                                fromIndex + ROWS_PER_PAGE,
                                items.size()
                        );

                List<DispatchedItem> pageItems =
                        items.subList(
                                fromIndex,
                                toIndex
                        );

                PDPage page =
                        new PDPage(PAGE_SIZE);

                doc.addPage(page);

                try (PDPageContentStream cs =
                             new PDPageContentStream(doc, page)) {

                    drawGatePassPage(
                            doc,
                            cs,
                            items,
                            pageItems,
                            pageIndex + 1,
                            totalPages,
                            fromIndex
                    );
                }
            }

            ByteArrayOutputStream out =
                    new ByteArrayOutputStream();

            doc.save(out);

            return out.toByteArray();

        } catch (IOException e) {
            throw new RuntimeException(
                    "Gate pass PDF failed",
                    e
            );
        }
    }

    private void drawGatePassPage(
            PDDocument doc,
            PDPageContentStream cs,
            List<DispatchedItem> allItems,
            List<DispatchedItem> pageItems,
            int pageNo,
            int totalPages,
            int rowOffset
    ) throws Exception {

        DispatchedItem first =
                allItems.get(0);

        PDFont bold =
                PDType1Font.HELVETICA_BOLD;

        PDFont regular =
                PDType1Font.HELVETICA;

        String gatePassNo =
                safe(first.getGatePassNumber());

        String date =
                LocalDate.now(TimeZoneConfig.APP_ZONE).format(
                        DateTimeFormatter.ofPattern("dd-MM-yyyy")
                );

        String fromLocation =
                firstNonBlank(
                        first.getFromLocation(),
                        first.getCurrentLocationCode(),
                        first.getLocation(),
                        first.getPackedAreaCode()
                );

        String toWarehouse =
                firstNonBlank(
                        first.getWarehouseCode(),
                        first.getCurrentLocationCode(),
                        "-"
                );

        String plantCode =
                firstNonBlank(
                        first.getPlantCode(),
                        "-"
                );

        /*
         * QR payload:
         * Keep Gate Pass No. at the beginning so scanner can identify it easily.
         */
        String qrData =
                "GATEPASS:" + gatePassNo
                        + "\nTYPE:WAREHOUSE_MOVEMENT"
                        + "\nFROM:" + fromLocation
                        + "\nTO:" + toWarehouse
                        + "\nITEMS:" + allItems.size();

        /* ================= BACKGROUND ================= */

        cs.setNonStrokingColor(Color.WHITE);
        cs.addRect(
                0,
                0,
                PAGE_WIDTH,
                PAGE_HEIGHT
        );
        cs.fill();

        cs.setNonStrokingColor(Color.BLACK);
        cs.setStrokingColor(Color.BLACK);

        /* ================= TITLE ================= */

        drawCentered(
                cs,
                bold,
                11,
                PAGE_HEIGHT - 30,
                "GATE PASS"
        );

        drawCentered(
                cs,
                bold,
                22,
                PAGE_HEIGHT - 55,
                "WAREHOUSE MOVEMENT"
        );

        drawCentered(
                cs,
                bold,
                12,
                PAGE_HEIGHT - 78,
                "Gate Pass No: " + gatePassNo
        );

        /* ================= TOP FORM ================= */

        float formTopY =
                PAGE_HEIGHT - 95;

        float formHeight =
                100f;

        float formBottomY =
                formTopY - formHeight;

        drawTopForm(
                doc,
                cs,
                bold,
                regular,
                formTopY,
                formBottomY,
                fromLocation,
                toWarehouse,
                plantCode,
                date,
                gatePassNo,
                allItems.size(),
                pageNo,
                totalPages,
                qrData
        );

        /* ================= ITEM TABLE ================= */

        float tableTopY =
                formBottomY - 10;

        drawItemTable(
                cs,
                bold,
                regular,
                tableTopY,
                pageItems,
                rowOffset
        );

        /* ================= SIGNATURE SECTION ================= */

        drawSignatureSection(
                cs,
                bold
        );
    }

    private void drawTopForm(
            PDDocument doc,
            PDPageContentStream cs,
            PDFont bold,
            PDFont regular,
            float formTopY,
            float formBottomY,
            String fromLocation,
            String toWarehouse,
            String plantCode,
            String date,
            String gatePassNo,
            int totalItems,
            int pageNo,
            int totalPages,
            String qrData
    ) throws Exception {

        float x0 = MARGIN;
        float x1 = x0 + 55;
        float x2 = x0 + 305;
        float x3 = x0 + 380;
        float x4 = x0 + 455;
        float x5 = MARGIN + CONTENT_WIDTH;

        float rowHeight =
                (formTopY - formBottomY) / 3f;

        float y1 =
                formTopY - rowHeight;

        float y2 =
                formTopY - (rowHeight * 2);

        /* Outer */
        drawRect(
                cs,
                x0,
                formBottomY,
                CONTENT_WIDTH,
                formTopY - formBottomY
        );

        /* Vertical lines */
        drawLine(cs, x1, formBottomY, x1, formTopY);
        drawLine(cs, x2, formBottomY, x2, formTopY);
        drawLine(cs, x3, formBottomY, x3, formTopY);
        drawLine(cs, x4, formBottomY, x4, formTopY);

        /*
         * Horizontal lines only till QR section.
         * QR section replaces old "Sr. No." box and spans all 3 rows.
         */
        drawLine(cs, x0, y1, x4, y1);
        drawLine(cs, x0, y2, x4, y2);

        /* Row 1 */
        drawCellLabel(
                cs,
                bold,
                x0,
                y1,
                x1 - x0,
                rowHeight,
                "From"
        );

        drawCellValue(
                cs,
                regular,
                x1,
                y1,
                x2 - x1,
                rowHeight,
                fromLocation
        );

        drawCellLabel(
                cs,
                bold,
                x2,
                y1,
                x3 - x2,
                rowHeight,
                "Date"
        );

        drawCellValue(
                cs,
                regular,
                x3,
                y1,
                x4 - x3,
                rowHeight,
                date
        );

        /* Row 2 */
        drawCellLabel(
                cs,
                bold,
                x0,
                y2,
                x1 - x0,
                rowHeight,
                "To"
        );

        drawCellValue(
                cs,
                regular,
                x1,
                y2,
                x2 - x1,
                rowHeight,
                toWarehouse
        );

        drawCellLabel(
                cs,
                bold,
                x2,
                y2,
                x3 - x2,
                rowHeight,
                "GP No."
        );

        drawCellValue(
                cs,
                regular,
                x3,
                y2,
                x4 - x3,
                rowHeight,
                gatePassNo
        );

        /* Row 3 */
        drawCellLabel(
                cs,
                bold,
                x0,
                formBottomY,
                x1 - x0,
                rowHeight,
                "Plant"
        );

        drawCellValue(
                cs,
                regular,
                x1,
                formBottomY,
                x2 - x1,
                rowHeight,
                plantCode
        );

        drawCellLabel(
                cs,
                bold,
                x2,
                formBottomY,
                x3 - x2,
                rowHeight,
                "Items"
        );

        drawCellValue(
                cs,
                regular,
                x3,
                formBottomY,
                x4 - x3,
                rowHeight,
                totalItems + " | P-" + pageNo + "/" + totalPages
        );

        /* QR Cell */
        drawCenteredInBox(
                cs,
                bold,
                8,
                x4,
                formTopY - 13,
                x5 - x4,
                "SCAN QR"
        );

        byte[] qr =
                QRCodeGenerator.generateQRCode(qrData);

        PDImageXObject qrImg =
                PDImageXObject.createFromByteArray(
                        doc,
                        qr,
                        "gatepass-qr"
                );

        float qrSize = 72;
        float qrX =
                x4 + ((x5 - x4) - qrSize) / 2f;

        float qrY =
                formBottomY + 15;

        cs.drawImage(
                qrImg,
                qrX,
                qrY,
                qrSize,
                qrSize
        );
    }

    private void drawItemTable(
            PDPageContentStream cs,
            PDFont bold,
            PDFont regular,
            float tableTopY,
            List<DispatchedItem> pageItems,
            int rowOffset
    ) throws IOException {

        float x0 = MARGIN;
        float x1 = x0 + 50;
        float x2 = x1 + 220;
        float x3 = x2 + 55;
        float x4 = x3 + 45;
        float x5 = x4 + 100;
        float x6 = MARGIN + CONTENT_WIDTH;

        float headerHeight = 36;
        float rowHeight = 24;

        float tableBottomY =
                tableTopY - headerHeight - (ROWS_PER_PAGE * rowHeight);

        drawRect(
                cs,
                x0,
                tableBottomY,
                CONTENT_WIDTH,
                tableTopY - tableBottomY
        );

        /* Vertical lines */
        drawLine(cs, x1, tableBottomY, x1, tableTopY);
        drawLine(cs, x2, tableBottomY, x2, tableTopY);
        drawLine(cs, x3, tableBottomY, x3, tableTopY);
        drawLine(cs, x4, tableBottomY, x4, tableTopY);
        drawLine(cs, x5, tableBottomY, x5, tableTopY);

        /* Header bottom */
        drawLine(
                cs,
                x0,
                tableTopY - headerHeight,
                x6,
                tableTopY - headerHeight
        );

        drawCenteredInBox(
                cs,
                bold,
                10,
                x0,
                tableTopY - 21,
                x1 - x0,
                "S.No."
        );

        drawCenteredInBox(
                cs,
                bold,
                11,
                x1,
                tableTopY - 21,
                x2 - x1,
                "Description of Article"
        );

        drawCenteredInBox(
                cs,
                bold,
                9,
                x2,
                tableTopY - 15,
                x3 - x2,
                "Dwg."
        );

        drawCenteredInBox(
                cs,
                bold,
                9,
                x2,
                tableTopY - 28,
                x3 - x2,
                "No."
        );

        drawCenteredInBox(
                cs,
                bold,
                10,
                x3,
                tableTopY - 21,
                x4 - x3,
                "Qty."
        );

        drawCenteredInBox(
                cs,
                bold,
                8,
                x4,
                tableTopY - 15,
                x5 - x4,
                "Returnable / Non"
        );

        drawCenteredInBox(
                cs,
                bold,
                8,
                x4,
                tableTopY - 28,
                x5 - x4,
                "Returnable"
        );

        drawCenteredInBox(
                cs,
                bold,
                10,
                x5,
                tableTopY - 21,
                x6 - x5,
                "Remarks"
        );

        /* Row lines */
        for (int i = 0; i <= ROWS_PER_PAGE; i++) {
            float y =
                    tableTopY - headerHeight - (i * rowHeight);

            drawLine(
                    cs,
                    x0,
                    y,
                    x6,
                    y
            );
        }

        for (int i = 0; i < ROWS_PER_PAGE; i++) {

            if (i >= pageItems.size()) {
                break;
            }

            DispatchedItem item =
                    pageItems.get(i);

            float rowTop =
                    tableTopY - headerHeight - (i * rowHeight);

            float textY =
                    rowTop - 15;

            draw(
                    cs,
                    regular,
                    9,
                    x0 + 6,
                    textY,
                    String.valueOf(rowOffset + i + 1)
            );

            drawWrappedText(
                    cs,
                    regular,
                    9,
                    x1 + 5,
                    rowTop - 10,
                    x2 - x1 - 10,
                    safe(item.getName()),
                    2,
                    10
            );

            drawWrappedText(
                    cs,
                    regular,
                    8,
                    x2 + 4,
                    rowTop - 10,
                    x3 - x2 - 8,
                    safe(item.getDrawingNo()),
                    2,
                    9
            );

            draw(
                    cs,
                    regular,
                    9,
                    x3 + 12,
                    textY,
                    item.getQuantity() != null
                            ? String.valueOf(item.getQuantity())
                            : "1"
            );

            drawWrappedText(
                    cs,
                    regular,
                    8,
                    x4 + 5,
                    rowTop - 10,
                    x5 - x4 - 10,
                    returnableText(item),
                    2,
                    9
            );

            drawWrappedText(
                    cs,
                    regular,
                    8,
                    x5 + 5,
                    rowTop - 10,
                    x6 - x5 - 10,
                    safe(item.getRemarks()),
                    2,
                    9
            );
        }
    }

    private void drawSignatureSection(
            PDPageContentStream cs,
            PDFont bold
    ) throws IOException {

        float x0 = MARGIN;
        float x1 = MARGIN + (CONTENT_WIDTH / 2f);
        float x2 = MARGIN + CONTENT_WIDTH;

        float topY = 150;
        float rowHeight = 32;
        float bottomY = topY - (rowHeight * 3);

        drawRect(
                cs,
                x0,
                bottomY,
                CONTENT_WIDTH,
                topY - bottomY
        );

        drawLine(cs, x1, bottomY, x1, topY);

        drawLine(
                cs,
                x0,
                topY - rowHeight,
                x2,
                topY - rowHeight
        );

        drawLine(
                cs,
                x0,
                topY - (rowHeight * 2),
                x2,
                topY - (rowHeight * 2)
        );

        draw(
                cs,
                bold,
                10,
                x0 + 8,
                topY - 20,
                "Prepared By :"
        );

        draw(
                cs,
                bold,
                10,
                x1 + 8,
                topY - 20,
                "Checked By :"
        );

        draw(
                cs,
                bold,
                10,
                x0 + 8,
                topY - rowHeight - 20,
                "Authorised By :"
        );

        draw(
                cs,
                bold,
                10,
                x1 + 8,
                topY - rowHeight - 20,
                "Delivered By :"
        );

        draw(
                cs,
                bold,
                10,
                x0 + 8,
                topY - (rowHeight * 2) - 20,
                "Security Sign :"
        );

        draw(
                cs,
                bold,
                10,
                x1 + 8,
                topY - (rowHeight * 2) - 20,
                "Received By :"
        );
    }

    private String returnableText(
            DispatchedItem item
    ) {
        String remarks =
                safe(item.getRemarks()).toLowerCase();

        if (
                remarks.contains("non returnable") ||
                remarks.contains("non-returnable")
        ) {
            return "Non Returnable";
        }

        return "Returnable";
    }

    private void drawCellLabel(
            PDPageContentStream cs,
            PDFont font,
            float x,
            float y,
            float width,
            float height,
            String text
    ) throws IOException {
        drawCenteredInBox(
                cs,
                font,
                10,
                x,
                y + (height / 2f) - 4,
                width,
                text
        );
    }

    private void drawCellValue(
            PDPageContentStream cs,
            PDFont font,
            float x,
            float y,
            float width,
            float height,
            String text
    ) throws IOException {
        drawWrappedText(
                cs,
                font,
                9,
                x + 6,
                y + height - 13,
                width - 12,
                text,
                2,
                10
        );
    }

    private void drawCentered(
            PDPageContentStream cs,
            PDFont font,
            int size,
            float y,
            String text
    ) throws IOException {

        text = cleanPdfText(text);

        float textWidth =
                getTextWidth(
                        font,
                        size,
                        text
                );

        float x =
                (PAGE_WIDTH - textWidth) / 2f;

        draw(
                cs,
                font,
                size,
                x,
                y,
                text
        );
    }

    private void drawCenteredInBox(
            PDPageContentStream cs,
            PDFont font,
            int size,
            float x,
            float y,
            float width,
            String text
    ) throws IOException {

        text = cleanPdfText(text);

        float textWidth =
                getTextWidth(
                        font,
                        size,
                        text
                );

        float textX =
                x + ((width - textWidth) / 2f);

        draw(
                cs,
                font,
                size,
                textX,
                y,
                text
        );
    }

    private void drawWrappedText(
            PDPageContentStream cs,
            PDFont font,
            int size,
            float x,
            float y,
            float maxWidth,
            String text,
            int maxLines,
            float lineHeight
    ) throws IOException {

        text = cleanPdfText(text);

        if (text.isBlank()) {
            text = "-";
        }

        List<String> lines =
                wrapText(
                        font,
                        size,
                        text,
                        maxWidth
                );

        int count =
                Math.min(
                        lines.size(),
                        maxLines
                );

        for (int i = 0; i < count; i++) {
            String line =
                    lines.get(i);

            if (i == count - 1 && lines.size() > maxLines) {
                line =
                        trimToWidth(
                                font,
                                size,
                                line + "...",
                                maxWidth
                        );
            }

            draw(
                    cs,
                    font,
                    size,
                    x,
                    y - (i * lineHeight),
                    line
            );
        }
    }

    private List<String> wrapText(
            PDFont font,
            int size,
            String text,
            float maxWidth
    ) throws IOException {

        java.util.ArrayList<String> lines =
                new java.util.ArrayList<>();

        String[] words =
                text.split("\\s+");

        StringBuilder current =
                new StringBuilder();

        for (String word : words) {

            String candidate =
                    current.length() == 0
                            ? word
                            : current + " " + word;

            if (
                    getTextWidth(
                            font,
                            size,
                            candidate
                    ) <= maxWidth
            ) {
                current =
                        new StringBuilder(candidate);
            } else {
                if (current.length() > 0) {
                    lines.add(current.toString());
                }

                if (
                        getTextWidth(
                                font,
                                size,
                                word
                        ) > maxWidth
                ) {
                    lines.add(
                            trimToWidth(
                                    font,
                                    size,
                                    word,
                                    maxWidth
                            )
                    );

                    current =
                            new StringBuilder();
                } else {
                    current =
                            new StringBuilder(word);
                }
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

    private String trimToWidth(
            PDFont font,
            int size,
            String text,
            float maxWidth
    ) throws IOException {

        text = cleanPdfText(text);

        while (
                text.length() > 1 &&
                        getTextWidth(
                                font,
                                size,
                                text
                        ) > maxWidth
        ) {
            text =
                    text.substring(
                            0,
                            text.length() - 1
                    );
        }

        return text;
    }

    private void draw(
            PDPageContentStream cs,
            PDFont font,
            int size,
            float x,
            float y,
            String text
    ) throws IOException {

        text = cleanPdfText(text);

        cs.beginText();
        cs.setFont(font, size);
        cs.newLineAtOffset(x, y);
        cs.showText(text);
        cs.endText();
    }

    private void drawLine(
            PDPageContentStream cs,
            float x1,
            float y1,
            float x2,
            float y2
    ) throws IOException {
        cs.setLineWidth(0.9f);
        cs.moveTo(x1, y1);
        cs.lineTo(x2, y2);
        cs.stroke();
    }

    private void drawRect(
            PDPageContentStream cs,
            float x,
            float y,
            float width,
            float height
    ) throws IOException {
        cs.setLineWidth(1f);
        cs.addRect(x, y, width, height);
        cs.stroke();
    }

    private float getTextWidth(
            PDFont font,
            int fontSize,
            String text
    ) throws IOException {
        text = cleanPdfText(text);

        return font.getStringWidth(text) / 1000f * fontSize;
    }

    private String firstNonBlank(
            String... values
    ) {
        if (values == null) {
            return "-";
        }

        for (String value : values) {
            if (value != null && !value.trim().isBlank()) {
                return value.trim();
            }
        }

        return "-";
    }

    private String safe(
            String value
    ) {
        if (value == null || value.trim().isBlank()) {
            return "-";
        }

        return value.trim();
    }

    private String cleanPdfText(
            String value
    ) {
        if (value == null) {
            return "-";
        }

        String text =
                value
                        .replace("\r", " ")
                        .replace("\n", " ")
                        .trim();

        if (text.isBlank()) {
            return "-";
        }

        /*
         * PDFBox standard Helvetica cannot print every Unicode character.
         * This prevents PDF generation failure.
         */
        return text.replaceAll("[^\\x20-\\x7E]", "");
    }
}