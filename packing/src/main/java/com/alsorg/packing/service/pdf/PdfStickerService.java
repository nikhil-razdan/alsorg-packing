package com.alsorg.packing.service.pdf;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.lang.reflect.Method;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;

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

    private static final float HEADER_H = 44;
    private static final float FOOTER_H = 42;

    private static final Color DARK = new Color(13, 17, 23);
    private static final Color ORANGE = new Color(245, 158, 11);
    private static final Color LIGHT_ORANGE = new Color(255, 248, 235);
    private static final Color LIGHT_GREY = new Color(249, 250, 251);
    private static final Color LABEL_GREY = new Color(107, 114, 128);
    private static final Color TEXT_DARK = new Color(17, 24, 39);

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

                String today = LocalDateTime.now(ZoneId.of("Asia/Kolkata"))
                        .format(DateTimeFormatter.ofPattern("dd-MM-yyyy"));

                String stickerNo = safe(data.getStickerNumber());
                String pdNo = safe(data.getPdNo());
                String drawingNo = safe(data.getDrawingNo());
                String itemName = safe(data.getItemName());

                /*
                 * Box fallback:
                 * 1. Uses getBoxNo() / getBoxNumber() / getBox() if your DTO has it.
                 * 2. Otherwise uses remarks, because your current DTO already has remarks.
                 */
                String boxNo = firstNonBlank(
                        reflectValue(data, "getBoxNo", "getBoxNumber", "getBox"),
                        normalizeBoxValue(safe(data.getRemarks())),
                        "-"
                );

                String floor = compactFloor(firstNonBlank(safe(data.getFloor()), "-"));

                String packetNo = firstNonBlank(
                        reflectValue(data, "getPacketNo", "getPacketNumber", "getPacket"),
                        extractPacketNo(itemName),
                        extractPacketNo(safe(data.getDescription())),
                        "-"
                );

                String contents = firstNonBlank(
                        reflectValue(data, "getPackingContents", "getContents"),
                        safe(data.getDescription()),
                        "-"
                );

                String destination = joinClientAndAddress(
                        safe(data.getClientName()),
                        safe(data.getClientAddress())
                );

                String volume = firstNonBlank(
                        reflectValue(data, "getVolume", "getVolumeCbm", "getCbm"),
                        "-"
                );

                String dimensions = safe(data.getDimensions());
                String weight = safe(data.getWeight());

                /* ================= BACKGROUND ================= */
                cs.setNonStrokingColor(Color.WHITE);
                cs.addRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
                cs.fill();

                /* ================= HEADER ================= */
                cs.setNonStrokingColor(DARK);
                cs.addRect(0, PAGE_HEIGHT - HEADER_H, PAGE_WIDTH, HEADER_H);
                cs.fill();

                if (data.isShowCompanyHeader()) {
                    drawTextWithFont(cs, bold, 21, 18, 321, "ALSORG", Color.WHITE);
                }

                if (data.getPrintIteration() > 1) {
                    drawTextWithFont(
                            cs,
                            bold,
                            18,
                            112,
                            322,
                            String.valueOf(data.getPrintIteration()),
                            Color.WHITE
                    );
                }

                drawRoundRect(cs, 408, 316, 168, 25, 8, ORANGE, ORANGE, 1.5f);
                drawCenteredText(
                        cs,
                        bold,
                        12.5f,
                        408,
                        316,
                        168,
                        25,
                        "BOX " + boxNo + "  |  FLOOR " + floor,
                        DARK
                );

                /* ================= QR PANEL ================= */
                float qrPanelX = 18;
                float qrPanelY = 130;
                float qrPanelW = 124;
                float qrPanelH = 160;

                drawRoundRect(cs, qrPanelX, qrPanelY, qrPanelW, qrPanelH, 9, LIGHT_GREY, DARK, 1.4f);
                drawCenteredText(cs, bold, 12, qrPanelX, qrPanelY + qrPanelH - 27, qrPanelW, 20, "SCAN", TEXT_DARK);

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

                // Bigger QR with smaller padding
                cs.drawImage(qrImage, qrPanelX + 8, qrPanelY + 36, 108, 108);

                drawCenteredText(cs, bold, 9.5f, qrPanelX, qrPanelY + 12, qrPanelW, 16, "Scan for Info", LABEL_GREY);

                /* ================= MAIN CONTENT ================= */
                float mainX = 154;
                float mainW = 422;

                drawTextWithFont(cs, bold, 10.5f, mainX, 290, "SNO / TRACKING ID", LABEL_GREY);

                drawRoundRect(cs, mainX, 248, mainW, 38, 2, Color.WHITE, DARK, 1.4f);
                drawFitText(cs, bold, 27, 18, mainX + 12, 263, mainW - 24, stickerNo, TEXT_DARK);

                /* ================= INFO CARDS ================= */
                float cardY = 202;
                float cardH = 38;
                float gap = 8;
                float cardW = (mainW - (gap * 3)) / 4;

                drawInfoCard(cs, bold, regular, mainX, cardY, cardW, cardH, "PD NO", pdNo, false);
                drawInfoCard(cs, bold, regular, mainX + cardW + gap, cardY, cardW, cardH, "DWG NO", drawingNo, false);
                drawInfoCard(cs, bold, regular, mainX + ((cardW + gap) * 2), cardY, cardW, cardH, "PACKET", cleanPacket(packetNo), true);
                drawInfoCard(cs, bold, regular, mainX + ((cardW + gap) * 3), cardY, cardW, cardH, "PACKING DATE", today, false);

                /* ================= CLIENT / DESTINATION ================= */
                drawSectionBox(
                        cs,
                        bold,
                        regular,
                        mainX,
                        151,
                        mainW,
                        40,
                        "CLIENT / DESTINATION",
                        destination,
                        false
                );

                /* ================= ITEM ================= */
                drawSectionBox(
                        cs,
                        bold,
                        regular,
                        18,
                        101,
                        558,
                        38,
                        "ITEM",
                        itemNameWithCode(itemName, pdNo, drawingNo, cleanPacket(packetNo)),
                        false
                );

                /* ================= PACKING CONTENTS ================= */
                drawSectionBox(
                        cs,
                        bold,
                        regular,
                        18,
                        52,
                        558,
                        37,
                        "PACKING CONTENTS",
                        contents,
                        true
                );

                /* ================= FOOTER ================= */
                cs.setNonStrokingColor(DARK);
                cs.addRect(0, 0, PAGE_WIDTH, FOOTER_H);
                cs.fill();

                String footerLeft = "SIZE: " + dimensions + "   |   VOLUME: " + volume + " m3   |   WEIGHT: " + weight;
                drawFitText(cs, bold, 11.5f, 9, 18, 20, 365, footerLeft, Color.WHITE);

                drawTextWithFont(cs, bold, 7.5f, 413, 26, "PREPARED", new Color(209, 213, 219));
                drawTextWithFont(cs, bold, 7.5f, 486, 26, "CHECKED", new Color(209, 213, 219));
                drawTextWithFont(cs, bold, 7.5f, 551, 26, "LOADED", new Color(209, 213, 219));

                drawLine(cs, 413, 12, 466, 12, Color.WHITE, 1);
                drawLine(cs, 486, 12, 535, 12, Color.WHITE, 1);
                drawLine(cs, 551, 12, 595, 12, Color.WHITE, 1);
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
            PDFont regular,
            float x,
            float y,
            float w,
            float h,
            String label,
            String value,
            boolean highlight
    ) throws IOException {

        drawRoundRect(cs, x, y, w, h, 6, highlight ? LIGHT_ORANGE : LIGHT_GREY, DARK, 1.2f);
        drawTextWithFont(cs, bold, 8.5f, x + 7, y + h - 14, label, LABEL_GREY);
        drawFitText(cs, bold, 14, 10, x + 7, y + 9, w - 14, value, TEXT_DARK);
    }

    private void drawSectionBox(
            PDPageContentStream cs,
            PDFont bold,
            PDFont regular,
            float x,
            float y,
            float w,
            float h,
            String label,
            String value,
            boolean orangeBorder
    ) throws IOException {

        drawRoundRect(
                cs,
                x,
                y,
                w,
                h,
                6,
                orangeBorder ? new Color(255, 252, 241) : Color.WHITE,
                orangeBorder ? ORANGE : DARK,
                orangeBorder ? 1.8f : 1.2f
        );

        drawTextWithFont(
                cs,
                bold,
                8.5f,
                x + 10,
                y + h - 15,
                label,
                orangeBorder ? new Color(146, 64, 14) : LABEL_GREY
        );

        drawFitText(cs, bold, 15.5f, 10, x + 10, y + 9, w - 20, value, TEXT_DARK);
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
        float ty = y + ((h - fontSize) / 2) + 3;
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
                // DTO method may not exist yet. Fallbacks handle it.
            }
        }

        return "";
    }

    private String joinClientAndAddress(String client, String address) {
        boolean hasClient = client != null && !client.equals("-");
        boolean hasAddress = address != null && !address.equals("-");

        if (hasClient && hasAddress) return client + " - " + address;
        if (hasClient) return client;
        if (hasAddress) return address;

        return "-";
    }

    private String normalizeBoxValue(String value) {
        if (value == null || value.equals("-")) return "";

        String cleaned = value
                .replaceAll("(?i)^\\s*box\\s*(no\\.?|number)?\\s*[:\\-]?", "")
                .trim();

        return cleaned.isBlank() || cleaned.equals("-") ? "" : cleaned;
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

        String[] parts = text.split("[\\s/()|,]+");

        for (String part : parts) {
            if (part.toLowerCase().startsWith("pkt-")) {
                return part;
            }
        }

        return "";
    }

    private String cleanPacket(String packetNo) {
        if (packetNo == null || packetNo.equals("-")) return "-";
        return packetNo.replaceAll("(?i)^pkt-", "").trim();
    }

    private String itemNameWithCode(String itemName, String pdNo, String drawingNo, String packetNo) {
        String code = "";

        if (!pdNo.equals("-") && !drawingNo.equals("-") && !packetNo.equals("-")) {
            code = " (" + pdNo + "/" + drawingNo.replace("/", "-") + "/Pkt-" + packetNo + ")";
        }

        return itemName + code;
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