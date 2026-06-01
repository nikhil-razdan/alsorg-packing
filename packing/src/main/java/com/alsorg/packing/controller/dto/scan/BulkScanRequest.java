package com.alsorg.packing.controller.dto.scan;

import java.util.List;

public class BulkScanRequest {

    private List<String> scanTexts;

    public List<String> getScanTexts() {
        return scanTexts;
    }

    public void setScanTexts(List<String> scanTexts) {
        this.scanTexts = scanTexts;
    }
}