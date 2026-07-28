package com.alsorg.packing.exception;

import com.alsorg.packing.controller.dto.matflow.MatFlowApiError;

import jakarta.persistence.OptimisticLockException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.ConstraintViolationException;

import java.util.LinkedHashMap;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import org.springframework.orm.ObjectOptimisticLockingFailureException;

import org.springframework.validation.FieldError;

import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import org.springframework.web.server.ResponseStatusException;

/**
 * Converts MatFlow business and validation failures into stable API responses.
 *
 * This advice is intentionally limited to MatFlow controllers so existing
 * PackFlow and BOMFlow error behaviour is not unexpectedly changed.
 *
 * Confirm that your MatFlow controllers are under:
 * com.alsorg.packing.controller.matflow
 *
 * If your actual package differs, update basePackages accordingly.
 */
@RestControllerAdvice(basePackages = "com.alsorg.packing.controller.matflow")
public class MatFlowApiExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(MatFlowApiExceptionHandler.class);

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<MatFlowApiError> handleResponseStatus(
            ResponseStatusException exception,
            HttpServletRequest request) {
        HttpStatus status = HttpStatus.resolve(
                exception.getStatusCode().value());

        if (status == null) {
            status = HttpStatus.INTERNAL_SERVER_ERROR;
        }

        String message = exception.getReason();

        if (message == null || message.isBlank()) {
            message = status.getReasonPhrase();
        }

        return ResponseEntity
                .status(status)
                .body(
                        MatFlowApiError.of(
                                status.value(),
                                status.getReasonPhrase(),
                                message,
                                request.getRequestURI()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<MatFlowApiError> handleMethodArgumentNotValid(
            MethodArgumentNotValidException exception,
            HttpServletRequest request) {
        Map<String, String> validationErrors = new LinkedHashMap<>();

        for (FieldError fieldError : exception.getBindingResult().getFieldErrors()) {

            validationErrors.putIfAbsent(
                    fieldError.getField(),
                    fieldError.getDefaultMessage() == null
                            ? "Invalid value."
                            : fieldError.getDefaultMessage());
        }

        return ResponseEntity
                .badRequest()
                .body(
                        MatFlowApiError.validation(
                                HttpStatus.BAD_REQUEST.value(),
                                HttpStatus.BAD_REQUEST.getReasonPhrase(),
                                "MatFlow request validation failed.",
                                request.getRequestURI(),
                                validationErrors));
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<MatFlowApiError> handleConstraintViolation(
            ConstraintViolationException exception,
            HttpServletRequest request) {
        Map<String, String> validationErrors = new LinkedHashMap<>();

        for (ConstraintViolation<?> violation : exception.getConstraintViolations()) {

            validationErrors.put(
                    violation.getPropertyPath().toString(),
                    violation.getMessage());
        }

        return ResponseEntity
                .badRequest()
                .body(
                        MatFlowApiError.validation(
                                HttpStatus.BAD_REQUEST.value(),
                                HttpStatus.BAD_REQUEST.getReasonPhrase(),
                                "MatFlow request validation failed.",
                                request.getRequestURI(),
                                validationErrors));
    }

    @ExceptionHandler({
            ObjectOptimisticLockingFailureException.class,
            OptimisticLockException.class
    })
    public ResponseEntity<MatFlowApiError> handleOptimisticLock(
            Exception exception,
            HttpServletRequest request) {
        log.warn(
                "MatFlow optimistic locking conflict at {}: {}",
                request.getRequestURI(),
                exception.getMessage());

        return ResponseEntity
                .status(HttpStatus.CONFLICT)
                .body(
                        MatFlowApiError.of(
                                HttpStatus.CONFLICT.value(),
                                HttpStatus.CONFLICT.getReasonPhrase(),
                                "This MatFlow record was updated by another user. Refresh the page and try again.",
                                request.getRequestURI()));
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<MatFlowApiError> handleDataIntegrity(
            DataIntegrityViolationException exception,
            HttpServletRequest request) {
        log.error(
                "MatFlow database integrity failure at {}",
                request.getRequestURI(),
                exception);

        return ResponseEntity
                .status(HttpStatus.CONFLICT)
                .body(
                        MatFlowApiError.of(
                                HttpStatus.CONFLICT.value(),
                                HttpStatus.CONFLICT.getReasonPhrase(),
                                "The MatFlow operation conflicts with existing workflow or database data.",
                                request.getRequestURI()));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<MatFlowApiError> handleIllegalArgument(
            IllegalArgumentException exception,
            HttpServletRequest request) {
        return ResponseEntity
                .badRequest()
                .body(
                        MatFlowApiError.of(
                                HttpStatus.BAD_REQUEST.value(),
                                HttpStatus.BAD_REQUEST.getReasonPhrase(),
                                safeMessage(
                                        exception,
                                        "Invalid MatFlow request."),
                                request.getRequestURI()));
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<MatFlowApiError> handleIllegalState(
            IllegalStateException exception,
            HttpServletRequest request) {
        return ResponseEntity
                .status(HttpStatus.CONFLICT)
                .body(
                        MatFlowApiError.of(
                                HttpStatus.CONFLICT.value(),
                                HttpStatus.CONFLICT.getReasonPhrase(),
                                safeMessage(
                                        exception,
                                        "The requested MatFlow action is not allowed in the current workflow state."),
                                request.getRequestURI()));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<MatFlowApiError> handleUnexpectedException(
            Exception exception,
            HttpServletRequest request) {
        log.error(
                "Unexpected MatFlow error at {}",
                request.getRequestURI(),
                exception);

        return ResponseEntity
                .status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(
                        MatFlowApiError.of(
                                HttpStatus.INTERNAL_SERVER_ERROR.value(),
                                HttpStatus.INTERNAL_SERVER_ERROR.getReasonPhrase(),
                                "An unexpected MatFlow server error occurred. Check the backend logs using the request path and timestamp.",
                                request.getRequestURI()));
    }

    private String safeMessage(
            Exception exception,
            String fallback) {
        String message = exception.getMessage();

        return message == null || message.isBlank()
                ? fallback
                : message;
    }
}