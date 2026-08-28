package com.alsorg.packing.service.pdf;

import java.awt.Color;
import java.io.ByteArrayOutputStream;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.springframework.stereotype.Service;

import com.alsorg.packing.domain.common.PacketItemType;
import com.alsorg.packing.domain.item.PacketItem;
import com.alsorg.packing.domain.qrcodegenerator.QRCodeGenerator;

/**
 * WR-38 tracking mark.
 *
 * The Illustrator Wriver artwork remains the approved visual product label.
 * PackFlow only generates a compact QR identity artifact that can be placed on
 * that artwork (File > Place) or printed as a small tracking label.
 *
 * No client/product description is embedded in the QR. The code carries only
 * the same PackFlow identity keys used by existing plant QR stickers, and the
 * ScannerDispatchService resolves the secured database record after scanning.
 */
@Service
public class ProductQrPdfService {

    public static final String WR38_PLANT_CODE = "WR-38";

    private static final float PAGE_WIDTH = 190F;
    private static final float PAGE_HEIGHT = 220F;
    private static final float QR_SIZE = 154F;

    public byte[] generate(
            PacketItem item,
            String stickerNumber,
            long iteration,
            boolean preview) {

        if (item == null || item.getId() == null) {
            throw new IllegalArgumentException("WR-38 packet item is required");
        }

        if (!isWr38(item)) {
            throw new IllegalArgumentException("WR-38 QR can only be generated for plant WR-38");
        }

        String activeStickerNumber = preview
                ? "PREVIEW"
                : cleanRequired(stickerNumber, "Tracking number is required");

        PacketItemType itemType = item.getItemType() == null
                ? PacketItemType.NORMAL
                : item.getItemType();

        /*
         * Preview QR must never resolve to a live PackFlow record. The scanner
         * intentionally understands PI/SN identity keys, so a preview artifact
         * must not carry either one; otherwise a printed preview could be used as
         * a dispatch scan. Final QR generation below keeps the normal plant
         * identity contract unchanged.
         */
        String payload = preview
                ? "ALSORG|PREVIEW|TYPE=" + itemType + "|PLANT=WR-38"
                : "ALSORG|TYPE=" + itemType + "|PI=" + item.getId() + "|SN=" + activeStickerNumber;

        try (PDDocument document = new PDDocument();
                ByteArrayOutputStream output = new ByteArrayOutputStream()) {

            PDPage page = new PDPage(new PDRectangle(PAGE_WIDTH, PAGE_HEIGHT));
            document.addPage(page);

            byte[] qrBytes = QRCodeGenerator.generateQRCode(payload);
            PDImageXObject qr = PDImageXObject.createFromByteArray(document, qrBytes, "wr38-packflow-qr");

            try (PDPageContentStream cs = new PDPageContentStream(document, page)) {
                cs.setNonStrokingColor(Color.WHITE);
                cs.addRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
                cs.fill();

                cs.setStrokingColor(Color.BLACK);
                cs.setLineWidth(1.2F);
                cs.addRect(5F, 5F, PAGE_WIDTH - 10F, PAGE_HEIGHT - 10F);
                cs.stroke();

                cs.drawImage(qr, (PAGE_WIDTH - QR_SIZE) / 2F, 48F, QR_SIZE, QR_SIZE);

                drawCentered(cs, PDType1Font.HELVETICA_BOLD, 10F, 208F,
                        preview ? "WR-38 PACKFLOW QR PREVIEW" : "WR-38 PACKFLOW QR");
                drawCentered(cs, PDType1Font.HELVETICA, 7.5F, 33F, activeStickerNumber);
                drawCentered(cs, PDType1Font.HELVETICA, 6.2F, 20F,
                        "Scan in PackFlow / ShipTrack");

                if (!preview && iteration > 1L) {
                    drawCentered(cs, PDType1Font.HELVETICA_BOLD, 6.2F, 10F,
                            "REPRINT " + iteration);
                }
            }

            document.save(output);
            return output.toByteArray();

        } catch (Exception exception) {
            throw new RuntimeException("Unable to generate WR-38 PackFlow QR PDF", exception);
        }
    }

    public boolean isWr38(PacketItem item) {
        return item != null
                && item.getPlantCode() != null
                && WR38_PLANT_CODE.equalsIgnoreCase(item.getPlantCode().trim());
    }

    private void drawCentered(
            PDPageContentStream cs,
            org.apache.pdfbox.pdmodel.font.PDFont font,
            float fontSize,
            float y,
            String value) throws Exception {

        String text = value == null ? "" : value;
        float width = font.getStringWidth(text) / 1000F * fontSize;

        cs.beginText();
        cs.setNonStrokingColor(Color.BLACK);
        cs.setFont(font, fontSize);
        cs.newLineAtOffset(Math.max(8F, (PAGE_WIDTH - width) / 2F), y);
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
