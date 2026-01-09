package com.alsorg.packing.service.pdf;

import java.awt.Color;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

import javax.imageio.ImageIO;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.PDPageContentStream.AppendMode;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDFont;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import com.alsorg.packing.service.barcode.BarcodeService;
import com.alsorg.packing.service.pdf.dto.StickerPdfData;

@Service
public class PdfStickerService {

    private final BarcodeService barcodeService;

    public PdfStickerService(BarcodeService barcodeService) {
        this.barcodeService = barcodeService;
    }

    private static final float PAGE_WIDTH = 600;
    private static final float PAGE_HEIGHT = 350;

    @Value("${sticker.logo.path}")
    private String logoPath;

    public byte[] generateSticker(StickerPdfData data) {

        System.out.println(">>> ENTERED PdfStickerService.generateSticker()");

        PDFont fontRegular = PDType1Font.HELVETICA;
        PDFont fontBold = PDType1Font.HELVETICA_BOLD;
        float fontSize = 10;

        float yPosition = 240;

        try (PDDocument document = new PDDocument()) {

            PDPage page = new PDPage(new PDRectangle(PAGE_WIDTH, PAGE_HEIGHT));
            document.addPage(page);

            try (PDPageContentStream content =
                     new PDPageContentStream(document, page, AppendMode.OVERWRITE, true, true)) {

                /* ================= BACKGROUND ================= */
                content.setNonStrokingColor(new Color(255, 221, 89));
                content.addRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
                content.fill();

                /* ================= BORDER ================= */
                content.setStrokingColor(Color.BLACK);
                content.setLineWidth(3);
                content.addRect(8, 8, PAGE_WIDTH - 16, PAGE_HEIGHT - 16);
                content.stroke();

                /* ================= HEADER ================= */
                content.beginText();
                content.setFont(fontBold, 20);
                content.setNonStrokingColor(Color.BLACK);
                content.newLineAtOffset(110, 305);
                content.showText("ALSORG INTERIORS INDIA PVT. LTD.");
                content.endText();

                content.moveTo(50, 290);
                content.lineTo(550, 290);
                content.stroke();

                /* ================= LOGO ================= */
                if (logoPath != null && Files.exists(Path.of(logoPath))) {
                    PDImageXObject logo =
                            PDImageXObject.createFromFile(logoPath, document);
                    content.drawImage(logo, 15, 295, 70, 40);
                }

                content.setFont(fontRegular, 12);

                drawText(content, 50, 270, "PD No: " + safe(data.getPdNo()));
                drawText(content, 175, 270, "SNo: " + safe(data.getStickerNumber()));
                drawText(content, 355, 270, "Dwg No: " + safe(data.getDrawingNo()));
                drawText(content, 465, 270, "Date: " + safe(data.getDate()));

                content.moveTo(45, 260);
                content.lineTo(555, 260);
                content.stroke();

                /* ================= CLIENT NAME & ADDRESS (HANGING INDENT) ================= */
                String heading = "Client Name & Address:";
                float headingX = 45;

                drawText(content, headingX, yPosition, heading);

                float headingWidth =
                        fontRegular.getStringWidth(heading) / 1000 * fontSize;

                String clientText =
                        safe(data.getClientName()) + " " + safe(data.getClientAddress());
                
                float paddingAfterHeading = 23;
                
                drawWrappedText(
                        content,
                        fontRegular,
                        fontSize,
                        clientText,
                        headingX + headingWidth + paddingAfterHeading,
                        yPosition,
                        470 - headingWidth - paddingAfterHeading,
                        14
                );

                yPosition -= 30;
                content.moveTo(45, yPosition);
                content.lineTo(555, yPosition);
                content.stroke();

                /* ================= ITEM INFO ================= */
                drawText(content, 50, 190, "Qty: " + data.getQuantity());
                drawText(content, 180, 190, "Item Name: " + safe(data.getItemName()));

                content.moveTo(45, 175);
                content.lineTo(555, 175);
                content.stroke();

                drawText(content, 50, 155, "Description: " + safe(data.getDescription()));

                content.moveTo(45, 135);
                content.lineTo(555, 135);
                content.stroke();

                drawText(content, 50, 110, "Remarks: " + safe(data.getRemarks()));
                drawText(content, 420, 110, "Floor: " + safe(data.getFloor()));

                content.moveTo(45, 90);
                content.lineTo(555, 90);
                content.stroke();

                drawText(content, 50, 60, "Delivered By:");
                drawText(content, 240, 60, "Prepared By:");
                drawText(content, 420, 60, "Checked By:");

                content.moveTo(45, 45);
                content.lineTo(555, 45);
                content.stroke();

                /* ================= BARCODE ================= */
                BufferedImage barcodeImage =
                        barcodeService.generateCode128Barcode(
                                safe(data.getBarcodeText()),
                                200,
                                60
                        );

                PDImageXObject barcode =
                        PDImageXObject.createFromByteArray(
                                document,
                                imageToBytes(barcodeImage),
                                "barcode"
                        );

                content.drawImage(barcode, 490, 295, 95, 40);
            }

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            document.save(out);

            System.out.println(">>> PDF GENERATED, size = " + out.size());
            return out.toByteArray();

        } catch (IOException e) {
            throw new RuntimeException("Failed to generate sticker PDF", e);
        }
    }

    /* ================= UTIL METHODS ================= */

    private void drawText(PDPageContentStream content, float x, float y, String text)
            throws IOException {
        content.beginText();
        content.newLineAtOffset(x, y);
        content.showText(text);
        content.endText();
    }

    private void drawWrappedText(
            PDPageContentStream cs,
            PDFont font,
            float fontSize,
            String text,
            float startX,
            float startY,
            float maxWidth,
            float leading
    ) throws IOException {

        List<String> lines = new ArrayList<>();
        StringBuilder currentLine = new StringBuilder();

        for (String word : text.split("\\s+")) {
            String testLine = currentLine + word + " ";
            float width = font.getStringWidth(testLine) / 1000 * fontSize;

            if (width > maxWidth) {
                lines.add(currentLine.toString());
                currentLine = new StringBuilder(word).append(" ");
            } else {
                currentLine.append(word).append(" ");
            }
        }

        if (!currentLine.isEmpty()) {
            lines.add(currentLine.toString());
        }

        float y = startY;
        for (String line : lines) {
            cs.beginText();
            cs.setFont(font, fontSize);
            cs.newLineAtOffset(startX, y);
            cs.showText(line.trim());
            cs.endText();
            y -= leading;
        }
    }

    private byte[] imageToBytes(BufferedImage image) throws IOException {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        ImageIO.write(image, "png", baos);
        return baos.toByteArray();
    }

    private String safe(Object value) {
        return value == null ? "-" : value.toString();
    }
}
