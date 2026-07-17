package com.alsorg.packing.service.pdf;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.lang.reflect.Method;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.PDPageContentStream.AppendMode;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDFont;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.springframework.stereotype.Service;

import com.alsorg.packing.domain.qrcodegenerator.QRCodeGenerator;
import com.alsorg.packing.service.pdf.dto.StickerPdfData;

@Service
public class PdfStickerService {

    private static final float PAGE_WIDTH = 600;
    private static final float PAGE_HEIGHT = 350;

    private static final Color BLACK = Color.BLACK;
    private static final Color WHITE = Color.WHITE;

    public byte[] generateSticker(StickerPdfData data) {

        PDFont regular = PDType1Font.HELVETICA;
        PDFont bold = PDType1Font.HELVETICA_BOLD;

        try (PDDocument document = new PDDocument()) {

            PDPage page = new PDPage(new PDRectangle(PAGE_WIDTH, PAGE_HEIGHT));
            document.addPage(page);

            try (PDPageContentStream cs = new PDPageContentStream(
                    document,
                    page,
                    AppendMode.OVERWRITE,
                    true,
                    true)) {

                boolean hardwareSticker = data.isHardwareSticker();

                String rawDescription = data.getDescription() == null
                        ? "-"
                        : data.getDescription();

                String description = hardwareSticker
                        ? rawDescription
                        : firstNonBlank(
                                reflectValue(
                                        data,
                                        "getPackingContents",
                                        "getContents"),
                                safe(data.getDescription()),
                                "-");

                String stickerNo = safe(data.getStickerNumber());
                String pdNo = safe(data.getPdNo());
                String drawingNo = safe(data.getDrawingNo());

                String packetNo = firstNonBlank(
                        data.getPacketNo(),
                        reflectValue(
                                data,
                                "getPacketNumber",
                                "getPacket"),
                        extractPacketNo(safe(data.getItemName())),
                        extractPacketNo(safe(data.getDescription())),
                        "-");

                packetNo = cleanPacket(packetNo);

                String floor = compactFloor(firstNonBlank(
                        safe(data.getFloor()),
                        "-"));

                String itemName = cleanItemName(safe(data.getItemName()));

                String packingDate = firstNonBlank(
                        normalizeDate(reflectValue(data, "getPackingDate", "getPackedDate", "getCreatedAt")),
                        todayIndia());

                String clientName = safe(data.getClientName());
                String clientAddress = safe(data.getClientAddress());

                String remarks = firstNonBlank(
                        safe(data.getRemarks()),
                        reflectValue(data, "getRemark", "getSpecialInstructions", "getPackingRemarks"),
                        "-");

                String dimensions = cleanDimensionValue(safe(data.getDimensions()));

                String volume = firstNonBlank(
                        reflectValue(data, "getVolume", "getVolumeCbm", "getCbm"),
                        extractVolumeFromText(safe(data.getDimensions())),
                        "-");
                volume = cleanVolume(volume);

                String weight = cleanWeight(safe(data.getWeight()));

                String codeSku = firstNonBlank(
                        data.getSku(),
                        reflectValue(
                                data,
                                "getCode",
                                "getItemCode",
                                "getPacketSku"),
                        buildWorkCode(pdNo, drawingNo, packetNo),
                        "-");

                /* ================= BACKGROUND ================= */
                cs.setNonStrokingColor(WHITE);
                cs.addRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
                cs.fill();

                /* ================= OUTER BORDER ================= */
                drawRoundRect(cs, 5, 5, PAGE_WIDTH - 10, PAGE_HEIGHT - 10, 14, null, BLACK, 1.8f);

                /* ================= HEADER ================= */
                float headerX = 14;
                float headerY = 306;
                float headerW = 572;
                float headerH = 36;

                drawRoundRect(cs, headerX, headerY, headerW, headerH, 7, BLACK, BLACK, 1.2f);

                if (data.isShowCompanyHeader()) {
                    drawTextWithFont(cs, bold, 23.5f, headerX + 16, headerY + 11, "ALSORG", WHITE);
                }

                if (data.getPrintIteration() > 1) {
                    drawTextWithFont(
                            cs,
                            bold,
                            14,
                            headerX + 122,
                            headerY + 13,
                            String.valueOf(data.getPrintIteration()),
                            WHITE);
                }

                String topBadge = "PACKET " + packetNo + " | FLOOR " + floor;

                drawRoundRect(cs, 420, 316, 150, 24, 7, WHITE, BLACK, 1.2f);
                drawCenteredFitText(
                        cs,
                        bold,
                        10.4f,
                        7.2f,
                        420,
                        316,
                        150,
                        24,
                        topBadge,
                        BLACK);

                /* ================= BODY GRID ================= */
                float leftX = 18;
                float qrX = 448;
                float leftW = qrX - leftX - 12;

                /* ================= TOP ITEM SECTION ================= */
                drawRoundRect(cs, leftX, 250, leftW, 42, 5, WHITE, BLACK, 1.1f);
                drawLine(cs, leftX + 2, 292, leftX + leftW - 2, 292, BLACK, 1.5f);

                drawTextWithFont(cs, bold, 9.2f, leftX + 8, 276, "ITEM", BLACK);

                // Only this part is changed: item name now auto-fits inside its box.
                drawItemNameAdaptive(cs, bold, leftX + 8, 257, leftW - 16, itemName);

                /* ================= QR PANEL ================= */
                float qrPanelX = qrX;
                float qrPanelY = 154;
                float qrPanelW = 133;
                float qrPanelH = 138;

                drawRoundRect(cs, qrPanelX, qrPanelY, qrPanelW, qrPanelH, 8, WHITE, BLACK, 1.1f);

                String qrData = data.getQrPayload() != null && !data.getQrPayload().isBlank()
                        ? data.getQrPayload()
                        : "ALSORG|SN=" + stickerNo;

                byte[] qrBytes;
                try {
                    qrBytes = QRCodeGenerator.generateQRCode(qrData);
                } catch (Exception e) {
                    throw new RuntimeException("QR generation failed", e);
                }

                PDImageXObject qrImage = PDImageXObject.createFromByteArray(document, qrBytes, "qr");

                float qrSize = 124;
                float qrImageX = qrPanelX + ((qrPanelW - qrSize) / 2);
                float qrImageY = qrPanelY + ((qrPanelH - qrSize) / 2);
                cs.drawImage(qrImage, qrImageX, qrImageY, qrSize, qrSize);

                /* ================= INFO CARDS ================= */
                float cardY = 207;
                float cardH = 36;

                drawInfoCard(cs, bold, leftX, cardY, 84, cardH, "PD NO.", pdNo);
                drawInfoCard(cs, bold, leftX + 94, cardY, 84, cardH, "DRAWING", drawingNo);
                drawInfoCard(cs, bold, leftX + 188, cardY, 112, cardH, "PACKING DATE", packingDate);
                drawInfoCard(cs, bold, leftX + 310, cardY, leftW - 310, cardH, "CODE / SKU", codeSku);

                /* ================= CLIENT / SITE ================= */
                drawClientSiteBox(
                        cs,
                        bold,
                        regular,
                        leftX,
                        149,
                        leftW,
                        49,
                        clientName,
                        clientAddress);

                /*
                 * Remarks integration:
                 * If remarks are not available, old layout remains unchanged.
                 * If remarks exist, only lower rows are compacted to insert REMARKS.
                 */
                if (hardwareSticker) {

                    drawHardwareTrackingDescription(
                            cs,
                            bold,
                            regular,
                            stickerNo,
                            rawDescription);

                    /*
                     * Signature remains exactly as the normal sticker.
                     */
                    drawRoundRect(
                            cs,
                            18,
                            13,
                            563,
                            30,
                            6,
                            WHITE,
                            BLACK,
                            1.1f);

                    drawSignatureBlock(
                            cs,
                            bold,
                            42,
                            33,
                            21.5f,
                            135,
                            "Prepared By");

                    drawSignatureBlock(
                            cs,
                            bold,
                            232,
                            33,
                            21.5f,
                            135,
                            "Checked By");

                    drawSignatureBlock(
                            cs,
                            bold,
                            423,
                            33,
                            21.5f,
                            135,
                            "Delivered By");

                } else {

                    boolean hasRemarks = remarks != null
                            && !remarks.isBlank()
                            && !remarks.equals("-");

                    float snoY = hasRemarks ? 105 : 100;
                    float snoH = hasRemarks ? 40 : 45;

                    float snoLabelY = 132;
                    float snoValueY = hasRemarks ? 116 : 114;
                    float descriptionLabelY = 132;
                    float descriptionValueY = 119;
                    float dividerTopY = 140;
                    float dividerBottomY = hasRemarks ? 110 : 105;

                    float bottomInfoY = hasRemarks ? 48 : 58;

                    float bottomInfoH = hasRemarks ? 25 : 34;

                    float signatureY = hasRemarks ? 13 : 17;

                    float signatureH = hasRemarks ? 30 : 33;

                    float signatureLabelY = hasRemarks ? 33 : 36;

                    float signatureLineY = hasRemarks ? 21.5f : 24.5f;

                    drawRoundRect(
                            cs,
                            18,
                            snoY,
                            563,
                            snoH,
                            6,
                            WHITE,
                            BLACK,
                            1.1f);

                    float serialX = 28;
                    float dividerX = 176;
                    float descriptionX = 190;
                    float descriptionMaxWidth = 378;

                    drawTextWithFont(
                            cs,
                            bold,
                            7.7f,
                            serialX,
                            snoLabelY,
                            "SNO / TRACKING ID",
                            BLACK);

                    drawFitText(
                            cs,
                            bold,
                            8.9f,
                            6.4f,
                            serialX,
                            snoValueY,
                            dividerX - serialX - 12,
                            stickerNo,
                            BLACK);

                    drawLine(
                            cs,
                            dividerX,
                            dividerBottomY,
                            dividerX,
                            dividerTopY,
                            BLACK,
                            0.8f);

                    drawTextWithFont(
                            cs,
                            bold,
                            8.2f,
                            descriptionX,
                            descriptionLabelY,
                            "DESCRIPTION",
                            BLACK);

                    drawWrappedFitText(
                            cs,
                            bold,
                            8.7f,
                            5.7f,
                            descriptionX,
                            descriptionValueY,
                            descriptionMaxWidth,
                            hasRemarks ? 25 : 30,
                            description,
                            BLACK);

                    if (hasRemarks) {
                        drawRemarksBox(
                                cs,
                                bold,
                                18,
                                78,
                                563,
                                24,
                                remarks);
                    }

                    drawBottomInfoCard(
                            cs,
                            bold,
                            18,
                            bottomInfoY,
                            250,
                            bottomInfoH,
                            "DIMENSION",
                            dimensions);

                    drawBottomInfoCard(
                            cs,
                            bold,
                            278,
                            bottomInfoY,
                            100,
                            bottomInfoH,
                            "VOLUME",
                            volume);

                    drawBottomInfoCard(
                            cs,
                            bold,
                            388,
                            bottomInfoY,
                            193,
                            bottomInfoH,
                            "WEIGHT",
                            weight);

                    drawRoundRect(
                            cs,
                            18,
                            signatureY,
                            563,
                            signatureH,
                            6,
                            WHITE,
                            BLACK,
                            1.1f);

                    drawSignatureBlock(
                            cs,
                            bold,
                            42,
                            signatureLabelY,
                            signatureLineY,
                            135,
                            "Prepared By");

                    drawSignatureBlock(
                            cs,
                            bold,
                            232,
                            signatureLabelY,
                            signatureLineY,
                            135,
                            "Checked By");

                    drawSignatureBlock(
                            cs,
                            bold,
                            423,
                            signatureLabelY,
                            signatureLineY,
                            135,
                            "Delivered By");
                }
            }

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            document.save(out);
            return out.toByteArray();

        } catch (IOException e) {
            throw new RuntimeException(e);
        }
    }

    /* ================= DRAW HELPERS ================= */

    private void drawItemNameAdaptive(
            PDPageContentStream cs,
            PDFont font,
            float x,
            float y,
            float maxWidth,
            String itemName) throws IOException {

        itemName = cleanPdfText(itemName);

        /*
         * First try: keep the current big one-line style.
         */
        float fontSize = 23.5f;

        while (fontSize >= 13f) {
            if (textWidth(font, fontSize, itemName) <= maxWidth) {
                drawTextWithFont(cs, font, fontSize, x, y, itemName, BLACK);
                return;
            }
            fontSize -= 0.5f;
        }

        /*
         * Second try: for very long item names, wrap inside the same item box.
         * This does not change the box size or layout.
         */
        drawWrappedFitText(
                cs,
                font,
                10.2f,
                6.4f,
                x,
                y + 8,
                maxWidth,
                21,
                itemName,
                BLACK);
    }

    private void drawHardwareTrackingDescription(
            PDPageContentStream cs,
            PDFont bold,
            PDFont regular,
            String stickerNumber,
            String rawDescription) throws IOException {

        /*
         * Covers all space previously used by:
         * - SNO / Description
         * - Remarks
         * - Dimension
         * - Volume
         * - Weight
         */
        float boxX = 18;
        float boxY = 48;
        float boxW = 563;
        float boxH = 97;

        drawRoundRect(
                cs,
                boxX,
                boxY,
                boxW,
                boxH,
                6,
                WHITE,
                BLACK,
                1.1f);

        float dividerX = 163;

        drawLine(
                cs,
                dividerX,
                boxY + 5,
                dividerX,
                boxY + boxH - 5,
                BLACK,
                0.8f);

        drawTextWithFont(
                cs,
                bold,
                7.7f,
                boxX + 10,
                boxY + boxH - 15,
                "SNO / TRACKING ID",
                BLACK);

        drawWrappedFitText(
                cs,
                bold,
                10.2f,
                6.3f,
                boxX + 10,
                boxY + boxH - 35,
                dividerX - boxX - 20,
                boxH - 42,
                stickerNumber,
                BLACK);

        float descriptionX = dividerX + 12;
        float descriptionWidth = boxX + boxW - descriptionX - 10;

        drawTextWithFont(
                cs,
                bold,
                8.3f,
                descriptionX,
                boxY + boxH - 15,
                "DESCRIPTION",
                BLACK);

        drawHardwareItemLines(
                cs,
                regular,
                descriptionX,
                boxY + boxH - 31,
                descriptionWidth,
                boxH - 38,
                rawDescription);
    }

    private void drawHardwareItemLines(
            PDPageContentStream cs,
            PDFont font,
            float x,
            float startY,
            float maxWidth,
            float maxHeight,
            String description) throws IOException {

        String raw = description == null || description.isBlank()
                ? "-"
                : description.trim();

        String[] sourceLines = raw.split("\\R");

        float fontSize = 8.2f;
        float minimumFontSize = 5.2f;

        while (fontSize >= minimumFontSize) {
            float leading = fontSize + 1.6f;

            List<String> renderedLines = wrapHardwareSourceLines(
                    font,
                    fontSize,
                    sourceLines,
                    maxWidth);

            float requiredHeight = renderedLines.size() * leading;

            if (requiredHeight <= maxHeight) {
                for (int index = 0; index < renderedLines.size(); index++) {

                    drawTextWithFont(
                            cs,
                            font,
                            fontSize,
                            x,
                            startY - (index * leading),
                            renderedLines.get(index),
                            BLACK);
                }

                return;
            }

            fontSize -= 0.4f;
        }

        float leading = minimumFontSize + 1.6f;

        List<String> renderedLines = wrapHardwareSourceLines(
                font,
                minimumFontSize,
                sourceLines,
                maxWidth);

        int maximumLines = Math.max(
                1,
                (int) Math.floor(maxHeight / leading));

        for (int index = 0; index < Math.min(
                maximumLines,
                renderedLines.size()); index++) {

            String line = renderedLines.get(index);

            if (index == maximumLines - 1
                    && renderedLines.size() > maximumLines) {
                line = truncateToWidth(
                        font,
                        minimumFontSize,
                        line + "...",
                        maxWidth);
            }

            drawTextWithFont(
                    cs,
                    font,
                    minimumFontSize,
                    x,
                    startY - (index * leading),
                    line,
                    BLACK);
        }
    }

    private List<String> wrapHardwareSourceLines(
            PDFont font,
            float fontSize,
            String[] sourceLines,
            float maxWidth) throws IOException {

        List<String> output = new ArrayList<>();

        if (sourceLines == null
                || sourceLines.length == 0) {
            output.add("-");
            return output;
        }

        for (String sourceLine : sourceLines) {
            String cleaned = cleanPdfText(sourceLine);

            if (cleaned.isBlank()) {
                continue;
            }

            output.addAll(
                    wrapLines(
                            font,
                            fontSize,
                            cleaned,
                            maxWidth));
        }

        if (output.isEmpty()) {
            output.add("-");
        }

        return output;
    }

    private void drawRemarksBox(
            PDPageContentStream cs,
            PDFont bold,
            float x,
            float y,
            float w,
            float h,
            String remarks) throws IOException {

        drawRoundRect(cs, x, y, w, h, 6, WHITE, BLACK, 1.1f);

        drawTextWithFont(cs, bold, 7.6f, x + 8, y + h - 9, "REMARKS", BLACK);

        drawWrappedFitText(
                cs,
                bold,
                8.1f,
                5.6f,
                x + 8,
                y + 7,
                w - 16,
                10,
                remarks,
                BLACK);
    }

    private void drawClientSiteBox(
            PDPageContentStream cs,
            PDFont bold,
            PDFont regular,
            float x,
            float y,
            float w,
            float h,
            String clientName,
            String clientAddress) throws IOException {

        drawRoundRect(cs, x, y, w, h, 6, WHITE, BLACK, 1.1f);

        drawTextWithFont(cs, bold, 8.4f, x + 8, y + h - 14, "CLIENT / SITE", BLACK);

        drawFitText(cs, bold, 13.2f, 8.2f, x + 8, y + 22, w - 16, clientName, BLACK);
        drawFitText(cs, regular, 10.6f, 7.2f, x + 8, y + 11, w - 16, clientAddress, BLACK);
    }

    private void drawInfoCard(
            PDPageContentStream cs,
            PDFont bold,
            float x,
            float y,
            float w,
            float h,
            String label,
            String value) throws IOException {

        drawRoundRect(cs, x, y, w, h, 5, WHITE, BLACK, 1.1f);
        drawLine(cs, x + 2, y + h, x + w - 2, y + h, BLACK, 1.3f);

        drawTextWithFont(cs, bold, 8.1f, x + 7, y + h - 13, label, BLACK);
        drawFitText(cs, bold, 12.8f, 7.2f, x + 7, y + 8, w - 14, value, BLACK);
    }

    private void drawBottomInfoCard(
            PDPageContentStream cs,
            PDFont bold,
            float x,
            float y,
            float w,
            float h,
            String label,
            String value) throws IOException {

        drawRoundRect(cs, x, y, w, h, 5, WHITE, BLACK, 1.1f);
        drawLine(cs, x + 2, y + h, x + w - 2, y + h, BLACK, 1.3f);

        if (h < 30) {
            drawTextWithFont(cs, bold, 7.1f, x + 7, y + h - 9, label, BLACK);
            drawFitText(cs, bold, 8.9f, 6.6f, x + 7, y + 6.5f, w - 14, value, BLACK);
        } else {
            drawTextWithFont(cs, bold, 7.8f, x + 7, y + h - 12, label, BLACK);
            drawFitText(cs, bold, 10.5f, 7, x + 7, y + 9, w - 14, value, BLACK);
        }
    }

    private void drawSignatureBlock(
            PDPageContentStream cs,
            PDFont font,
            float x,
            float labelY,
            float lineY,
            float w,
            String label) throws IOException {

        float labelWidth = font.getStringWidth(label) / 1000 * 8.4f;
        float labelX = x + ((w - labelWidth) / 2);

        drawTextWithFont(cs, font, 8.4f, labelX, labelY, label, BLACK);
        drawLine(cs, x + 12, lineY, x + w - 12, lineY, BLACK, 0.9f);
    }

    private void drawTextWithFont(
            PDPageContentStream cs,
            PDFont font,
            float fontSize,
            float x,
            float y,
            String text,
            Color color) throws IOException {

        cs.beginText();
        cs.setNonStrokingColor(color);
        cs.setFont(font, fontSize);
        cs.newLineAtOffset(x, y);
        cs.showText(cleanPdfText(text));
        cs.endText();
    }

    private void drawCenteredText(
            PDPageContentStream cs,
            PDFont font,
            float fontSize,
            float x,
            float y,
            float w,
            float h,
            String text,
            Color color) throws IOException {

        text = cleanPdfText(text);
        float textWidth = font.getStringWidth(text) / 1000 * fontSize;
        float tx = x + ((w - textWidth) / 2);
        float ty = y + ((h - fontSize) / 2) + 2;

        drawTextWithFont(cs, font, fontSize, tx, ty, text, color);
    }

    private void drawCenteredFitText(
            PDPageContentStream cs,
            PDFont font,
            float startFont,
            float minFont,
            float x,
            float y,
            float w,
            float h,
            String text,
            Color color) throws IOException {

        text = cleanPdfText(text);
        float fontSize = startFont;

        while (fontSize >= minFont) {
            float textWidth = font.getStringWidth(text) / 1000 * fontSize;

            if (textWidth <= w - 12) {
                drawCenteredText(cs, font, fontSize, x, y, w, h, text, color);
                return;
            }

            fontSize -= 0.5f;
        }

        drawCenteredText(
                cs,
                font,
                minFont,
                x,
                y,
                w,
                h,
                truncateToWidth(font, minFont, text, w - 12),
                color);
    }

    private void drawFitText(
            PDPageContentStream cs,
            PDFont font,
            float startFont,
            float minFont,
            float x,
            float y,
            float maxWidth,
            String text,
            Color color) throws IOException {

        text = cleanPdfText(text);
        float fontSize = startFont;

        while (fontSize >= minFont) {
            float textWidth = font.getStringWidth(text) / 1000 * fontSize;

            if (textWidth <= maxWidth) {
                drawTextWithFont(cs, font, fontSize, x, y, text, color);
                return;
            }

            fontSize -= 0.5f;
        }

        drawTextWithFont(cs, font, minFont, x, y, truncateToWidth(font, minFont, text, maxWidth), color);
    }

    private void drawWrappedFitText(
            PDPageContentStream cs,
            PDFont font,
            float startFont,
            float minFont,
            float x,
            float y,
            float maxWidth,
            float maxHeight,
            String text,
            Color color) throws IOException {

        text = cleanPdfText(text);
        float fontSize = startFont;

        while (fontSize >= minFont) {
            float leading = fontSize + 1.8f;
            int maxLines = Math.max(1, (int) Math.floor(maxHeight / leading));

            List<String> lines = wrapLines(font, fontSize, text, maxWidth);

            if (lines.size() <= maxLines) {
                for (int i = 0; i < lines.size(); i++) {
                    drawTextWithFont(cs, font, fontSize, x, y - (i * leading), lines.get(i), color);
                }
                return;
            }

            fontSize -= 0.5f;
        }

        float leading = minFont + 1.8f;
        int maxLines = Math.max(1, (int) Math.floor(maxHeight / leading));
        List<String> lines = wrapLines(font, minFont, text, maxWidth);

        for (int i = 0; i < Math.min(lines.size(), maxLines); i++) {
            String line = lines.get(i);

            if (i == maxLines - 1 && lines.size() > maxLines) {
                line = truncateToWidth(font, minFont, line, maxWidth);
            }

            drawTextWithFont(cs, font, minFont, x, y - (i * leading), line, color);
        }
    }

    private List<String> wrapLines(
            PDFont font,
            float fontSize,
            String text,
            float maxWidth) throws IOException {

        List<String> lines = new ArrayList<>();

        if (text == null || text.isBlank()) {
            lines.add("-");
            return lines;
        }

        String[] words = text.split(" ");
        StringBuilder line = new StringBuilder();

        for (String word : words) {
            if (word == null || word.isBlank())
                continue;

            if (textWidth(font, fontSize, word) > maxWidth) {
                if (line.length() > 0) {
                    lines.add(line.toString());
                    line = new StringBuilder();
                }

                lines.addAll(splitLongWord(font, fontSize, word, maxWidth));
                continue;
            }

            String candidate = line.length() == 0 ? word : line + " " + word;

            if (textWidth(font, fontSize, candidate) <= maxWidth) {
                line = new StringBuilder(candidate);
            } else {
                if (line.length() > 0) {
                    lines.add(line.toString());
                }
                line = new StringBuilder(word);
            }
        }

        if (line.length() > 0) {
            lines.add(line.toString());
        }

        return lines;
    }

    private List<String> splitLongWord(
            PDFont font,
            float fontSize,
            String word,
            float maxWidth) throws IOException {

        List<String> result = new ArrayList<>();
        StringBuilder part = new StringBuilder();

        for (int i = 0; i < word.length(); i++) {
            String candidate = part.toString() + word.charAt(i);

            if (textWidth(font, fontSize, candidate) <= maxWidth) {
                part.append(word.charAt(i));
            } else {
                if (part.length() > 0) {
                    result.add(part.toString());
                }
                part = new StringBuilder(String.valueOf(word.charAt(i)));
            }
        }

        if (part.length() > 0) {
            result.add(part.toString());
        }

        return result;
    }

    private float textWidth(PDFont font, float fontSize, String text) throws IOException {
        return font.getStringWidth(cleanPdfText(text)) / 1000 * fontSize;
    }

    private String truncateToWidth(
            PDFont font,
            float fontSize,
            String text,
            float maxWidth) throws IOException {

        String suffix = "...";
        String result = cleanPdfText(text);

        while (result.length() > 0) {
            String candidate = result + suffix;
            float width = font.getStringWidth(candidate) / 1000 * fontSize;

            if (width <= maxWidth) {
                return candidate;
            }

            result = result.substring(0, result.length() - 1);
        }

        return suffix;
    }

    private void drawLine(
            PDPageContentStream cs,
            float x1,
            float y1,
            float x2,
            float y2,
            Color color,
            float width) throws IOException {

        cs.setStrokingColor(color);
        cs.setLineWidth(width);
        cs.moveTo(x1, y1);
        cs.lineTo(x2, y2);
        cs.stroke();
    }

    private void drawRoundRect(
            PDPageContentStream cs,
            float x,
            float y,
            float w,
            float h,
            float r,
            Color fill,
            Color stroke,
            float lineWidth) throws IOException {

        final float k = 0.55228475f;

        cs.moveTo(x + r, y);
        cs.lineTo(x + w - r, y);
        cs.curveTo(x + w - r + k * r, y, x + w, y + r - k * r, x + w, y + r);
        cs.lineTo(x + w, y + h - r);
        cs.curveTo(x + w, y + h - r + k * r, x + w - r + k * r, y + h, x + w - r, y + h);
        cs.lineTo(x + r, y + h);
        cs.curveTo(x + r - k * r, y + h, x, y + h - r + k * r, x, y + h - r);
        cs.lineTo(x, y + r);
        cs.curveTo(x, y + r - k * r, x + r - k * r, y, x + r, y);
        cs.closePath();

        if (fill != null) {
            cs.setNonStrokingColor(fill);
        }

        if (stroke != null) {
            cs.setStrokingColor(stroke);
            cs.setLineWidth(lineWidth);
        }

        if (fill != null && stroke != null) {
            cs.fillAndStroke();
        } else if (fill != null) {
            cs.fill();
        } else if (stroke != null) {
            cs.stroke();
        }
    }

    /* ================= DATA HELPERS ================= */

    private String safe(Object v) {
        if (v == null)
            return "-";

        String s = v.toString().trim();

        if (s.isBlank())
            return "-";

        return cleanPdfText(s);
    }

    private String firstNonBlank(String... values) {
        if (values == null)
            return "-";

        for (String value : values) {
            if (value == null)
                continue;

            String cleaned = value.trim();

            if (!cleaned.isBlank() && !cleaned.equals("-")) {
                return cleaned;
            }
        }

        return "-";
    }

    private String reflectValue(Object target, String... methodNames) {
        if (target == null || methodNames == null)
            return "";

        for (String methodName : methodNames) {
            try {
                Method method = target.getClass().getMethod(methodName);
                Object value = method.invoke(target);

                if (value != null) {
                    String text = value.toString().trim();

                    if (!text.isBlank()) {
                        return cleanPdfText(text);
                    }
                }
            } catch (Exception ignored) {
                // Optional DTO getter may not exist.
            }
        }

        return "";
    }

    private String todayIndia() {
        return LocalDateTime.now(ZoneId.of("Asia/Kolkata"))
                .format(DateTimeFormatter.ofPattern("dd-MM-yyyy"));
    }

    private String normalizeDate(String value) {
        if (value == null || value.isBlank() || value.equals("-"))
            return "";

        String cleaned = value.trim();

        try {
            if (cleaned.length() >= 10 && cleaned.charAt(4) == '-') {
                LocalDate date = LocalDate.parse(cleaned.substring(0, 10));
                return date.format(DateTimeFormatter.ofPattern("dd-MM-yyyy"));
            }
        } catch (Exception ignored) {
        }

        return cleaned;
    }

    private String compactFloor(String floor) {
        if (floor == null || floor.equals("-"))
            return "-";

        String cleaned = floor.trim();

        if (cleaned.contains("-")) {
            cleaned = cleaned.substring(0, cleaned.indexOf("-")).trim();
        }

        return cleaned.isBlank() ? "-" : cleaned;
    }

    private String extractPacketNo(String text) {
        if (text == null || text.equals("-"))
            return "";

        Pattern pattern = Pattern.compile("(?i)Pkt[-\\s]*([0-9]+)");
        Matcher matcher = pattern.matcher(text);

        if (matcher.find()) {
            return matcher.group(1);
        }

        return "";
    }

    private String cleanPacket(String packetNo) {
        if (packetNo == null || packetNo.equals("-"))
            return "-";

        String cleaned = packetNo
                .replaceAll("(?i)^pkt[-\\s]*", "")
                .trim();

        return cleaned.isBlank() ? "-" : cleaned;
    }

    private String buildWorkCode(String pdNo, String drawingNo, String packetNo) {
        if (pdNo.equals("-") || drawingNo.equals("-") || packetNo.equals("-")) {
            return "-";
        }

        return pdNo + "/" + drawingNo.replace("/", "-") + "/Pkt-" + packetNo;
    }

    private String cleanItemName(String itemName) {
        if (itemName == null || itemName.equals("-"))
            return "-";

        String cleaned = itemName.trim();

        cleaned = cleaned.replaceAll("\\s*\\([^)]*Pkt[-\\s]*[0-9]+[^)]*\\)\\s*$", "");

        return cleaned.isBlank() ? itemName : cleaned;
    }

    private String cleanDimensionValue(String dimensions) {
        if (dimensions == null || dimensions.equals("-"))
            return "-";

        String cleaned = dimensions
                .replaceAll("\\([^)]*m3[^)]*\\)", "")
                .replaceAll("\\([^)]*m³[^)]*\\)", "")
                .replace("³", "3")
                .trim();

        return cleaned.isBlank() ? "-" : cleaned;
    }

    private String extractVolumeFromText(String text) {
        if (text == null || text.equals("-"))
            return "";

        Pattern pattern = Pattern.compile(
                "\\(?\\s*([0-9]+(?:\\.[0-9]+)?)\\s*m[³3]\\s*\\)?",
                Pattern.CASE_INSENSITIVE);

        Matcher matcher = pattern.matcher(text);

        if (matcher.find()) {
            return matcher.group(1);
        }

        return "";
    }

    private String cleanVolume(String volume) {
        if (volume == null || volume.equals("-"))
            return "-";

        String cleaned = volume
                .replace("m³", "")
                .replace("m3", "")
                .trim();

        if (cleaned.isBlank())
            return "-";

        return cleaned + " m3";
    }

    private String cleanWeight(String weight) {
        if (weight == null || weight.equals("-") || weight.isBlank()) {
            return "Pending / ____ kg";
        }

        String cleaned = weight.trim();

        if (cleaned.toLowerCase().contains("kg")) {
            return cleaned;
        }

        return cleaned + " kg";
    }

    private String cleanPdfText(String text) {
        if (text == null)
            return "-";

        return text
                .replace("\n", " ")
                .replace("\r", " ")
                .replace("—", "-")
                .replace("–", "-")
                .replace("₹", "Rs.")
                .replace("㎡", "m2")
                .replace("³", "3")
                .replace("²", "2")
                .replaceAll("\\s+", " ")
                .trim();
    }
}