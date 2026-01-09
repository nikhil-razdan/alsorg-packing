package com.alsorg.packing.service.barcode;

import java.awt.image.BufferedImage;

import org.springframework.stereotype.Service;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.MultiFormatWriter;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.client.j2se.MatrixToImageWriter;

@Service
public class BarcodeService {

    /**
     * Generates a Code128 barcode image from given text
     */
    public BufferedImage generateCode128Barcode(String text, int width, int height) {

        try {
            BitMatrix bitMatrix = new MultiFormatWriter()
                    .encode(text, BarcodeFormat.CODE_128, 300, 100);

            return MatrixToImageWriter.toBufferedImage(bitMatrix);

        } catch (Exception e) {
            throw new RuntimeException("Failed to generate barcode", e);
        }
    }
}
