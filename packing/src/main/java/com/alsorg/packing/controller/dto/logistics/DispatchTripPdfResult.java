package com.alsorg.packing.controller.dto.logistics;

import java.util.UUID;

/**
 * Service result for a generated logistics trip/challan PDF.
 *
 * The existing mutable byte[] contract is intentionally retained to avoid
 * doubling large PDF buffers on every response.
 */
public class DispatchTripPdfResult {

    private final UUID tripId;
    private final String challanNumber;
    private final byte[] pdfBytes;

    public DispatchTripPdfResult(
            UUID tripId,
            String challanNumber,
            byte[] pdfBytes) {
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
