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
                    true
            )) {

                String stickerNo = safe(data.getStickerNumber());
                String pdNo = safe(data.getPdNo());
                String drawingNo = safe(data.getDrawingNo());

                String packetNo = firstNonBlank(
                        reflectValue(data, "getPacketNo", "getPacketNumber", "getPacket"),
                        extractPacketNo(safe(data.getItemName())),
                        extractPacketNo(safe(data.getDescription())),
                        "-"
                );
                packetNo = cleanPacket(packetNo);

                String floor = compactFloor(firstNonBlank(
                        safe(data.getFloor()),
                        "-"
                ));

                String itemName = cleanItemName(safe(data.getItemName()));

                String packingDate = firstNonBlank(
                        normalizeDate(reflectValue(data, "getPackingDate", "getPackedDate", "getCreatedAt")),
                        todayIndia()
                );

                String clientName = safe(data.getClientName());
                String clientAddress = safe(data.getClientAddress());

                String description = firstNonBlank(
                        reflectValue(data, "getPackingContents", "getContents"),
                        safe(data.getDescription()),
                        "-"
                );

                String dimensions = cleanDimensionValue(safe(data.getDimensions()));

                String volume = firstNonBlank(
                        reflectValue(data, "getVolume", "getVolumeCbm", "getCbm"),
                        extractVolumeFromText(safe(data.getDimensions())),
                        "-"
                );
                volume = cleanVolume(volume);

                String weight = cleanWeight(safe(data.getWeight()));

                String codeSku = firstNonBlank(
                        reflectValue(data, "getSku", "getCode", "getItemCode", "getPacketSku"),
                        buildWorkCode(pdNo, drawingNo, packetNo),
                        "-"
                );

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
                            WHITE
                    );
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
                        BLACK
                );

                /* ================= BODY GRID ================= */
                float leftX = 18;

                /*
                 * QR panel widened and left content adjusted.
                 * QR will now fit fully inside its border.
                 */
                float qrX = 448;
                float leftW = qrX - leftX - 12;

                /* ================= TOP ITEM SECTION ================= */
                drawRoundRect(cs, leftX, 250, leftW, 42, 5, WHITE, BLACK, 1.1f);
                drawLine(cs, leftX + 2, 292, leftX + leftW - 2, 292, BLACK, 1.5f);

                drawTextWithFont(cs, bold, 9.2f, leftX + 8, 276, "ITEM", BLACK);
                drawFitText(cs, bold, 23.5f, 13, leftX + 8, 257, leftW - 16, itemName, BLACK);

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

                /*
                 * QR made bigger and centered.
                 * Text below QR removed so the QR can use the full panel safely.
                 */
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
                drawRoundRect(cs, leftX, 155, leftW, 43, 6, WHITE, BLACK, 1.1f);

                drawTextWithFont(cs, bold, 8.4f, leftX + 8, 184, "CLIENT / SITE", BLACK);
                drawFitText(cs, bold, 14.2f, 9, leftX + 8, 170, leftW - 16, clientName, BLACK);
                drawFitText(cs, regular, 12.2f, 8, leftX + 8, 158, leftW - 16, clientAddress, BLACK);

                /* ================= SERIAL NO + DESCRIPTION ================= */
                drawRoundRect(cs, 18, 100, 563, 45, 6, WHITE, BLACK, 1.1f);

                float serialX = 28;

                /*
                 * Description starts more to the left now,
                 * closer to SNO / TRACKING ID.
                 */
                float dividerX = 230;
                float descriptionX = 244;

                drawTextWithFont(cs, bold, 8.2f, serialX, 132, "SNO / TRACKING ID", BLACK);

                /*
                 * Sticker number made smaller.
                 */
                drawFitText(cs, bold, 10.4f, 7.0f, serialX, 114, 190, stickerNo, BLACK);

                drawLine(cs, dividerX, 105, dividerX, 140, BLACK, 0.8f);

                drawTextWithFont(cs, bold, 8.2f, descriptionX, 132, "DESCRIPTION", BLACK);

                drawWrappedFitText(
                        cs,
                        bold,
                        9.2f,
                        6.6f,
                        descriptionX,
                        117,
                        324,
                        23,
                        description,
                        BLACK
                );

                /* ================= DIMENSION / VOLUME / WEIGHT ================= */
                float bottomInfoY = 60;
                float bottomInfoH = 30;

                drawBottomInfoCard(cs, bold, 18, bottomInfoY, 250, bottomInfoH, "DIMENSION", dimensions);
                drawBottomInfoCard(cs, bold, 278, bottomInfoY, 100, bottomInfoH, "VOLUME", volume);
                drawBottomInfoCard(cs, bold, 388, bottomInfoY, 193, bottomInfoH, "WEIGHT", weight);

                /* ================= SIGNATURE SECTION ================= */
                drawRoundRect(cs, 18, 18, 563, 32, 6, WHITE, BLACK, 1.1f);

                /*
                 * Lines lifted slightly from the bottom border.
                 */
                drawSignatureBlock(cs, bold, 42, 37, 25.5f, 135, "Prepared By");
                drawSignatureBlock(cs, bold, 232, 37, 25.5f, 135, "Checked By");
                drawSignatureBlock(cs, bold, 423, 37, 25.5f, 135, "Delivered By");
            }

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            document.save(out);
            return out.toByteArray();

        } catch (IOException e) {
            throw new RuntimeException(e);
        }
    }

    /* ================= DRAW HELPERS ================= */

    private void drawInfoCard(
            PDPageContentStream cs,
            PDFont bold,
            float x,
            float y,
            float w,
            float h,
            String label,
            String value
    ) throws IOException {

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
            String value
    ) throws IOException {

        drawRoundRect(cs, x, y, w, h, 5, WHITE, BLACK, 1.1f);
        drawLine(cs, x + 2, y + h, x + w - 2, y + h, BLACK, 1.3f);

        drawTextWithFont(cs, bold, 8f, x + 7, y + h - 12, label, BLACK);
        drawFitText(cs, bold, 10.8f, 7, x + 7, y + 8, w - 14, value, BLACK);
    }

    private void drawSignatureBlock(
            PDPageContentStream cs,
            PDFont font,
            float x,
            float labelY,
            float lineY,
            float w,
            String label
    ) throws IOException {

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
            Color color
    ) throws IOException {

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
            Color color
    ) throws IOException {

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
            Color color
    ) throws IOException {

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
                color
        );
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
            Color color
    ) throws IOException {

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
            Color color
    ) throws IOException {

        text = cleanPdfText(text);
        float fontSize = startFont;

        while (fontSize >= minFont) {
            float leading = fontSize + 2;
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

        float leading = minFont + 2;
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
            float maxWidth
    ) throws IOException {

        List<String> lines = new ArrayList<>();

        if (text == null || text.isBlank()) {
            lines.add("-");
            return lines;
        }

        String[] words = text.split(" ");
        StringBuilder line = new StringBuilder();

        for (String word : words) {
            String candidate = line.length() == 0 ? word : line + " " + word;
            float width = font.getStringWidth(candidate) / 1000 * fontSize;

            if (width <= maxWidth) {
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

    private String truncateToWidth(
            PDFont font,
            float fontSize,
            String text,
            float maxWidth
    ) throws IOException {

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
            float width
    ) throws IOException {

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
            float lineWidth
    ) throws IOException {

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
        if (v == null) return "-";

        String s = v.toString().trim();

        if (s.isBlank()) return "-";

        return cleanPdfText(s);
    }

    private String firstNonBlank(String... values) {
        if (values == null) return "-";

        for (String value : values) {
            if (value == null) continue;

            String cleaned = value.trim();

            if (!cleaned.isBlank() && !cleaned.equals("-")) {
                return cleaned;
            }
        }

        return "-";
    }

    private String reflectValue(Object target, String... methodNames) {
        if (target == null || methodNames == null) return "";

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
        if (value == null || value.isBlank() || value.equals("-")) return "";

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
        if (floor == null || floor.equals("-")) return "-";

        String cleaned = floor.trim();

        if (cleaned.contains("-")) {
            cleaned = cleaned.substring(0, cleaned.indexOf("-")).trim();
        }

        return cleaned.isBlank() ? "-" : cleaned;
    }

    private String extractPacketNo(String text) {
        if (text == null || text.equals("-")) return "";

        Pattern pattern = Pattern.compile("(?i)Pkt[-\\s]*([0-9]+)");
        Matcher matcher = pattern.matcher(text);

        if (matcher.find()) {
            return matcher.group(1);
        }

        return "";
    }

    private String cleanPacket(String packetNo) {
        if (packetNo == null || packetNo.equals("-")) return "-";

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
        if (itemName == null || itemName.equals("-")) return "-";

        String cleaned = itemName.trim();

        // Removes trailing code like: (W-149/4-8/Pkt-40)
        cleaned = cleaned.replaceAll("\\s*\\([^)]*Pkt[-\\s]*[0-9]+[^)]*\\)\\s*$", "");

        return cleaned.isBlank() ? itemName : cleaned;
    }

    private String cleanDimensionValue(String dimensions) {
        if (dimensions == null || dimensions.equals("-")) return "-";

        String cleaned = dimensions
                .replaceAll("\\([^)]*m3[^)]*\\)", "")
                .replaceAll("\\([^)]*m³[^)]*\\)", "")
                .replace("³", "3")
                .trim();

        return cleaned.isBlank() ? "-" : cleaned;
    }

    private String extractVolumeFromText(String text) {
        if (text == null || text.equals("-")) return "";

        Pattern pattern = Pattern.compile(
                "\\(?\\s*([0-9]+(?:\\.[0-9]+)?)\\s*m[³3]\\s*\\)?",
                Pattern.CASE_INSENSITIVE
        );

        Matcher matcher = pattern.matcher(text);

        if (matcher.find()) {
            return matcher.group(1);
        }

        return "";
    }

    private String cleanVolume(String volume) {
        if (volume == null || volume.equals("-")) return "-";

        String cleaned = volume
                .replace("m³", "")
                .replace("m3", "")
                .trim();

        if (cleaned.isBlank()) return "-";

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
        if (text == null) return "-";

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