package com.alsorg.packing.hrflow.exception;

import org.springframework.http.HttpStatus;

public class HrFlowException extends RuntimeException {

    private final HttpStatus status;

    public HrFlowException(
            HttpStatus status,
            String message
    ) {
        super(message);
        this.status = status == null
                ? HttpStatus.INTERNAL_SERVER_ERROR
                : status;
    }

    public HttpStatus getStatus() {
        return status;
    }

    public static HrFlowException badRequest(String message) {
        return new HrFlowException(HttpStatus.BAD_REQUEST, message);
    }

    public static HrFlowException forbidden(String message) {
        return new HrFlowException(HttpStatus.FORBIDDEN, message);
    }

    public static HrFlowException notFound(String message) {
        return new HrFlowException(HttpStatus.NOT_FOUND, message);
    }

    public static HrFlowException conflict(String message) {
        return new HrFlowException(HttpStatus.CONFLICT, message);
    }
}
