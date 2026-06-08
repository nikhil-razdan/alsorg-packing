package com.alsorg.packing.service.pdf;

import org.apache.pdfbox.pdmodel.*;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.*;

import org.springframework.stereotype.Service;

import com.alsorg.packing.repository.ZohoStickerRepository;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.LinkedHashSet;
import java.util.Set;

@Service
public class ChalaanPdfService {

    private static final float PAGE_WIDTH = 600;
    private static final float PAGE_HEIGHT = 800;
    private final ZohoStickerRepository stickerRepo;
    
    public ChalaanPdfService(ZohoStickerRepository stickerRepo) {
        this.stickerRepo = stickerRepo;
    }

    public byte[] generateChalaan(ChalaanPdfData data) {

    	ChalaanItem firstItem = (data.getItems() != null && !data.getItems().isEmpty())
    	        ? data.getItems().get(0)
    	        : null;

    	String pdNo = buildAllPdNos(data.getItems());
    	String clientName = "-";

    	// Existing voucherNo will now print as Challan No
    	String challanNo = safe(data.getVoucherNo());

    	// These will be integrated later
    	String driverName = "-";
    	String vehicleNo = "-";

    	if (firstItem != null) {
    	    clientName = safe(firstItem.getClientName());
    	    data.setAddress(safe(firstItem.getClientAddress()));
    	}

        try (PDDocument doc = new PDDocument()) {

            PDPage page = new PDPage(new PDRectangle(PAGE_WIDTH, PAGE_HEIGHT));
            doc.addPage(page);

            PDPageContentStream cs = new PDPageContentStream(doc, page);

            PDFont bold = PDType1Font.HELVETICA_BOLD;
            PDFont regular = PDType1Font.HELVETICA;

            /* ================= TITLE ================= */

            drawText(cs, bold, 20, 180, 760, "External Movement Challan");

            drawLine(cs, 40, 740, 560, 740);

            /* ================= HEADER ================= */

            /* ================= HEADER ================= */

            String date = LocalDate.now(ZoneId.of("Asia/Kolkata"))
                    .format(java.time.format.DateTimeFormatter.ofPattern("dd-MM-yyyy"));

            drawChallanHeader(
                    cs,
                    regular,
                    pdNo,
                    clientName,
                    safe(data.getAddress()),
                    date,
                    challanNo,
                    driverName,
                    vehicleNo
            );

            drawLine(cs, 40, 640, 560, 640);

            /* ================= TABLE GRID ================= */

            float tableTop = 620;
            float tableBottom = 120;

            // vertical lines
            drawLine(cs, 40, tableTop, 40, tableBottom);   // left
            drawLine(cs, 100, tableTop, 100, tableBottom); // SR
            drawLine(cs, 420, tableTop, 420, tableBottom); // DESC
            drawLine(cs, 560, tableTop, 560, tableBottom); // right

            // header line
            drawLine(cs, 40, 600, 560, 600);

            // bottom line
            drawLine(cs, 40, tableBottom, 560, tableBottom);

            /* ================= TABLE HEADER ================= */

            drawText(cs, bold, 10, 50, 605, "SR.NO");
            drawText(cs, bold, 10, 140, 605, "DESCRIPTION");
            drawText(cs, bold, 10, 435, 605, "REMARKS");

            /* ================= TABLE BODY ================= */

            float y = 580;
            int sr = 1;

            for (ChalaanItem item : data.getItems()) {

            	if (item == null) continue;
                // 🔥 PAGE BREAK
                if (y < 160) {
                    cs.close();

                    page = new PDPage(new PDRectangle(PAGE_WIDTH, PAGE_HEIGHT));
                    doc.addPage(page);
                    cs = new PDPageContentStream(doc, page);

                    // 🔁 REDRAW HEADER
                    drawText(cs, bold, 20, 180, 760, "External Movement Challan");
                    drawLine(cs, 40, 740, 560, 740);

                    date = LocalDate.now(ZoneId.of("Asia/Kolkata"))
                            .format(java.time.format.DateTimeFormatter.ofPattern("dd-MM-yyyy"));

                    drawChallanHeader(
                            cs,
                            regular,
                            pdNo,
                            clientName,
                            safe(data.getAddress()),
                            date,
                            challanNo,
                            driverName,
                            vehicleNo
                    );

                    drawLine(cs, 40, 640, 560, 640);

                    // 🔁 TABLE GRID AGAIN
                    tableTop = 620;
                    tableBottom = 120;

                    drawLine(cs, 40, tableTop, 40, tableBottom);
                    drawLine(cs, 100, tableTop, 100, tableBottom);
                    drawLine(cs, 420, tableTop, 420, tableBottom);
                    drawLine(cs, 560, tableTop, 560, tableBottom);

                    drawLine(cs, 40, 600, 560, 600);

                    // 🔁 TABLE HEADER AGAIN
                    drawText(cs, bold, 10, 50, 605, "SR.NO");
                 // Center DESCRIPTION too
                    float descCenterX = (100 + 420) / 2f;
                    float descWidth = bold.getStringWidth("DESCRIPTION") / 1000 * 10;

                    drawText(cs, bold, 10, descCenterX - descWidth / 2, 605, "DESCRIPTION");
                    float remarksCenterX = (420 + 560) / 2f; // center of remarks column
                    float textWidth = bold.getStringWidth("REMARKS") / 1000 * 10;

                    drawText(cs, bold, 10, remarksCenterX - textWidth / 2, 605, "REMARKS");

                    y = 580;
                }

                float startY = y;

                drawText(cs, regular, 10, 50, startY, String.valueOf(sr));

                String fullDesc =
                        "PD No: " + safe(item.getPdNo()) + " | " +
                        "Item: " + safe(item.getItemName()) + " | " +
                        "Dwg No: " + safe(item.getDrawingNo()) + " | " +
                        "Desc: " + safe(item.getDescription());

                y = drawWrappedText(
                        cs,
                        regular,
                        10,
                        110,
                        y,
                        300,
                        fullDesc
                );

                drawText(cs, regular, 10, 430, startY, safe(item.getRemarks()));

                drawLine(cs, 40, y - 5, 560, y - 5);

                y -= 20;
                sr++;
            }
            
            /* ================= FOOTER (PROPER SIGNATURE LAYOUT) ================= */

            float footerTop = 120;
            float footerBottom = 40;

            // Outer border
            drawLine(cs, 40, footerTop, 560, footerTop);
            drawLine(cs, 40, footerBottom, 560, footerBottom);
            drawLine(cs, 40, footerTop, 40, footerBottom);
            drawLine(cs, 560, footerTop, 560, footerBottom);

            // Vertical divider (left / right)
            drawLine(cs, 300, footerTop, 300, footerBottom);

            // Horizontal row dividers
            float row1Y = 95;
            float row2Y = 70;

            drawLine(cs, 40, row1Y, 560, row1Y);
            drawLine(cs, 40, row2Y, 560, row2Y);

            /* ===== LEFT SIDE ===== */

            // Labels
            drawText(cs, regular, 10, 50, 105, "Delivered By");
            drawText(cs, regular, 10, 50, 80, "Prepared By");
            drawText(cs, regular, 10, 50, 55, "Received By");

            /* ===== RIGHT SIDE ===== */

            // Labels
            drawText(cs, regular, 10, 310, 105, "Checked By");
            drawText(cs, regular, 10, 310, 80, "Authorised By");
            drawText(cs, regular, 10, 310, 55, "Security Sign");

            cs.close();

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            doc.save(out);
            return out.toByteArray();

        } catch (IOException e) {
            throw new RuntimeException(e);
        }
    }

    /* ================= UTIL ================= */

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

        /*
         * LEFT SIDE HEADER
         * P.D. No may contain multiple PD numbers, so it is wrapped.
         */
        drawText(cs, regular, 10, 40, 710, "P.D. No:");

        float headerPdTextEndY = drawWrappedText(
                cs,
                regular,
                9,
                95,
                710,
                245,
                pdNo
        );

        float headerClientY = Math.min(690, headerPdTextEndY - 18);
        float headerAddressY = headerClientY - 20;

        drawText(cs, regular, 10, 40, headerClientY, "Client Name: " + safe(clientName));
        drawText(cs, regular, 10, 40, headerAddressY, "Address: " + safe(address));

        /*
         * RIGHT SIDE HEADER
         * Voucher No is now displayed as Challan No.
         * Driver Name and Vehicle No are placeholders for future integration.
         */
        drawText(cs, regular, 10, 350, 710, "Date: " + safe(date));
        drawText(cs, regular, 10, 350, 690, "Challan No: " + safe(challanNo));
        drawText(cs, regular, 10, 350, 670, "Driver Name: " + safe(driverName));
        drawText(cs, regular, 10, 350, 650, "Vehicle No: " + safe(vehicleNo));
    }
    
    private void drawText(PDPageContentStream cs, PDFont font, int size,
                          float x, float y, String text) throws IOException {

        cs.beginText();
        cs.setFont(font, size);
        cs.newLineAtOffset(x, y);
        if (text == null || text.trim().isEmpty()) {
            text = "-";
        }

        cs.showText(text);
        cs.endText();
    }

    private void drawLine(PDPageContentStream cs,
                          float x1, float y1, float x2, float y2) throws IOException {
        cs.moveTo(x1, y1);
        cs.lineTo(x2, y2);
        cs.stroke();
    }

    private float drawWrappedText(PDPageContentStream cs,
                                 PDFont font,
                                 int fontSize,
                                 float x,
                                 float y,
                                 float maxWidth,
                                 String text) throws IOException {

    	if (text == null || text.trim().isEmpty()) {
    	    text = "-";
    	}
        String[] words = text.split(" ");
        StringBuilder line = new StringBuilder();

        for (String word : words) {

            String test = line + word + " ";
            try {
                float size = font.getStringWidth(test) / 1000 * fontSize;
                if (size > maxWidth) {
                    drawText(cs, font, fontSize, x, y, line.toString());
                    line = new StringBuilder(word + " ");
                    y -= 14;
                } else {
                    line.append(word).append(" ");
                }
            } catch (Exception e) {
                test = "-";
                float size = font.getStringWidth(test) / 1000 * fontSize;
                if (size > maxWidth) {
                    drawText(cs, font, fontSize, x, y, line.toString());
                    line = new StringBuilder(word + " ");
                    y -= 14;
                } else {
                    line.append(word).append(" ");
                }
            }

        }

        if (!line.isEmpty()) {
            drawText(cs, font, fontSize, x, y, line.toString());
        }

        return y;
    }

    private String buildAllPdNos(List<ChalaanItem> items) {

        Set<String> pdNos = new LinkedHashSet<>();

        if (items != null) {
            for (ChalaanItem item : items) {
                if (item == null) continue;

                String pd = safe(item.getPdNo());

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
    
    private String safe(Object v) {
        if (v == null) return "-";
        String s = v.toString().trim();
        return s.isEmpty() ? "-" : s;
    }
}