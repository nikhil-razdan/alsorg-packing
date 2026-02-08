package com.alsorg.packing.service.pdf;

import java.awt.Color;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;

import javax.imageio.ImageIO;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.PDPageContentStream.AppendMode;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDFont;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.springframework.stereotype.Service;

import com.alsorg.packing.service.barcode.BarcodePayloadBuilder;
import com.alsorg.packing.service.barcode.BarcodeService;
import com.alsorg.packing.service.pdf.dto.StickerPdfData;

@Service
public class PdfStickerService {

    private final BarcodeService barcodeService;
    private final BarcodePayloadBuilder barcodePayloadBuilder;

    private static final float PAGE_WIDTH = 600;
    private static final float PAGE_HEIGHT = 350;

    // 🔒 FOOTER ZONE (DO NOT RANDOMLY CHANGE)
    private static final float FOOTER_TEXT_Y = 95;
    private static final float BARCODE_Y = 15;

    public PdfStickerService(
            BarcodeService barcodeService,
            BarcodePayloadBuilder barcodePayloadBuilder
    ) {
        this.barcodeService = barcodeService;
        this.barcodePayloadBuilder = barcodePayloadBuilder;
    }

    public byte[] generateSticker(StickerPdfData data) {

        int FONT_SIZE = 12;

        PDFont dateFont = PDType1Font.HELVETICA_BOLD;
        PDFont regular = PDType1Font.HELVETICA;
        PDFont bold = PDType1Font.HELVETICA_BOLD;

        try (PDDocument document = new PDDocument()) {

            PDPage page = new PDPage(new PDRectangle(PAGE_WIDTH, PAGE_HEIGHT));
            document.addPage(page);

            try (PDPageContentStream cs =
                         new PDPageContentStream(
                                 document,
                                 page,
                                 AppendMode.OVERWRITE,
                                 true,
                                 true
                         )) {

                /* ================= BACKGROUND ================= */
                cs.setNonStrokingColor(Color.WHITE);
                cs.addRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
                cs.fill();
                cs.setNonStrokingColor(Color.BLACK);

                /* ================= OUTER BORDER ================= */
                cs.setStrokingColor(Color.BLACK);
                cs.setLineWidth(3);
                cs.addRect(10, 6, PAGE_WIDTH - 18, PAGE_HEIGHT - 14);
                cs.stroke();

                /* ================= HEADER ================= */
                cs.beginText();
                cs.setFont(bold, 20);
                cs.newLineAtOffset(110, 310);
                cs.showText("ALSORG INTERIORS INDIA PVT. LTD.");
                cs.endText();

                // Date at top-right
                cs.setFont(regular, 8);
                drawText(cs, 482, 312, "Date of Packing: " + safe(data.getDate()));

                cs.moveTo(50, 295);
                cs.lineTo(550, 295);
                cs.stroke();

                /* ================= CLIENT INFO ================= */
                cs.setFont(regular, FONT_SIZE);
                drawText(
                        cs,
                        45,
                        275,
                        "Client Name & Address: "
                                + safe(data.getClientName())
                                + " "
                                + safe(data.getClientAddress())
                );

                cs.moveTo(45, 260);
                cs.lineTo(555, 260);
                cs.stroke();

                /* ================= PD / SNo / DWG ================= */
                drawText(cs, 50, 240, "PD No: " + safe(data.getPdNo()));
                drawText(cs, 175, 240, "SNo: " + safe(data.getStickerNumber()));
                drawText(cs, 355, 240, "Dwg No: " + safe(data.getDrawingNo()));

                cs.moveTo(45, 225);
                cs.lineTo(555, 225);
                cs.stroke();

                /* ================= ITEM & QTY ================= */
                drawText(cs, 50, 200, "Item Name: " + safe(data.getItemName()));
                drawText(cs, 420, 200, "Qty: " + data.getQuantity());

                cs.moveTo(45, 185);
                cs.lineTo(555, 185);
                cs.stroke();

                drawText(cs, 50, 165, "Description: " + safe(data.getDescription()));

                cs.moveTo(45, 145);
                cs.lineTo(555, 145);
                cs.stroke();

                drawText(cs, 50, 125, "Remarks: " + safe(data.getRemarks()));
                drawText(cs, 420, 125, "Floor: " + safe(data.getFloor()));

                cs.moveTo(45, 115);
                cs.lineTo(555, 115);
                cs.stroke();

                /* ================= FOOTER ================= */
                drawText(cs, 55, FOOTER_TEXT_Y, "Delivered By:");
                drawText(cs, 245, FOOTER_TEXT_Y, "Prepared By:");
                drawText(cs, 425, FOOTER_TEXT_Y, "Checked By:");

                /* ================= BARCODE ================= */
                BufferedImage barcodeImg =
                        barcodeService.generateCode128Barcode(
                                barcodePayloadBuilder.build(data)
                        );

                PDImageXObject barcode =
                        PDImageXObject.createFromByteArray(
                                document,
                                imageToBytes(barcodeImg),
                                "barcode"
                        );

                float bw = 420;
                float bh = 70;
                float bx = (PAGE_WIDTH - bw) / 2;

                cs.drawImage(barcode, bx, BARCODE_Y, bw, bh);
            }

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            document.save(out);
            return out.toByteArray();

        } catch (IOException e) {
            throw new RuntimeException(e);
        }
    }

    /* ================= UTIL ================= */

    private void drawText(PDPageContentStream cs, float x, float y, String text)
            throws IOException {
        cs.beginText();
        cs.newLineAtOffset(x, y);
        cs.showText(text);
        cs.endText();
    }

    private byte[] imageToBytes(BufferedImage image) throws IOException {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        ImageIO.write(image, "png", baos);
        return baos.toByteArray();
    }

    private String safe(Object v) {
        return v == null ? "-" : v.toString();
    }
}
