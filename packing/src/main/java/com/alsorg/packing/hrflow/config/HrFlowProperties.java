package com.alsorg.packing.hrflow.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * HRFlow runtime settings.
 *
 * The setters keep configuration values inside defensive operational bounds so a
 * typo in an environment variable cannot silently create effectively permanent
 * public links or allow unexpectedly large in-database document payloads.
 * Existing defaults and property names are unchanged.
 */
@Component
@ConfigurationProperties(prefix = "hrflow")
public class HrFlowProperties {

    private static final int MIN_LINK_EXPIRY_DAYS = 1;
    private static final int MAX_CANDIDATE_LINK_EXPIRY_DAYS = 365;
    private static final int MAX_ONBOARDING_LINK_EXPIRY_DAYS = 730;

    private static final long MIN_DOCUMENT_BYTES = 1L;
    private static final long MAX_DOCUMENT_BYTES = 50L * 1024L * 1024L;

    private int candidateLinkExpiryDays = 14;
    private int onboardingLinkExpiryDays = 90;
    private String candidateNumberPrefix = "CAND";
    private String employeeCodePrefix = "AL";
    private long maxDocumentBytes = 10L * 1024L * 1024L;

    public int getCandidateLinkExpiryDays() {
        return candidateLinkExpiryDays;
    }

    public void setCandidateLinkExpiryDays(int candidateLinkExpiryDays) {
        this.candidateLinkExpiryDays = clamp(
                candidateLinkExpiryDays,
                MIN_LINK_EXPIRY_DAYS,
                MAX_CANDIDATE_LINK_EXPIRY_DAYS);
    }

    public int getOnboardingLinkExpiryDays() {
        return onboardingLinkExpiryDays;
    }

    public void setOnboardingLinkExpiryDays(int onboardingLinkExpiryDays) {
        this.onboardingLinkExpiryDays = clamp(
                onboardingLinkExpiryDays,
                MIN_LINK_EXPIRY_DAYS,
                MAX_ONBOARDING_LINK_EXPIRY_DAYS);
    }

    public String getCandidateNumberPrefix() {
        return candidateNumberPrefix;
    }

    public void setCandidateNumberPrefix(String candidateNumberPrefix) {
        this.candidateNumberPrefix = candidateNumberPrefix;
    }

    public String getEmployeeCodePrefix() {
        return employeeCodePrefix;
    }

    public void setEmployeeCodePrefix(String employeeCodePrefix) {
        this.employeeCodePrefix = employeeCodePrefix;
    }

    public long getMaxDocumentBytes() {
        return maxDocumentBytes;
    }

    public void setMaxDocumentBytes(long maxDocumentBytes) {
        this.maxDocumentBytes = clamp(
                maxDocumentBytes,
                MIN_DOCUMENT_BYTES,
                MAX_DOCUMENT_BYTES);
    }

    private int clamp(int value, int min, int max) {
        return Math.max(min, Math.min(value, max));
    }

    private long clamp(long value, long min, long max) {
        return Math.max(min, Math.min(value, max));
    }
}
