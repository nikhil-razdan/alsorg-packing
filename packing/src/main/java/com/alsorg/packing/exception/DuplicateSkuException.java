package com.alsorg.packing.exception;

public class DuplicateSkuException extends RuntimeException {

    public DuplicateSkuException(String sku) {
        super(
                "Duplicate SKU found: "
                        + sku
                        + ". This SKU already exists. Please change packet number, PD No, or Drawing No."
        );
    }
}