package com.alsorg.packing.service.pdf;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;

import org.apache.pdfbox.pdmodel.*;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.*;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.springframework.stereotype.Service;

import com.alsorg.packing.domain.dispatch.DispatchedItem;
import com.alsorg.packing.domain.qrcodegenerator.QRCodeGenerator;
import com.alsorg.packing.repository.ZohoStickerRepository;
import com.alsorg.packing.domain.sticker.ZohoSticker;

@Service
public class GatePassPdfService {

    private static final float WIDTH = 600;
    private static final float HEIGHT = 250;

    private final ZohoStickerRepository stickerRepo;

    public GatePassPdfService(ZohoStickerRepository stickerRepo) {
        this.stickerRepo = stickerRepo;
    }

    public byte[] generateGatePass(DispatchedItem item) throws Exception {

        try (PDDocument doc = new PDDocument()) {

        	String stickerNumber = safe(item.getStickerNumber());

            PDPage page = new PDPage(new PDRectangle(WIDTH, HEIGHT));
            doc.addPage(page);

            PDPageContentStream cs = new PDPageContentStream(doc, page);

            PDFont bold = PDType1Font.HELVETICA_BOLD;
            PDFont regular = PDType1Font.HELVETICA;

            /* ================= BACKGROUND ================= */
            cs.setNonStrokingColor(new Color(245, 245, 245));
            cs.addRect(0, 0, WIDTH, HEIGHT);
            cs.fill();

            cs.setNonStrokingColor(Color.BLACK);

            /* ================= BORDER ================= */
            cs.setLineWidth(2);
            cs.addRect(10, 10, WIDTH - 20, HEIGHT - 20);
            cs.stroke();

            /* ================= HEADER ================= */

            // Title (left)
            draw(cs, bold, 18, 20, HEIGHT - 40, "WAREHOUSE GATE PASS");

            String brand = "ALSORG";
            float textWidth = getTextWidth(bold, 14, brand);
            float rightX = WIDTH - 10 - textWidth;
            float y = HEIGHT - 40;

            draw(cs, bold, 14, rightX, y, brand);

            /* ================= GATE PASS ================= */
            draw(cs, bold, 22, 20, HEIGHT - 80, item.getGatePassNumber());

            /* ================= DETAILS ================= */
            draw(cs, regular, 12, 20, HEIGHT - 120,
                    "Item: " + safe(item.getName()));

            draw(cs, regular, 12, 20, HEIGHT - 140,
                    "Sticker No: " + safe(stickerNumber));

            draw(cs, regular, 12, 20, HEIGHT - 160,
                    "Warehouse: " + safe(item.getWarehouseCode()));
            
            draw(cs, regular, 12, 20, HEIGHT - 180,
                    "From: " + safe(item.getFromLocation()));

            draw(cs, regular, 12, 20, HEIGHT - 200,
                    "Created By: " + safe(item.getCreatedBy()));

            ZoneId IST = ZoneId.of("Asia/Kolkata");

            String date = LocalDate.now(IST)
                    .format(DateTimeFormatter.ofPattern("dd-MM-yyyy"));

            draw(cs, regular, 12, 20, HEIGHT - 220,
                    "Date: " + date);

            /* ================= QR ================= */
            String qrData =
                    "GatePass: " + item.getGatePassNumber() +
                    "\nSticker: " + stickerNumber +
                    "\nItem: " + item.getName();

            byte[] qr = QRCodeGenerator.generateQRCode(qrData);

            PDImageXObject qrImg = PDImageXObject.createFromByteArray(doc, qr, "qr");

            cs.drawImage(qrImg, WIDTH - 120, 30, 90, 90);

            cs.close();

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            doc.save(out);
            return out.toByteArray();

        } catch (IOException e) {
            throw new RuntimeException("Gate pass PDF failed", e);
        }
    }
    
    public byte[] generateBulkGatePass(List<DispatchedItem> items) throws Exception {

        try (PDDocument doc = new PDDocument()) {

            PDPage page = new PDPage(new PDRectangle(700, 400));
            doc.addPage(page);

            PDPageContentStream cs = new PDPageContentStream(doc, page);

            PDFont bold = PDType1Font.HELVETICA_BOLD;
            PDFont regular = PDType1Font.HELVETICA;

            DispatchedItem first = items.get(0);

            /* ================= BACKGROUND ================= */
            cs.setNonStrokingColor(new Color(245, 245, 245));
            cs.addRect(0, 0, 700, 400);
            cs.fill();
            cs.setNonStrokingColor(Color.BLACK);

            /* ================= OUTER BORDER ================= */
            cs.setLineWidth(2);
            cs.addRect(10, 10, 680, 380);
            cs.stroke();

            float y = 360;

            /* ================= HEADER ================= */

            draw(cs, bold, 18, 20, y, "WAREHOUSE GATE PASS");

            // ALSORG top-right
            draw(cs, bold, 14, 600 - 120, y, "ALSORG");

            y -= 30;

            /* ================= MAIN INFO ================= */

            draw(cs, bold, 14, 20, y, "Gate Pass: " + first.getGatePassNumber());
            y -= 20;

            draw(cs, regular, 12, 20, y, "Warehouse: " + first.getWarehouseCode());
            y -= 18;

            draw(cs, regular, 12, 20, y, "From: " + safe(first.getFromLocation()));
            y -= 18;

            draw(cs, regular, 12, 20, y, "Created By: " + safe(first.getCreatedBy()));
            y -= 18;

            ZoneId IST = ZoneId.of("Asia/Kolkata");
            String date = LocalDate.now(IST)
                    .format(DateTimeFormatter.ofPattern("dd-MM-yyyy"));

            draw(cs, regular, 12, 20, y, "Date: " + date);
            y -= 18;

            draw(cs, regular, 12, 20, y, "Total Items: " + items.size());
            y -= 25;

            /* ================= AUTO COLUMN WIDTH ================= */

            float startX = 20;
            y -= 20;

            // Minimum widths (to avoid ugly compression)
            float minItemWidth = 200;
            float minStickerWidth = 120;

            // Calculate max width based on content
            float maxItemWidth = getTextWidth(bold, 12, "Item Description");
            float maxStickerWidth = getTextWidth(bold, 12, "Sticker No");

            for (DispatchedItem item : items) {

               
            	String stickerNo = safe(item.getStickerNumber());
                String itemName = safe(item.getName());

                maxItemWidth = Math.max(maxItemWidth, getTextWidth(regular, 11, itemName));
                maxStickerWidth = Math.max(maxStickerWidth, getTextWidth(regular, 11, stickerNo));
            }

            // Apply minimum + padding
            float padding = 20;

            float colItemWidth = Math.max(minItemWidth, maxItemWidth + padding);
            float colStickerWidth = Math.max(minStickerWidth, maxStickerWidth + padding);

            // Column positions
            float col1X = startX;                  // S.No
            float col2X = col1X + 40;              // Item
            float col3X = col2X + colItemWidth;    // Sticker
            
            
            float maxTableWidth = 660; // inside border

            if ((col3X + colStickerWidth) > maxTableWidth) {
                colStickerWidth = maxTableWidth - col3X;
            }

            float tableEndX = col3X + colStickerWidth;

            /* ================= TABLE HEADER ================= */

            drawLine(cs, startX, y + 10, tableEndX, y + 10);

            draw(cs, bold, 12, col1X + 5, y, "S.No");
            draw(cs, bold, 12, col2X + 5, y, "Item Description");
            draw(cs, bold, 12, col3X + 5, y, "Sticker No");

            y -= 10;
            drawLine(cs, startX, y, tableEndX, y);

            y -= 15;

            /* ================= TABLE BODY ================= */
            StringBuilder qrData = new StringBuilder();
            qrData.append("GatePass: ").append(first.getGatePassNumber()).append("\nItems:\n");
            
            int i = 1;

            for (DispatchedItem item : items) {

                // 🔥 PAGE BREAK LOGIC
                if (y < 60) {
                    cs.close();

                    page = new PDPage(new PDRectangle(700, 400));
                    doc.addPage(page);
                    cs = new PDPageContentStream(doc, page);

                    // Background + border again
                    cs.setNonStrokingColor(new Color(245, 245, 245));
                    cs.addRect(0, 0, 700, 400);
                    cs.fill();
                    cs.setNonStrokingColor(Color.BLACK);

                    cs.setLineWidth(2);
                    cs.addRect(10, 10, 680, 380);
                    cs.stroke();

                    y = 360;

                    // 🔁 REDRAW HEADER
                    draw(cs, bold, 18, 20, y, "WAREHOUSE GATE PASS");
                    String brand = "ALSORG";
                    float textWidth = getTextWidth(bold, 14, brand);

                    // Align to right border (10px padding inside border)
                    float rightX = 700 - 10 - textWidth;

                    draw(cs, bold, 14, rightX, y, brand);

                    y -= 30;

                    draw(cs, bold, 14, 20, y, "Gate Pass: " + first.getGatePassNumber());
                    y -= 20;

                    draw(cs, regular, 12, 20, y, "Warehouse: " + first.getWarehouseCode());
                    y -= 18;

                    draw(cs, regular, 12, 20, y, "From: " + safe(first.getFromLocation()));
                    y -= 18;

                    draw(cs, regular, 12, 20, y, "Created By: " + safe(first.getCreatedBy()));
                    y -= 18;

                    draw(cs, regular, 12, 20, y, "Date: " + date);
                    y -= 18;

                    draw(cs, regular, 12, 20, y, "Total Items: " + items.size());
                    y -= 25;

                    // 🔁 REDRAW TABLE HEADER
                    drawLine(cs, startX, y + 10, tableEndX, y + 10);

                    draw(cs, bold, 12, col1X + 5, y, "S.No");
                    draw(cs, bold, 12, col2X + 5, y, "Item Description");
                    draw(cs, bold, 12, col3X + 5, y, "Sticker No");

                    y -= 10;
                    drawLine(cs, startX, y, tableEndX, y);

                    y -= 15;
                }

                draw(cs, regular, 11, col1X + 5, y, String.valueOf(i++));
                draw(cs, regular, 11, col2X + 5, y, safe(item.getName()));
                draw(cs, regular, 11, col3X + 5, y,
                        safe(item.getStickerNumber()));

                qrData.append("- ").append(item.getName()).append("\n");


                y -= 15;
            }

            /* ================= QR ================= */

            byte[] qr = QRCodeGenerator.generateQRCode(qrData.toString());
            PDImageXObject qrImg = PDImageXObject.createFromByteArray(doc, qr, "qr");

            cs.drawImage(qrImg, 550, 40, 100, 100);

            cs.close();

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            doc.save(out);
            return out.toByteArray();

        } catch (IOException e) {
            throw new RuntimeException("Bulk Gate pass PDF failed", e);
        }
    }

    private void draw(PDPageContentStream cs, PDFont font, int size, float x, float y, String text)
            throws IOException {

        if (text == null) text = "-"; // 🔥 prevent silent failure

        cs.beginText();
        cs.setFont(font, size);
        cs.newLineAtOffset(x, y);
        cs.showText(text);
        cs.endText();
    }
    
    private void drawLine(PDPageContentStream cs,
            float x1, float y1, float x2, float y2) throws IOException {
       cs.moveTo(x1, y1);
       cs.lineTo(x2, y2);
       cs.stroke();
       }
    
    private float getTextWidth(PDFont font, int fontSize, String text) throws IOException {
        return font.getStringWidth(text) / 1000 * fontSize;
    }

    private String safe(String v) {
        return v == null ? "-" : v;
    }
}