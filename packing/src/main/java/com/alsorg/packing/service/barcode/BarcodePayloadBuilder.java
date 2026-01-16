package com.alsorg.packing.service.barcode;

import org.springframework.stereotype.Service;

import com.alsorg.packing.service.pdf.dto.StickerPdfData;

@Service
public class BarcodePayloadBuilder {

    /**
     * Builds a scanner-friendly barcode payload
     * Format: KEY=VALUE|KEY=VALUE|...
     */
    public String build(StickerPdfData data) {

        return safe(data.getItemName());
    }

    private String safe(String value) {
        return value == null ? "-" : value.replaceAll("\\s+", "");
    }

    private String compact(String value) {
        if (value == null) return "-";
        return value
                .toUpperCase()
                .replaceAll("[^A-Z0-9]", "");
    }
}
