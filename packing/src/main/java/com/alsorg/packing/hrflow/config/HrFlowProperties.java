package com.alsorg.packing.hrflow.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "hrflow")
public class HrFlowProperties {

    private int candidateLinkExpiryDays = 14;
    private int onboardingLinkExpiryDays = 90;
    private String candidateNumberPrefix = "CAND";
    private String employeeCodePrefix = "AL";
    private long maxDocumentBytes = 10L * 1024L * 1024L;

    public int getCandidateLinkExpiryDays() {
        return candidateLinkExpiryDays;
    }

    public void setCandidateLinkExpiryDays(int candidateLinkExpiryDays) {
        this.candidateLinkExpiryDays = candidateLinkExpiryDays;
    }

    public int getOnboardingLinkExpiryDays() {
        return onboardingLinkExpiryDays;
    }

    public void setOnboardingLinkExpiryDays(int onboardingLinkExpiryDays) {
        this.onboardingLinkExpiryDays = onboardingLinkExpiryDays;
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
        this.maxDocumentBytes = maxDocumentBytes;
    }
}
