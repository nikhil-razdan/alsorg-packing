package com.alsorg.packing.service.pdf;

import java.awt.Color;
import com.alsorg.packing.domain.qrcodegenerator.QRCodeGenerator;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.PDPageContentStream.AppendMode;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDFont;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.springframework.stereotype.Service;
import com.alsorg.packing.service.pdf.dto.StickerPdfData;

@Service
public class PdfStickerService {


    private static final float PAGE_WIDTH = 600;
    private static final float PAGE_HEIGHT = 350;

    // 🔒 FOOTER ZONE (DO NOT RANDOMLY CHANGE)
    private static final float FOOTER_TEXT_Y = 60;

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

             // ================= PRINT ITERATION (TOP LEFT) =================
                if (data.getPrintIteration() > 1) {
                    cs.beginText();
                    cs.setFont(PDType1Font.HELVETICA_BOLD, 22);
                    cs.newLineAtOffset(20, PAGE_HEIGHT - 35);
                    cs.showText(String.valueOf(data.getPrintIteration()));
                    cs.endText();
                }
                
                /* ================= HEADER ================= */
                if (data.isShowCompanyHeader()) {

                    String title = "ALSORG";

                    float fontSize = 20;
                    cs.setFont(bold, fontSize);

                    float textWidth = bold.getStringWidth(title) / 1000 * fontSize;
                    float x = (PAGE_WIDTH - textWidth) / 2;
                    float y = 310;

                    cs.beginText();
                    cs.newLineAtOffset(x, y);
                    cs.showText(title);
                    cs.endText();
                }

                // Date at top-right
                cs.setFont(regular, 13);
                String date = LocalDateTime.now(ZoneId.of("Asia/Kolkata"))
                        .format(DateTimeFormatter.ofPattern("dd-MM-yyyy"));

                drawText(cs, 470, 312, "Pkg dt: " + date);

                cs.moveTo(50, 295);
                cs.lineTo(550, 295);
                cs.stroke();

                /* ================= CLIENT INFO ================= */
                cs.setFont(regular, FONT_SIZE);
                drawLabelValue(
                        cs, bold, regular, FONT_SIZE,
                        45,
                        275,
                        "Client Name & Address: ",
                                 safe(data.getClientName())
                                + " "
                                + safe(data.getClientAddress())
                );

                cs.moveTo(45, 260);
                cs.lineTo(555, 260);
                cs.stroke();

                /* ================= PD / SNo / DWG ================= */
                drawLabelValue(cs, bold, regular, FONT_SIZE, 50, 240, "PD No: ", safe(data.getPdNo()));
                drawLabelValue(cs, bold, regular, FONT_SIZE, 175, 240, "SNo: ", safe(data.getStickerNumber()));
                drawLabelValue(cs, bold, regular, FONT_SIZE, 370, 240, "Dwg No: ", safe(data.getDrawingNo()));

                cs.moveTo(45, 225);
                cs.lineTo(555, 225);
                cs.stroke();

                /* ================= ITEM & QTY ================= */
                drawItemNameAutoFit(
                	    cs,
                	    regular,
                	    14,   // start font
                	    8,    // min font
                	    150,  // X (after label)
                	    200,
                	    380,  // max width
                	    safe(data.getItemName())
                	);

                	// Label separately (fixed)
                	drawTextWithFont(cs, bold, 12, 50, 200, "Item Name:");

                cs.moveTo(45, 185);
                cs.lineTo(555, 185);
                cs.stroke();

                cs.setFont(regular, FONT_SIZE);

             // label
                drawTextWithFont(cs, bold, FONT_SIZE, 50, 165, "Description:");

             // wrapped content
             drawWrappedTextAutoFont(
            		    cs,
            		    regular,
            		    12,   // starting font
            		    7,    // minimum font
            		    130,
            		    165,
            		    400,
            		    35,   // 🔥 MAX HEIGHT of description box
            		    safe(data.getDescription())
            		);

                cs.moveTo(45, 145);
                cs.lineTo(560, 145);
                cs.stroke();

                drawLabelValue(cs, bold, regular, FONT_SIZE, 50, 125, "Remarks: ", safe(data.getRemarks()));
                drawLabelValue(cs, bold, regular, FONT_SIZE, 420, 125, "Floor: ", safe(data.getFloor()));

                drawLabelValue(cs, bold, regular, FONT_SIZE, 50, 93, "Dimension: ", safe(data.getDimensions()));
                drawLabelValue(cs, bold, regular, FONT_SIZE, 420, 93, "Weight: " , safe(data.getWeight()));

                cs.moveTo(45, 84); //90
                cs.lineTo(555, 84); //90
                cs.stroke();
                
                cs.moveTo(45, 110);//105
                cs.lineTo(555, 110); //105
                cs.stroke();
                
            
                /* ================= FOOTER ================= */
                drawTextWithFont(cs, bold, FONT_SIZE, 49, FOOTER_TEXT_Y, "Delivered By:");
                drawTextWithFont(cs, bold, FONT_SIZE, 239, FOOTER_TEXT_Y, "Prepared By:");
                drawTextWithFont(cs, bold, FONT_SIZE, 420, FOOTER_TEXT_Y, "Checked By:");

                String qrData =
                        data.getQrPayload() != null && !data.getQrPayload().isBlank()
                                ? data.getQrPayload()
                                : "ALSORG|SN=" + safe(data.getStickerNumber());

                byte[] qrBytes;
                try {
                    qrBytes = QRCodeGenerator.generateQRCode(qrData);
                } catch (Exception e) {
                    throw new RuntimeException("QR generation failed", e);
                }

                PDImageXObject qrImage = PDImageXObject.createFromByteArray(
                        document,
                        qrBytes,
                        "qr"
                );

                // 🔥 POSITION (BOTTOM RIGHT)
                cs.drawImage(qrImage, 495, 10, 85, 55); //515 7
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

    private String safe(Object v) {
        return v == null ? "-" : v.toString();
    }
    
    private void drawWrappedTextAutoFont(
            PDPageContentStream cs,
            PDFont font,
            float startFontSize,
            float minFontSize,
            float x,
            float y,
            float maxWidth,
            float maxHeight,
            String text) throws IOException {

        float fontSize = startFontSize;

        while (fontSize >= minFontSize) {

            String[] words = text.split(" ");
            StringBuilder line = new StringBuilder();
            float leading = 1.4f * fontSize;
            float currentY = y;

            boolean overflow = false;

            // 🔍 CHECK if text fits in given height
            for (String word : words) {
                String testLine = line + word + " ";
                float size = font.getStringWidth(testLine) / 1000 * fontSize;

                if (size > maxWidth) {
                    currentY -= leading;

                    // 🚨 HEIGHT LIMIT CHECK
                    if ((y - currentY) > maxHeight) {
                        overflow = true;
                        break;
                    }

                    line = new StringBuilder(word + " ");
                } else {
                    line.append(word).append(" ");
                }
            }

            // ✅ IF FITS → DRAW
            if (!overflow) {
                currentY = y;
                line = new StringBuilder();

                for (String word : words) {
                    String testLine = line + word + " ";
                    float size = font.getStringWidth(testLine) / 1000 * fontSize;

                    if (size > maxWidth) {
                        drawTextWithFont(cs, font, fontSize, x, currentY, line.toString());
                        line = new StringBuilder(word + " ");
                        currentY -= leading;
                    } else {
                        line.append(word).append(" ");
                    }
                }

                if (!line.isEmpty()) {
                    drawTextWithFont(cs, font, fontSize, x, currentY, line.toString());
                }

                return;
            }

            // 🔻 reduce font and retry
            fontSize -= 1;
        }

        // ⚠ fallback (minimum font)
        drawTextWithFont(cs, font, minFontSize, x, y, text);
    }
    
    private void drawTextWithFont(PDPageContentStream cs, PDFont font, float fontSize,
            float x, float y, String text) throws IOException {
cs.beginText();
cs.setFont(font, fontSize);
cs.newLineAtOffset(x, y);
cs.showText(text);
cs.endText();
}
    private void drawItemNameAutoFit(
            PDPageContentStream cs,
            PDFont font,
            float startFont,
            float minFont,
            float x,
            float y,
            float maxWidth,
            String text) throws IOException {

        float fontSize = startFont;

        while (fontSize >= minFont) {
            float textWidth = font.getStringWidth(text) / 1000 * fontSize;

            if (textWidth <= maxWidth) {
                drawTextWithFont(cs, font, fontSize, x, y, text);
                return;
            }

            fontSize -= 0.5f;
        }

        // fallback
        drawTextWithFont(cs, font, minFont, x, y, text);
    }
    
    private void drawLabelValue(
            PDPageContentStream cs,
            PDFont labelFont,
            PDFont valueFont,
            float fontSize,
            float x,
            float y,
            String label,
            String value
    ) throws IOException {

        // 🔥 draw label
        drawTextWithFont(cs, labelFont, fontSize, x, y, label);

        // 🔥 calculate label width
        float labelWidth = labelFont.getStringWidth(label) / 1000 * fontSize;

        // 🔥 draw value right after label
        drawTextWithFont(cs, valueFont, fontSize, x + labelWidth + 2, y, value);
    }
}

