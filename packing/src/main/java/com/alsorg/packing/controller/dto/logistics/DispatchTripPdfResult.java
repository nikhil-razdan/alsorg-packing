package com.alsorg.packing.controller.dto.logistics;

import java.util.UUID;

public class DispatchTripPdfResult {

    private UUID tripId;

    private String challanNumber;

    private byte[] pdfBytes;

    public DispatchTripPdfResult(
            UUID tripId,
            String challanNumber,
            byte[] pdfBytes
    ) {
        this.tripId = tripId;
        this.challanNumber = challanNumber;
        this.pdfBytes = pdfBytes;
    }

    public UUID getTripId() {
        return tripId;
    }

    public String getChallanNumber() {
        return challanNumber;
    }

    public byte[] getPdfBytes() {
        return pdfBytes;
    }
}