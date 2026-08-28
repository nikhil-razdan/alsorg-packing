package com.alsorg.packing.exception;

import com.alsorg.packing.config.TimeZoneConfig;
import com.alsorg.packing.controller.dto.matflow.MatFlowApiError;

import jakarta.persistence.OptimisticLockException;
import jakarta.servlet.http.HttpServletRequest;
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
import org.springframework.security.access.AccessDeniedException;
import org.springframework.validation.BindException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.server.ResponseStatusException;

/**
 * MatFlow-specific API error boundary.
 *
 * Database/vendor exception text is never returned to the browser. Full causes
 * remain in structured server logs correlated by X-Request-ID/MDC requestId.
 */
@RestControllerAdvice(basePackages = "com.alsorg.packing.controller.matflow")
@Order(Ordered.HIGHEST_PRECEDENCE)
public class MatFlowExceptionHandler {

    private static final Logger LOGGER = LoggerFactory.getLogger(
            MatFlowExceptionHandler.class);

    private static final int MAX_VALIDATION_ERRORS = 25;

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<MatFlowApiError> handleTypeMismatch(
            MethodArgumentTypeMismatchException exception,
            HttpServletRequest request) {
        String parameter = exception.getName();

        return response(
                HttpStatus.BAD_REQUEST,
                "Invalid value supplied for request parameter: " + parameter,
                request,
                detailsWithRequestId(Map.of(
                        "type", "INVALID_PARAMETER",
                        "parameter", parameter)));
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<MatFlowApiError> handleMissingParameter(
            MissingServletRequestParameterException exception,
            HttpServletRequest request) {
        return response(
                HttpStatus.BAD_REQUEST,
                "Required request parameter is missing: " + exception.getParameterName(),
                request,
                detailsWithRequestId(Map.of(
                        "type", "MISSING_PARAMETER",
                        "parameter", exception.getParameterName())));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<MatFlowApiError> handleValidation(
            MethodArgumentNotValidException exception,
            HttpServletRequest request) {

        Map<String, String> fields = exception.getBindingResult()
                .getFieldErrors()
                .stream()
                .limit(MAX_VALIDATION_ERRORS)
                .collect(Collectors.toMap(
                        error -> error.getField(),
                        error -> safeMessage(error.getDefaultMessage(), "Invalid value"),
                        (first, ignored) -> first,
                        LinkedHashMap::new));

        return response(
                HttpStatus.BAD_REQUEST,
                "MatFlow request validation failed.",
                request,
                detailsWithRequestId(Map.of(
                        "type", "VALIDATION_ERROR",
                        "fields", fields)));
    }

    @ExceptionHandler(BindException.class)
    public ResponseEntity<MatFlowApiError> handleBind(
            BindException exception,
            HttpServletRequest request) {

        Map<String, String> fields = exception.getBindingResult()
                .getFieldErrors()
                .stream()
                .limit(MAX_VALIDATION_ERRORS)
                .collect(Collectors.toMap(
                        error -> error.getField(),
                        error -> safeMessage(error.getDefaultMessage(), "Invalid value"),
                        (first, ignored) -> first,
                        LinkedHashMap::new));

        return response(
                HttpStatus.BAD_REQUEST,
                "MatFlow request binding failed.",
                request,
                detailsWithRequestId(Map.of(
                        "type", "BINDING_ERROR",
                        "fields", fields)));
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<MatFlowApiError> handleConstraintViolation(
            ConstraintViolationException exception,
            HttpServletRequest request) {

        Map<String, String> fields = exception.getConstraintViolations()
                .stream()
                .limit(MAX_VALIDATION_ERRORS)
                .collect(Collectors.toMap(
                        violation -> violation.getPropertyPath().toString(),
                        violation -> safeMessage(violation.getMessage(), "Invalid value"),
                        (first, ignored) -> first,
                        LinkedHashMap::new));

        return response(
                HttpStatus.BAD_REQUEST,
                "MatFlow request validation failed.",
                request,
                detailsWithRequestId(Map.of(
                        "type", "CONSTRAINT_VIOLATION",
                        "fields", fields)));
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<MatFlowApiError> handleResponseStatus(
            ResponseStatusException exception,
            HttpServletRequest request) {
        HttpStatus status = HttpStatus.resolve(
                exception.getStatusCode().value());

        if (status == null) {
            status = HttpStatus.INTERNAL_SERVER_ERROR;
        }

        return response(
                status,
                safeMessage(exception.getReason(), status.getReasonPhrase()),
                request,
                detailsWithRequestId(Map.of()));
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<MatFlowApiError> handleAccessDenied(
            AccessDeniedException exception,
            HttpServletRequest request) {
        return response(
                HttpStatus.FORBIDDEN,
                "MatFlow access denied.",
                request,
                detailsWithRequestId(Map.of("type", "ACCESS_DENIED")));
    }

    @ExceptionHandler({
            ObjectOptimisticLockingFailureException.class,
            OptimisticLockException.class
    })
    public ResponseEntity<MatFlowApiError> handleOptimisticLock(
            Exception exception,
            HttpServletRequest request) {
        return response(
                HttpStatus.CONFLICT,
                "The record was modified by another user. Refresh and retry.",
                request,
                detailsWithRequestId(Map.of("type", "OPTIMISTIC_LOCK")));
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<MatFlowApiError> handleDataIntegrity(
            DataIntegrityViolationException exception,
            HttpServletRequest request) {
        LOGGER.warn(
                "MatFlow data integrity violation: requestId={}, method={}, path={}",
                requestId(),
                request.getMethod(),
                request.getRequestURI(),
                exception);

        return response(
                HttpStatus.CONFLICT,
                "The operation violates a MatFlow data constraint.",
                request,
                detailsWithRequestId(Map.of("type", "DATA_INTEGRITY")));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<MatFlowApiError> handleUnreadableRequest(
            HttpMessageNotReadableException exception,
            HttpServletRequest request) {
        return response(
                HttpStatus.BAD_REQUEST,
                "The request body is missing or contains an invalid value.",
                request,
                detailsWithRequestId(Map.of("type", "INVALID_REQUEST_BODY")));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<MatFlowApiError> handleIllegalArgument(
            IllegalArgumentException exception,
            HttpServletRequest request) {
        return response(
                HttpStatus.BAD_REQUEST,
                safeMessage(exception.getMessage(), "Invalid MatFlow request."),
                request,
                detailsWithRequestId(Map.of("type", "INVALID_ARGUMENT")));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<MatFlowApiError> handleUnexpected(
            Exception exception,
            HttpServletRequest request) {
        LOGGER.error(
                "Unexpected MatFlow failure: requestId={}, method={}, path={}",
                requestId(),
                request.getMethod(),
                request.getRequestURI(),
                exception);

        return response(
                HttpStatus.INTERNAL_SERVER_ERROR,
                "An unexpected MatFlow error occurred.",
                request,
                detailsWithRequestId(Map.of("type", "INTERNAL_ERROR")));
    }

    private ResponseEntity<MatFlowApiError> response(
            HttpStatus status,
            String message,
            HttpServletRequest request,
            Map<String, Object> details) {

        MatFlowApiError body = new MatFlowApiError(
                LocalDateTime.now(TimeZoneConfig.APP_ZONE),
                status.value(),
                status.getReasonPhrase(),
                safeMessage(message, status.getReasonPhrase()),
                request == null ? "" : request.getRequestURI(),
                details == null ? Map.of() : details);

        return ResponseEntity
                .status(status)
                .body(body);
    }

    private Map<String, Object> detailsWithRequestId(
            Map<String, Object> source) {
        Map<String, Object> details = new LinkedHashMap<>();
        if (source != null) {
            details.putAll(source);
        }

        String requestId = requestId();
        if (requestId != null) {
            details.put("requestId", requestId);
        }

        return details;
    }

    private String requestId() {
        String value = MDC.get("requestId");
        return value == null || value.isBlank()
                ? null
                : value;
    }

    private String safeMessage(
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
