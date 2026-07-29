package com.alsorg.packing.exception;

import com.alsorg.packing.controller.dto.matflow.MatFlowApiError;

import jakarta.persistence.OptimisticLockException;
import jakarta.servlet.http.HttpServletRequest;

import java.time.LocalDateTime;
import java.util.Map;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import org.springframework.dao.DataIntegrityViolationException;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import org.springframework.http.converter.HttpMessageNotReadableException;

import org.springframework.orm.ObjectOptimisticLockingFailureException;

import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice(basePackages = "com.alsorg.packing.controller.matflow")
public class MatFlowExceptionHandler {

    private static final Logger LOGGER = LoggerFactory.getLogger(
            MatFlowExceptionHandler.class);

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<MatFlowApiError> handleTypeMismatch(
            MethodArgumentTypeMismatchException exception,
            HttpServletRequest request) {
        String parameter = exception.getName();

        Object rejectedValue = exception.getValue();

        return response(
                HttpStatus.BAD_REQUEST,
                "Invalid value supplied for request parameter: " +
                        parameter,
                request,
                Map.of(
                        "type",
                        "INVALID_PARAMETER",
                        "parameter",
                        parameter,
                        "rejectedValue",
                        rejectedValue == null
                                ? ""
                                : rejectedValue.toString()));
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<MatFlowApiError> handleMissingParameter(
            MissingServletRequestParameterException exception,
            HttpServletRequest request) {
        return response(
                HttpStatus.BAD_REQUEST,
                "Required request parameter is missing: " +
                        exception.getParameterName(),
                request,
                Map.of(
                        "type",
                        "MISSING_PARAMETER",
                        "parameter",
                        exception.getParameterName()));
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<MatFlowApiError> handleResponseStatus(
            ResponseStatusException exception,
            HttpServletRequest request) {
        int statusCode = exception.getStatusCode()
                .value();

        HttpStatus status = HttpStatus.resolve(statusCode);

        if (status == null) {
            status = HttpStatus.INTERNAL_SERVER_ERROR;
        }

        String message = exception.getReason() == null ||
                exception.getReason().isBlank()
                        ? status.getReasonPhrase()
                        : exception.getReason();

        return response(
                status,
                message,
                request,
                Map.of());
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
                Map.of(
                        "type",
                        "OPTIMISTIC_LOCK"));
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<MatFlowApiError> handleDataIntegrity(
            DataIntegrityViolationException exception,
            HttpServletRequest request) {
        LOGGER.warn(
                "MatFlow data integrity violation at {}",
                request.getRequestURI(),
                exception);

        return response(
                HttpStatus.CONFLICT,
                "The operation violates a MatFlow data constraint.",
                request,
                Map.of(
                        "type",
                        "DATA_INTEGRITY",
                        "cause",
                        safeRootCause(exception)));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<MatFlowApiError> handleUnreadableRequest(
            HttpMessageNotReadableException exception,
            HttpServletRequest request) {
        return response(
                HttpStatus.BAD_REQUEST,
                "The request body is missing or contains an invalid value.",
                request,
                Map.of(
                        "type",
                        "INVALID_REQUEST_BODY"));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<MatFlowApiError> handleIllegalArgument(
            IllegalArgumentException exception,
            HttpServletRequest request) {
        return response(
                HttpStatus.BAD_REQUEST,
                exception.getMessage() == null
                        ? "Invalid MatFlow request."
                        : exception.getMessage(),
                request,
                Map.of(
                        "type",
                        "INVALID_ARGUMENT"));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<MatFlowApiError> handleUnexpected(
            Exception exception,
            HttpServletRequest request) {
        LOGGER.error(
                "Unexpected MatFlow failure at {}",
                request.getRequestURI(),
                exception);

        return response(
                HttpStatus.INTERNAL_SERVER_ERROR,
                "An unexpected MatFlow error occurred.",
                request,
                Map.of(
                        "type",
                        "INTERNAL_ERROR"));
    }

    private ResponseEntity<MatFlowApiError> response(
            HttpStatus status,
            String message,
            HttpServletRequest request,
            Map<String, Object> details) {
        MatFlowApiError body = new MatFlowApiError(
                LocalDateTime.now(),
                status.value(),
                status.getReasonPhrase(),
                message,
                request.getRequestURI(),
                details == null
                        ? Map.of()
                        : details);

        return ResponseEntity
                .status(status)
                .body(body);
    }

    private String safeRootCause(
            Throwable throwable) {
        Throwable current = throwable;

        while (current.getCause() != null &&
                current.getCause() != current) {
            current = current.getCause();
        }

        String message = current.getMessage();

        if (message == null ||
                message.isBlank()) {
            return current
                    .getClass()
                    .getSimpleName();
        }

        return message.length() > 500
                ? message.substring(0, 500)
                : message;
    }
}