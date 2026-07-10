package com.alsorg.packing.exception;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.orm.jpa.JpaSystemException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, Object>>
    handleResponseStatusException(
            ResponseStatusException exception
    ) {
        HttpStatus status =
                HttpStatus.valueOf(
                        exception.getStatusCode().value()
                );

        return buildResponse(
                status,
                exception.getReason()
        );
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Map<String, Object>>
    handleAccessDenied(
            AccessDeniedException exception
    ) {
        return buildResponse(
                HttpStatus.FORBIDDEN,
                exception.getMessage()
        );
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<Map<String, Object>>
    handleDataIntegrityViolation(
            DataIntegrityViolationException exception
    ) {
        return buildResponse(
                HttpStatus.CONFLICT,
                "The action was blocked by a linked database record"
        );
    }

    @ExceptionHandler(JpaSystemException.class)
    public ResponseEntity<Map<String, Object>>
    handleJpaSystemException(
            JpaSystemException exception
    ) {
        exception.printStackTrace();

        return buildResponse(
                HttpStatus.INTERNAL_SERVER_ERROR,
                "A database operation failed"
        );
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>>
    handleUnexpectedException(
            Exception exception
    ) {
        exception.printStackTrace();

        return buildResponse(
                HttpStatus.INTERNAL_SERVER_ERROR,
                "An unexpected server error occurred"
        );
    }

    private ResponseEntity<Map<String, Object>>
    buildResponse(
            HttpStatus status,
            String message
    ) {
        Map<String, Object> body =
                new LinkedHashMap<>();

        body.put(
                "timestamp",
                LocalDateTime.now()
        );

        body.put(
                "status",
                status.value()
        );

        body.put(
                "error",
                status.getReasonPhrase()
        );

        body.put(
                "message",
                message == null
                        ? status.getReasonPhrase()
                        : message
        );

        return ResponseEntity
                .status(status)
                .body(body);
    }
}