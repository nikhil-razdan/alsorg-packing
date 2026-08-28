package com.alsorg.packing.exception;

/**
 * Raised when a PacketItem SKU would collide with another item.
 *
 * The supplied SKU is bounded before it is copied into an exception message so
 * malformed/imported input cannot create an unbounded response/log line.
 */
public class DuplicateSkuException extends RuntimeException {

    private static final long serialVersionUID = 1L;
    private static final int MAX_SAFE_SKU_LENGTH = 200;

    private final String sku;

    public DuplicateSkuException(String sku) {
        super(buildMessage(sku));
        this.sku = safeSku(sku);
    }

    public String getSku() {
        return sku;
    }

    private static String buildMessage(String sku) {
        return "Duplicate SKU found: "
                + safeSku(sku)
                + ". This SKU already exists. Please change packet number, PD No, or Drawing No.";
    }

    private static String safeSku(String value) {
        if (value == null) {
            return "(blank)";
        }

        String clean = value
                .replace('\r', ' ')
                .replace('\n', ' ')
                .trim();

        if (clean.isBlank()) {
            return "(blank)";
        }

        return clean.length() <= MAX_SAFE_SKU_LENGTH
                ? clean
                : clean.substring(0, MAX_SAFE_SKU_LENGTH);
    }
}
