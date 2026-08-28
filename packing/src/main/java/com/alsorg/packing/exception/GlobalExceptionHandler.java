package com.alsorg.packing.exception;

import com.alsorg.packing.config.TimeZoneConfig;

import jakarta.persistence.OptimisticLockException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.ConstraintViolationException;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;

import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.orm.jpa.JpaSystemException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.validation.BindException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.server.ResponseStatusException;

/**
 * Fallback JSON error boundary for non-MatFlow REST controllers.
 *
 * MatFlow owns a more specific advice with higher precedence. This handler keeps
 * the long-standing timestamp/status/error/message response keys while adding
 * safe path/request-id diagnostics for support.
 */
@RestControllerAdvice
@Order(Ordered.LOWEST_PRECEDENCE)
public class GlobalExceptionHandler {

    private static final Logger LOGGER = LoggerFactory.getLogger(
            GlobalExceptionHandler.class);

    private static final int MAX_VALIDATION_ERRORS = 25;

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, Object>> handleResponseStatusException(
            ResponseStatusException exception,
            HttpServletRequest request) {

        HttpStatus status = HttpStatus.resolve(
                exception.getStatusCode().value());

        if (status == null) {
            status = HttpStatus.INTERNAL_SERVER_ERROR;
        }

        String message = cleanMessage(
                exception.getReason(),
                status.getReasonPhrase());

        return buildResponse(
                status,
                message,
                request,
                Map.of());
    }

    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<Map<String, Object>> handleAuthentication(
            AuthenticationException exception,
            HttpServletRequest request) {
        return buildResponse(
                HttpStatus.UNAUTHORIZED,
                "Authentication is required",
                request,
                Map.of());
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Map<String, Object>> handleAccessDenied(
            AccessDeniedException exception,
            HttpServletRequest request) {
        return buildResponse(
                HttpStatus.FORBIDDEN,
                "Access denied",
                request,
                Map.of());
    }

    @ExceptionHandler(DuplicateSkuException.class)
    public ResponseEntity<Map<String, Object>> handleDuplicateSku(
            DuplicateSkuException exception,
            HttpServletRequest request) {
        return buildResponse(
                HttpStatus.CONFLICT,
                exception.getMessage(),
                request,
                Map.of(
                        "type", "DUPLICATE_SKU",
                        "sku", exception.getSku()));
    }

    @ExceptionHandler({
            ObjectOptimisticLockingFailureException.class,
            OptimisticLockException.class
    })
    public ResponseEntity<Map<String, Object>> handleOptimisticLock(
            Exception exception,
            HttpServletRequest request) {
        return buildResponse(
                HttpStatus.CONFLICT,
                "The record was modified by another user. Refresh and retry.",
                request,
                Map.of("type", "OPTIMISTIC_LOCK"));
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<Map<String, Object>> handleDataIntegrityViolation(
            DataIntegrityViolationException exception,
            HttpServletRequest request) {

        LOGGER.warn(
                "Database constraint blocked request: requestId={}, method={}, path={}",
                requestId(),
                request.getMethod(),
                request.getRequestURI());

        return buildResponse(
                HttpStatus.CONFLICT,
                "The action was blocked by a linked or duplicate database record",
                request,
                Map.of("type", "DATA_INTEGRITY"));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleMethodArgumentNotValid(
            MethodArgumentNotValidException exception,
            HttpServletRequest request) {

        Map<String, String> fields = exception.getBindingResult()
                .getFieldErrors()
                .stream()
                .limit(MAX_VALIDATION_ERRORS)
                .collect(Collectors.toMap(
                        error -> error.getField(),
                        error -> cleanMessage(
                                error.getDefaultMessage(),
                                "Invalid value"),
                        (first, ignored) -> first,
                        LinkedHashMap::new));

        return buildResponse(
                HttpStatus.BAD_REQUEST,
                "Request validation failed",
                request,
                Map.of(
                        "type", "VALIDATION_ERROR",
                        "fields", fields));
    }

    @ExceptionHandler(BindException.class)
    public ResponseEntity<Map<String, Object>> handleBindException(
            BindException exception,
            HttpServletRequest request) {

        Map<String, String> fields = exception.getBindingResult()
                .getFieldErrors()
                .stream()
                .limit(MAX_VALIDATION_ERRORS)
                .collect(Collectors.toMap(
                        error -> error.getField(),
                        error -> cleanMessage(
                                error.getDefaultMessage(),
                                "Invalid value"),
                        (first, ignored) -> first,
                        LinkedHashMap::new));

        return buildResponse(
                HttpStatus.BAD_REQUEST,
                "Request binding failed",
                request,
                Map.of(
                        "type", "BINDING_ERROR",
                        "fields", fields));
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<Map<String, Object>> handleConstraintViolation(
            ConstraintViolationException exception,
            HttpServletRequest request) {

        Map<String, String> fields = exception.getConstraintViolations()
                .stream()
                .limit(MAX_VALIDATION_ERRORS)
                .collect(Collectors.toMap(
                        violation -> violation.getPropertyPath().toString(),
                        violation -> cleanMessage(
                                violation.getMessage(),
                                "Invalid value"),
                        (first, ignored) -> first,
                        LinkedHashMap::new));

        return buildResponse(
                HttpStatus.BAD_REQUEST,
                "Request validation failed",
                request,
                Map.of(
                        "type", "CONSTRAINT_VIOLATION",
                        "fields", fields));
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<Map<String, Object>> handleTypeMismatch(
            MethodArgumentTypeMismatchException exception,
            HttpServletRequest request) {
        return buildResponse(
                HttpStatus.BAD_REQUEST,
                "Invalid value supplied for request parameter: " + exception.getName(),
                request,
                Map.of(
                        "type", "INVALID_PARAMETER",
                        "parameter", exception.getName()));
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<Map<String, Object>> handleMissingParameter(
            MissingServletRequestParameterException exception,
            HttpServletRequest request) {
        return buildResponse(
                HttpStatus.BAD_REQUEST,
                "Required request parameter is missing: " + exception.getParameterName(),
                request,
                Map.of(
                        "type", "MISSING_PARAMETER",
                        "parameter", exception.getParameterName()));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<Map<String, Object>> handleUnreadableRequest(
            HttpMessageNotReadableException exception,
            HttpServletRequest request) {
        return buildResponse(
                HttpStatus.BAD_REQUEST,
                "The request body is missing or contains an invalid value",
                request,
                Map.of("type", "INVALID_REQUEST_BODY"));
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<Map<String, Object>> handleMaxUploadSize(
            MaxUploadSizeExceededException exception,
            HttpServletRequest request) {
        return buildResponse(
                HttpStatus.PAYLOAD_TOO_LARGE,
                "Uploaded file is larger than the server limit",
                request,
                Map.of("type", "UPLOAD_TOO_LARGE"));
    }

    @ExceptionHandler(JpaSystemException.class)
    public ResponseEntity<Map<String, Object>> handleJpaSystemException(
            JpaSystemException exception,
            HttpServletRequest request) {

        LOGGER.error(
                "Database operation failed: requestId={}, method={}, path={}",
                requestId(),
                request.getMethod(),
                request.getRequestURI(),
                exception);

        return buildResponse(
                HttpStatus.INTERNAL_SERVER_ERROR,
                "A database operation failed",
                request,
                Map.of("type", "DATABASE_ERROR"));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleUnexpectedException(
            Exception exception,
            HttpServletRequest request) {

        LOGGER.error(
                "Unexpected request failure: requestId={}, method={}, path={}",
                requestId(),
                request.getMethod(),
                request.getRequestURI(),
                exception);

        return buildResponse(
                HttpStatus.INTERNAL_SERVER_ERROR,
                "An unexpected server error occurred",
                request,
                Map.of("type", "INTERNAL_ERROR"));
    }

    private ResponseEntity<Map<String, Object>> buildResponse(
            HttpStatus status,
            String message,
            HttpServletRequest request,
            Map<String, Object> details) {

        Map<String, Object> body = new LinkedHashMap<>();

        body.put(
                "timestamp",
                LocalDateTime.now(TimeZoneConfig.APP_ZONE));
        body.put("status", status.value());
        body.put("error", status.getReasonPhrase());
        body.put(
                "message",
                cleanMessage(message, status.getReasonPhrase()));

        if (request != null) {
            body.put("path", request.getRequestURI());
        }

        String requestId = requestId();
        if (requestId != null) {
            body.put("requestId", requestId);
        }

        if (details != null && !details.isEmpty()) {
            body.put("details", details);
        }

        return ResponseEntity
                .status(status)
                .body(body);
    }

    private String requestId() {
        String value = MDC.get("requestId");
        if (value == null || value.isBlank()) {
            return null;
        }
        return value;
    }

    private String cleanMessage(
            String value,
            String fallback) {
        if (value == null || value.isBlank()) {
            return fallback;
        }

        String clean = value
                .replace('\r', ' ')
                .replace('\n', ' ')
                .trim();

        return clean.length() <= 1000
                ? clean
                : clean.substring(0, 1000);
    }
}
