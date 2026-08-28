package com.alsorg.packing.domain.qrcodegenerator;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.MultiFormatWriter;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.common.BitMatrix;

import java.io.ByteArrayOutputStream;

public final class QRCodeGenerator {

    private static final int QR_SIZE = 200;
    private static final int MAX_QR_TEXT_LENGTH = 8192;

    private QRCodeGenerator() {
    }

    public static byte[] generateQRCode(String text) throws Exception {
        if (text == null || text.isBlank()) {
            throw new IllegalArgumentException("QR content is required");
        }
        if (text.length() > MAX_QR_TEXT_LENGTH) {
            throw new IllegalArgumentException("QR content is too long");
        }

        BitMatrix matrix = new MultiFormatWriter().encode(
                text,
                BarcodeFormat.QR_CODE,
                QR_SIZE,
                QR_SIZE);

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        MatrixToImageWriter.writeToStream(matrix, "PNG", out);
        return out.toByteArray();
    }
}
