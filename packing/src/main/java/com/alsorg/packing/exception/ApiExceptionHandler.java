package com.alsorg.packing.exception;

import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(DuplicateSkuException.class)
    public ResponseEntity<?> handleDuplicateSku(DuplicateSkuException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(
                        Map.of(
                                "type", "DUPLICATE_SKU",
                                "message", ex.getMessage()
                        )
                );
    }
}