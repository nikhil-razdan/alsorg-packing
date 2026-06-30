package com.alsorg.packing.service.pdf;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDFont;
import org.apache.pdfbox.pdmodel.font.PDType1Font;

import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

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
            ChalaanPdfData data
    ) {
        List<ChalaanItem> items =
                data != null && data.getItems() != null
                        ? data.getItems()
                        : Collections.emptyList();

        ChalaanItem firstItem =
                !items.isEmpty()
                        ? items.get(0)
                        : null;

        String pdNo =
                buildAllPdNos(items);

        String clientName =
                firstItem != null
                        ? safe(firstItem.getClientName())
                        : "-";

        String address =
                firstItem != null
                        ? safe(firstItem.getClientAddress())
                        : safe(data != null ? data.getAddress() : null);

        String challanNo =
                safe(data != null ? data.getVoucherNo() : null);

        String driverName =
                safe(data != null ? data.getDriverName() : null);

        String vehicleNo =
                safe(data != null ? data.getVehicleNumber() : null);

        String date =
                LocalDate.now(ZoneId.of("Asia/Kolkata"))
                        .format(DateTimeFormatter.ofPattern("dd-MM-yyyy"));

        try (PDDocument doc = new PDDocument()) {
            PDFont bold = PDType1Font.HELVETICA_BOLD;
            PDFont regular = PDType1Font.HELVETICA;

            PDPage page =
                    new PDPage(new PDRectangle(PAGE_WIDTH, PAGE_HEIGHT));

            doc.addPage(page);

            PDPageContentStream cs =
                    new PDPageContentStream(doc, page);

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
                    vehicleNo
            );

            float y = 580;
            int sr = 1;

            if (items.isEmpty()) {
                drawText(
                        cs,
                        regular,
                        10,
                        110,
                        y,
                        "No items found for this challan"
                );
            }

            for (ChalaanItem item : items) {
                if (item == null) {
                    continue;
                }

                String fullDesc =
                        "PD No: " + safe(item.getPdNo()) + " | "
                                + "Item: " + safe(item.getItemName()) + " | "
                                + "Dwg No: " + safe(item.getDrawingNo()) + " | "
                                + "Desc: " + safe(item.getDescription());

                String remarks =
                        safe(item.getRemarks());

                int descLines =
                        countWrappedLines(
                                regular,
                                10,
                                300,
                                fullDesc
                        );

                int remarksLines =
                        countWrappedLines(
                                regular,
                                10,
                                120,
                                remarks
                        );

                int lineCount =
                        Math.max(
                                Math.max(descLines, remarksLines),
                                1
                        );

                float rowHeight =
                        Math.max(28, lineCount * 14 + 12);

                if (y - rowHeight < TABLE_BOTTOM + 8) {
                    drawFooter(cs, regular);
                    cs.close();

                    page =
                            new PDPage(new PDRectangle(PAGE_WIDTH, PAGE_HEIGHT));

                    doc.addPage(page);

                    cs =
                            new PDPageContentStream(doc, page);

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
                            vehicleNo
                    );

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
                        String.valueOf(sr)
                );

                drawWrappedText(
                        cs,
                        regular,
                        10,
                        110,
                        rowTop,
                        300,
                        fullDesc
                );

                drawWrappedText(
                        cs,
                        regular,
                        10,
                        430,
                        rowTop,
                        120,
                        remarks
                );

                drawLine(
                        cs,
                        LEFT,
                        rowBottom,
                        RIGHT,
                        rowBottom
                );

                y = rowBottom - 14;
                sr++;
            }

            drawFooter(cs, regular);
            cs.close();

            ByteArrayOutputStream out =
                    new ByteArrayOutputStream();

            doc.save(out);

            return out.toByteArray();

        } catch (IOException e) {
            throw new RuntimeException("Failed to generate challan PDF", e);
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
            String vehicleNo
    ) throws IOException {

        drawCenteredText(
                cs,
                bold,
                20,
                760,
                "External Movement Challan"
        );

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
                vehicleNo
        );

        drawLine(cs, LEFT, 640, RIGHT, 640);

        drawTableFrame(cs, bold);
    }

    private void drawTableFrame(
            PDPageContentStream cs,
            PDFont bold
    ) throws IOException {

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
                "SR.NO"
        );

        drawCenteredTextInBox(
                cs,
                bold,
                10,
                SR_RIGHT,
                DESC_RIGHT,
                605,
                "DESCRIPTION"
        );

        drawCenteredTextInBox(
                cs,
                bold,
                10,
                DESC_RIGHT,
                REMARK_RIGHT,
                605,
                "REMARKS"
        );
    }

    private void drawFooter(
            PDPageContentStream cs,
            PDFont regular
    ) throws IOException {

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
            String vehicleNo
    ) throws IOException {

        drawText(cs, regular, 10, 40, 710, "P.D. No:");

        float pdEndY =
                drawWrappedText(
                        cs,
                        regular,
                        9,
                        95,
                        710,
                        240,
                        pdNo
                );

        float clientY =
                Math.min(690, pdEndY - 18);

        float addressY =
                clientY - 18;

        drawText(
                cs,
                regular,
                10,
                40,
                clientY,
                "Client Name: " + safe(clientName)
        );

        drawWrappedText(
                cs,
                regular,
                9,
                40,
                addressY,
                290,
                "Address: " + safe(address)
        );

        drawText(cs, regular, 10, 350, 710, "Date: " + safe(date));
        drawText(cs, regular, 10, 350, 690, "Challan No: " + safe(challanNo));
        drawText(cs, regular, 10, 350, 670, "Driver Name: " + safe(driverName));
        drawText(cs, regular, 10, 350, 650, "Vehicle No: " + safe(vehicleNo));
    }

    private void drawCenteredText(
            PDPageContentStream cs,
            PDFont font,
            int size,
            float y,
            String text
    ) throws IOException {

        text = cleanPdfText(safe(text));

        float textWidth =
                font.getStringWidth(text) / 1000 * size;

        float x =
                (PAGE_WIDTH - textWidth) / 2;

        drawText(cs, font, size, x, y, text);
    }

    private void drawCenteredTextInBox(
            PDPageContentStream cs,
            PDFont font,
            int size,
            float x1,
            float x2,
            float y,
            String text
    ) throws IOException {

        text = cleanPdfText(safe(text));

        float textWidth =
                font.getStringWidth(text) / 1000 * size;

        float x =
                x1 + ((x2 - x1) - textWidth) / 2;

        drawText(cs, font, size, x, y, text);
    }

    private void drawText(
            PDPageContentStream cs,
            PDFont font,
            int size,
            float x,
            float y,
            String text
    ) throws IOException {

        String safeText =
                cleanPdfText(safe(text));

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
            float y2
    ) throws IOException {
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
            String text
    ) throws IOException {

        String safeText =
                cleanPdfText(safe(text));

        String[] words =
                safeText.split("\\s+");

        StringBuilder line =
                new StringBuilder();

        for (String word : words) {
            String test =
                    line.length() == 0
                            ? word
                            : line + " " + word;

            float width =
                    font.getStringWidth(test) / 1000 * fontSize;

            if (width > maxWidth && line.length() > 0) {
                drawText(
                        cs,
                        font,
                        fontSize,
                        x,
                        y,
                        line.toString()
                );

                line =
                        new StringBuilder(word);

                y -= 14;
            } else {
                line =
                        new StringBuilder(test);
            }
        }

        if (line.length() > 0) {
            drawText(
                    cs,
                    font,
                    fontSize,
                    x,
                    y,
                    line.toString()
            );
        }

        return y;
    }

    private int countWrappedLines(
            PDFont font,
            int fontSize,
            float maxWidth,
            String text
    ) throws IOException {

        String safeText =
                cleanPdfText(safe(text));

        String[] words =
                safeText.split("\\s+");

        int lines = 1;

        StringBuilder line =
                new StringBuilder();

        for (String word : words) {
            String test =
                    line.length() == 0
                            ? word
                            : line + " " + word;

            float width =
                    font.getStringWidth(test) / 1000 * fontSize;

            if (width > maxWidth && line.length() > 0) {
                lines++;
                line =
                        new StringBuilder(word);
            } else {
                line =
                        new StringBuilder(test);
            }
        }

        return Math.max(lines, 1);
    }

    private String buildAllPdNos(
            List<ChalaanItem> items
    ) {
        Set<String> pdNos =
                new LinkedHashSet<>();

        if (items != null) {
            for (ChalaanItem item : items) {
                if (item == null) {
                    continue;
                }

                String pd =
                        safe(item.getPdNo());

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
            Object value
    ) {
        if (value == null) {
            return "-";
        }

        String text =
                value.toString().trim();

        return text.isEmpty()
                ? "-"
                : text;
    }

    private String cleanPdfText(
            String text
    ) {
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
}