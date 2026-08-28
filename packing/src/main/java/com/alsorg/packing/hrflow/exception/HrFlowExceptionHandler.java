package com.alsorg.packing.hrflow.exception;

import jakarta.persistence.OptimisticLockException;
import jakarta.validation.ConstraintViolationException;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.validation.BindException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

@RestControllerAdvice(basePackages = "com.alsorg.packing.hrflow")
public class HrFlowExceptionHandler {

    @ExceptionHandler(HrFlowException.class)
    public ResponseEntity<Map<String, Object>> handleHrFlow(
            HrFlowException ex
    ) {
        return response(
                ex.getStatus(),
                ex.getMessage(),
                null
        );
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(
            MethodArgumentNotValidException ex
    ) {
        Map<String, String> fields = new LinkedHashMap<>();

        ex.getBindingResult()
                .getFieldErrors()
                .forEach(error ->
                        fields.putIfAbsent(
                                error.getField(),
                                safeValidationMessage(error.getDefaultMessage())
                        )
                );

        return response(
                HttpStatus.BAD_REQUEST,
                "Validation failed",
                fields
        );
    }

    @ExceptionHandler(BindException.class)
    public ResponseEntity<Map<String, Object>> handleBind(
            BindException ex
    ) {
        Map<String, String> fields = new LinkedHashMap<>();

        ex.getBindingResult()
                .getFieldErrors()
                .forEach(error ->
                        fields.putIfAbsent(
                                error.getField(),
                                safeValidationMessage(error.getDefaultMessage())
                        )
                );

        return response(
                HttpStatus.BAD_REQUEST,
                "Validation failed",
                fields
        );
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<Map<String, Object>> handleConstraintViolation(
            ConstraintViolationException ex
    ) {
        Map<String, String> fields = new LinkedHashMap<>();

        ex.getConstraintViolations().forEach(violation ->
                fields.putIfAbsent(
                        String.valueOf(violation.getPropertyPath()),
                        safeValidationMessage(violation.getMessage())
                )
        );

        return response(
                HttpStatus.BAD_REQUEST,
                "Validation failed",
                fields
        );
    }

    @ExceptionHandler({
            HttpMessageNotReadableException.class,
            MissingServletRequestParameterException.class,
            MethodArgumentTypeMismatchException.class
    })
    public ResponseEntity<Map<String, Object>> handleBadInput(
            Exception ex
    ) {
        return response(
                HttpStatus.BAD_REQUEST,
                "The HRFLOW request is invalid.",
                null
        );
    }

    @ExceptionHandler({
            ObjectOptimisticLockingFailureException.class,
            OptimisticLockException.class
    })
    public ResponseEntity<Map<String, Object>> handleOptimisticLock(
            Exception ex
    ) {
        return response(
                HttpStatus.CONFLICT,
                "This HRFLOW record changed after it was opened. Refresh and try again.",
                null
        );
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<Map<String, Object>> handleIntegrity(
            DataIntegrityViolationException ex
    ) {
        return response(
                HttpStatus.CONFLICT,
                "The requested HRFLOW change conflicts with existing data.",
                null
        );
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<Map<String, Object>> handleMaxUpload(
            MaxUploadSizeExceededException ex
    ) {
        return response(
                HttpStatus.PAYLOAD_TOO_LARGE,
                "The uploaded HRFLOW document is too large.",
                null
        );
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Map<String, Object>> handleAccessDenied(
            AccessDeniedException ex
    ) {
        return response(
                HttpStatus.FORBIDDEN,
                "You do not have permission for this HRFLOW operation.",
                null
        );
    }

    private ResponseEntity<Map<String, Object>> response(
            HttpStatus status,
            String message,
            Map<String, String> fields
    ) {
        Map<String, Object> body = error(
                status.value(),
                message
        );

        if (fields != null && !fields.isEmpty()) {
            body.put("fields", fields);
        }

        return ResponseEntity
                .status(status)
                .cacheControl(CacheControl.noStore())
                .body(body);
    }

    private Map<String, Object> error(
            int status,
            String message
    ) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("timestamp", LocalDateTime.now());
        body.put("status", status);
        body.put(
                "message",
                message == null || message.isBlank()
                        ? "HRFLOW request failed."
                        : message
        );
        return body;
    }

    private String safeValidationMessage(
            String value
    ) {
        if (value == null || value.isBlank()) {
            return "Invalid value";
        }

        String clean = value
                .replace('\r', ' ')
                .replace('\n', ' ')
                .trim();

        return clean.length() > 300
                ? clean.substring(0, 300)
                : clean;
    }
}
