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

    private static final Color DARK = new Color(13, 17, 23);
    private static final Color ORANGE = new Color(245, 158, 11);
    private static final Color BLUE = new Color(37, 99, 235);
    private static final Color LIGHT_BLUE = new Color(239, 246, 255);
    private static final Color LIGHT_GREY = new Color(248, 250, 252);
    private static final Color BORDER_GREY = new Color(203, 213, 225);
    private static final Color LABEL_GREY = new Color(100, 116, 139);
    private static final Color TEXT_DARK = new Color(15, 23, 42);

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

                String boxNo = firstNonBlank(
                        reflectValue(data, "getBoxNo", "getBoxNumber", "getBox"),
                        "-"
                );

                String floor = compactFloor(firstNonBlank(
                        safe(data.getFloor()),
                        "-"
                ));

                String packingDate = firstNonBlank(
                        normalizeDate(reflectValue(data, "getPackingDate", "getPackedDate", "getCreatedAt")),
                        todayIndia()
                );

                String clientName = safe(data.getClientName());
                String clientAddress = safe(data.getClientAddress());

                String itemName = cleanItemName(safe(data.getItemName()));

                String contents = firstNonBlank(
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

                String workCode = buildWorkCode(pdNo, drawingNo, packetNo);

                /* ================= BACKGROUND ================= */
                cs.setNonStrokingColor(Color.WHITE);
                cs.addRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
                cs.fill();

                /* ================= OUTER BORDER ================= */
                drawRoundRect(cs, 8, 7, PAGE_WIDTH - 16, PAGE_HEIGHT - 14, 14, null, Color.BLACK, 1.6f);

                /* ================= HEADER ================= */
                drawRoundRect(cs, 15, 304, 570, 38, 8, DARK, DARK, 0);

                if (data.isShowCompanyHeader()) {
                    drawTextWithFont(cs, bold, 24, 30, 321, "ALSORG", Color.WHITE);
                }

                if (data.getPrintIteration() > 1) {
                    drawTextWithFont(
                            cs,
                            bold,
                            16,
                            132,
                            323,
                            String.valueOf(data.getPrintIteration()),
                            ORANGE
                    );
                }

                drawRoundRect(cs, 440, 319, 125, 24, 7, ORANGE, ORANGE, 0);
                drawCenteredText(
                        cs,
                        bold,
                        10.5f,
                        440,
                        319,
                        125,
                        24,
                        "BOX " + boxNo + " | FLOOR " + floor,
                        DARK
                );

                /* ================= TOP LAYOUT ================= */
                float leftX = 20;
                float rightQrX = 470;
                float gap = 12;
                float leftW = rightQrX - leftX - gap;

                /* ================= SNO / TRACKING ID ================= */
                drawRoundRect(cs, leftX, 248, leftW, 40, 5, Color.WHITE, BORDER_GREY, 1.1f);
                drawLine(cs, leftX + 2, 288, leftX + leftW - 2, 288, BLUE, 1.8f);

                drawTextWithFont(cs, bold, 9.5f, leftX + 8, 272, "SNO / TRACKING ID", LABEL_GREY);
                drawFitText(cs, bold, 23.5f, 15, leftX + 8, 254, leftW - 16, stickerNo, TEXT_DARK);

                /* ================= QR PANEL ================= */
                float qrPanelX = rightQrX;
                float qrPanelY = 151;
                float qrPanelW = 112;
                float qrPanelH = 137;

                drawRoundRect(cs, qrPanelX, qrPanelY, qrPanelW, qrPanelH, 7, LIGHT_GREY, BORDER_GREY, 1.1f);
                drawCenteredText(cs, bold, 10.5f, qrPanelX, qrPanelY + qrPanelH - 20, qrPanelW, 16, "SCAN", LABEL_GREY);

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

                // Bigger QR with smaller border padding
                cs.drawImage(qrImage, qrPanelX + 11, qrPanelY + 33, 90, 90);

                drawCenteredText(cs, bold, 8.5f, qrPanelX, qrPanelY + 11, qrPanelW, 14, "Scan for Info", TEXT_DARK);

                /* ================= INFO CARDS ================= */
                float cardY = 204;
                float cardH = 37;

                drawInfoCard(cs, bold, leftX, cardY, 88, cardH, "PACKET", "Pkt-" + packetNo);
                drawInfoCard(cs, bold, leftX + 99, cardY, 88, cardH, "DRAWING", drawingNo);
                drawInfoCard(cs, bold, leftX + 198, cardY, 116, cardH, "PACKING DATE", packingDate);
                drawInfoCard(cs, bold, leftX + 326, cardY, leftW - 326, cardH, "PD NO.", pdNo);

                /* ================= CLIENT / SITE + WORK REFERENCE ================= */
                drawRoundRect(cs, leftX, 151, 280, 43, 6, Color.WHITE, BORDER_GREY, 1.1f);
                drawTextWithFont(cs, bold, 8.3f, leftX + 8, 181, "CLIENT / SITE", BLUE);
                drawFitText(cs, bold, 14.5f, 9, leftX + 8, 168, 264, clientName, TEXT_DARK);
                drawFitText(cs, regular, 12.5f, 8, leftX + 8, 156, 264, clientAddress, TEXT_DARK);

                drawRoundRect(cs, leftX + 292, 151, leftW - 292, 43, 6, Color.WHITE, BORDER_GREY, 1.1f);
                drawTextWithFont(cs, bold, 8.3f, leftX + 300, 181, "WORK REFERENCE", BLUE);
                drawTextWithFont(cs, bold, 8.5f, leftX + 300, 166, "PD No.", LABEL_GREY);
                drawFitText(cs, bold, 11.5f, 8, leftX + 342, 166, leftW - 350, pdNo, TEXT_DARK);
                drawTextWithFont(cs, bold, 8.5f, leftX + 300, 154, "Code", LABEL_GREY);
                drawFitText(cs, bold, 10.5f, 7, leftX + 342, 154, leftW - 350, workCode, TEXT_DARK);

                /* ================= ITEM + CONTENTS COMBINED ROW ================= */
                drawRoundRect(cs, 20, 98, 560, 45, 6, LIGHT_GREY, BORDER_GREY, 1.1f);

                drawTextWithFont(cs, bold, 8.5f, 28, 130, "ITEM", BLUE);
                drawFitText(cs, bold, 15.5f, 9, 28, 111, 245, itemName, TEXT_DARK);

                drawTextWithFont(cs, bold, 8.5f, 275, 130, "CONTENTS", BLUE);
                drawContentsChips(cs, bold, contents, 275, 109, 295);

                /* ================= DIMENSION / VOLUME / WEIGHT ================= */
                float bottomInfoY = 58;
                float bottomInfoH = 30;

                drawBottomInfoCard(cs, bold, 20, bottomInfoY, 250, bottomInfoH, "DIMENSION", dimensions);
                drawBottomInfoCard(cs, bold, 280, bottomInfoY, 100, bottomInfoH, "VOLUME", volume);
                drawBottomInfoCard(cs, bold, 390, bottomInfoY, 190, bottomInfoH, "WEIGHT", weight);

                /* ================= QC + SIGNATURE ================= */
                drawRoundRect(cs, 20, 17, 560, 32, 6, LIGHT_GREY, BORDER_GREY, 1.1f);

                drawTextWithFont(cs, bold, 8.3f, 28, 40, "QC CHECK", BLUE);

                drawCheckBox(cs, 28, 24, "Cleaned", bold);
                drawCheckBox(cs, 96, 24, "Edge Protected", bold);
                drawCheckBox(cs, 178, 24, "Wrapped", bold);
                drawCheckBox(cs, 252, 24, "Label Matched", bold);
                drawCheckBox(cs, 342, 24, "Photo Taken", bold);

                drawSignature(cs, bold, 425, 41, "Prepared By");
                drawSignature(cs, bold, 492, 41, "Checked By");
                drawSignature(cs, bold, 557, 41, "Loaded By");

                drawCenteredText(
                        cs,
                        regular,
                        6.8f,
                        20,
                        8,
                        560,
                        8,
                        "Keep sticker visible on outer packing. Verify SNo, packet, box and floor before dispatch.",
                        LABEL_GREY
                );
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

        drawRoundRect(cs, x, y, w, h, 5, Color.WHITE, BORDER_GREY, 1.1f);
        drawLine(cs, x + 2, y + h, x + w - 2, y + h, Color.BLACK, 1.5f);
        drawTextWithFont(cs, bold, 8.2f, x + 7, y + h - 13, label, LABEL_GREY);
        drawFitText(cs, bold, 14.5f, 9, x + 7, y + 8, w - 14, value, TEXT_DARK);
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

        drawRoundRect(cs, x, y, w, h, 5, Color.WHITE, BORDER_GREY, 1.1f);
        drawLine(cs, x + 2, y + h, x + w - 2, y + h, Color.BLACK, 1.5f);
        drawTextWithFont(cs, bold, 8.1f, x + 7, y + h - 12, label, LABEL_GREY);
        drawFitText(cs, bold, 11.2f, 7, x + 7, y + 8, w - 14, value, TEXT_DARK);
    }

    private void drawContentsChips(
            PDPageContentStream cs,
            PDFont bold,
            String contents,
            float x,
            float y,
            float maxWidth
    ) throws IOException {

        List<String> parts = splitContents(contents);

        float cursorX = x;
        float cursorY = y;
        float chipH = 14;
        float gap = 6;

        for (String part : parts) {
            String text = cleanPdfText(part);
            if (text.isBlank()) continue;

            float textW = bold.getStringWidth(text) / 1000 * 7.8f;
            float chipW = Math.min(textW + 14, maxWidth);

            if (cursorX + chipW > x + maxWidth) {
                cursorX = x;
                cursorY -= 16;
            }

            if (cursorY < 101) {
                drawFitText(cs, bold, 7.5f, 6, cursorX, cursorY + 4, x + maxWidth - cursorX, text, TEXT_DARK);
                return;
            }

            drawRoundRect(cs, cursorX, cursorY, chipW, chipH, 4, LIGHT_BLUE, new Color(147, 197, 253), 0.8f);
            drawFitText(cs, bold, 7.8f, 6, cursorX + 6, cursorY + 4, chipW - 12, text, TEXT_DARK);

            cursorX += chipW + gap;
        }
    }

    private void drawCheckBox(
            PDPageContentStream cs,
            float x,
            float y,
            String label,
            PDFont font
    ) throws IOException {

        cs.setStrokingColor(Color.BLACK);
        cs.setLineWidth(0.8f);
        cs.addRect(x, y, 7, 7);
        cs.stroke();

        drawTextWithFont(cs, font, 7.8f, x + 11, y + 1, label, TEXT_DARK);
    }

    private void drawSignature(
            PDPageContentStream cs,
            PDFont font,
            float centerX,
            float labelY,
            String label
    ) throws IOException {

        float labelW = font.getStringWidth(label) / 1000 * 6.8f;
        drawTextWithFont(cs, font, 6.8f, centerX - (labelW / 2), labelY, label, LABEL_GREY);
        drawLine(cs, centerX - 25, 24, centerX + 25, 24, Color.BLACK, 0.8f);
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

    private String truncateToWidth(PDFont font, float fontSize, String text, float maxWidth) throws IOException {
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
        return s.isBlank() ? "-" : cleanPdfText(s);
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
                    if (!text.isBlank()) return cleanPdfText(text);
                }
            } catch (Exception ignored) {
                // Optional DTO getter may not exist yet.
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

        Pattern pattern = Pattern.compile("\\(?\\s*([0-9]+(?:\\.[0-9]+)?)\\s*m[³3]\\s*\\)?", Pattern.CASE_INSENSITIVE);
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

    private List<String> splitContents(String contents) {
        List<String> result = new ArrayList<>();

        if (contents == null || contents.equals("-")) {
            result.add("-");
            return result;
        }

        String cleaned = cleanPdfText(contents);

        if (cleaned.contains("|")) {
            for (String part : cleaned.split("\\|")) {
                if (!part.trim().isBlank()) result.add(part.trim());
            }
            return result.isEmpty() ? List.of(cleaned) : result;
        }

        if (cleaned.contains(";")) {
            for (String part : cleaned.split(";")) {
                if (!part.trim().isBlank()) result.add(part.trim());
            }
            return result.isEmpty() ? List.of(cleaned) : result;
        }

        Pattern pattern = Pattern.compile("[A-Za-z0-9 /&.]+?\\s*-\\s*[0-9]+(?:\\.[0-9]+)?");
        Matcher matcher = pattern.matcher(cleaned);

        while (matcher.find()) {
            String part = matcher.group().trim();
            if (!part.isBlank()) result.add(part);
        }

        if (result.isEmpty()) {
            result.add(cleaned);
        }

        return result;
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