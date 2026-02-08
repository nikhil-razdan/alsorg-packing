package com.alsorg.packing.service.barcode;

import java.awt.image.BufferedImage;
import java.util.HashMap;
import java.util.Map;

import org.springframework.stereotype.Service;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.MultiFormatWriter;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.client.j2se.MatrixToImageWriter;

@Service
public class BarcodeService {

    public BufferedImage generateCode128Barcode(String text) {
        try {
            Map<EncodeHintType, Object> hints = new HashMap<>();
            hints.put(EncodeHintType.MARGIN, 20); // quiet zone (MANDATORY)

            BitMatrix bitMatrix = new MultiFormatWriter()
                    .encode(
                            text,
                            BarcodeFormat.CODE_128,
                            400,
                            100,
                            hints
                    );

            return MatrixToImageWriter.toBufferedImage(bitMatrix);

        } catch (Exception e) {
            throw new RuntimeException("Failed to generate barcode", e);
        }
    }
}
