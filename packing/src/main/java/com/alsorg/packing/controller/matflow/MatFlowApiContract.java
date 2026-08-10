package com.alsorg.packing.controller.matflow;

/**
 * Canonical MatFlow API contract after the Project -> Products vNext refactor.
 */
public final class MatFlowApiContract {
    public static final String API_VERSION = "3";
    public static final String API_VERSION_HEADER = "X-MatFlow-Api-Version";
    public static final String REQUEST_ID_HEADER = "X-Request-Id";

    private MatFlowApiContract() {
    }
}
