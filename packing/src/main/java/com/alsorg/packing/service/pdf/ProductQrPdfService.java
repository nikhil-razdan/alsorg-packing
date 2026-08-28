package com.alsorg.packing.service.pdf;

import java.awt.Color;
import java.io.ByteArrayOutputStream;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDFont;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.springframework.stereotype.Service;

import com.alsorg.packing.domain.common.PacketItemType;
import com.alsorg.packing.domain.item.PacketItem;
import com.alsorg.packing.domain.qrcodegenerator.QRCodeGenerator;

/**
 * WR-38 compact tracking mark.
 *
 * The approved Wriver Illustrator artwork remains the product label. PackFlow
 * prints only the QR and its independently calculated WR sticker number.
 */
@Service
public class ProductQrPdfService {

    public static final String WR38_PLANT_CODE = "WR-38";

    private static final float PAGE_WIDTH = 190F;
    private static final float PAGE_HEIGHT = 190F;
    private static final float QR_SIZE = 154F;
    private static final float QR_Y = 29F;

    public byte[] generate(
            PacketItem item,
            String stickerNumber,
            long iteration,
            boolean preview) {

        if (item == null || item.getId() == null) {
            throw new IllegalArgumentException("WR-38 packet item is required");
        }

        if (!isWr38(item)) {
            throw new IllegalArgumentException(
                    "WR-38 QR can only be generated for plant WR-38");
        }

        String activeStickerNumber = preview
                ? "PREVIEW"
                : cleanRequired(stickerNumber, "WR sticker number is required");

        PacketItemType itemType = item.getItemType() == null
                ? PacketItemType.NORMAL
                : item.getItemType();

        /*
         * Keep the existing scanner identity contract. The ALSORG token here is
         * machine-readable protocol text only; it is not rendered on the label.
         * Preview deliberately omits PI/SN so it cannot resolve to a live packet.
         */
        String payload = preview
                ? "ALSORG|PREVIEW|TYPE=" + itemType + "|PLANT=WR-38"
                : "ALSORG|TYPE=" + itemType
                        + "|PI=" + item.getId()
                        + "|SN=" + activeStickerNumber;

        try (PDDocument document = new PDDocument();
                ByteArrayOutputStream output = new ByteArrayOutputStream()) {

            PDPage page = new PDPage(new PDRectangle(PAGE_WIDTH, PAGE_HEIGHT));
            document.addPage(page);

            byte[] qrBytes = QRCodeGenerator.generateQRCode(payload);
            PDImageXObject qr = PDImageXObject.createFromByteArray(
                    document,
                    qrBytes,
                    "wr38-packflow-qr");

            try (PDPageContentStream cs = new PDPageContentStream(document, page)) {
                cs.setNonStrokingColor(Color.WHITE);
                cs.addRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
                cs.fill();

                cs.drawImage(
                        qr,
                        (PAGE_WIDTH - QR_SIZE) / 2F,
                        QR_Y,
                        QR_SIZE,
                        QR_SIZE);

                drawCentered(
                        cs,
                        PDType1Font.HELVETICA_BOLD,
                        8.2F,
                        12F,
                        activeStickerNumber);
            }

            document.save(output);
            return output.toByteArray();
        } catch (Exception exception) {
            throw new RuntimeException(
                    "Unable to generate WR-38 PackFlow QR PDF",
                    exception);
        }
    }

    public boolean isWr38(PacketItem item) {
        return item != null
                && item.getPlantCode() != null
                && WR38_PLANT_CODE.equalsIgnoreCase(item.getPlantCode().trim());
    }

    private void drawCentered(
            PDPageContentStream cs,
            PDFont font,
            float fontSize,
            float y,
            String value) throws Exception {

        String text = value == null ? "" : value;
        float width = font.getStringWidth(text) / 1000F * fontSize;

        cs.beginText();
        cs.setNonStrokingColor(Color.BLACK);
        cs.setFont(font, fontSize);
        cs.newLineAtOffset(
                Math.max(4F, (PAGE_WIDTH - width) / 2F),
                y);
        cs.showText(text);
        cs.endText();
    }

    private String cleanRequired(String value, String message) {
        if (value == null || value.trim().isBlank()) {
            throw new IllegalArgumentException(message);
        }
        return value.trim();
    }
}
