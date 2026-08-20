package com.alsorg.packing.hrflow.service;

import com.alsorg.packing.hrflow.config.HrFlowProperties;
import com.alsorg.packing.hrflow.domain.HrCandidate;
import com.alsorg.packing.hrflow.domain.HrCandidateAccessToken;
import com.alsorg.packing.hrflow.domain.HrTokenPurpose;
import com.alsorg.packing.hrflow.exception.HrFlowException;
import com.alsorg.packing.hrflow.repository.HrCandidateAccessTokenRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.HexFormat;

@Service
public class HrCandidateTokenService {

    private final HrCandidateAccessTokenRepository tokenRepository;
    private final HrFlowProperties properties;
    private final SecureRandom secureRandom = new SecureRandom();

    public HrCandidateTokenService(
            HrCandidateAccessTokenRepository tokenRepository,
            HrFlowProperties properties
    ) {
        this.tokenRepository = tokenRepository;
        this.properties = properties;
    }

    public record IssuedToken(String rawToken, LocalDateTime expiresAt) {}

    @Transactional
    public IssuedToken issueApplicationToken(HrCandidate candidate, String actor) {
        return issueToken(
                candidate,
                HrTokenPurpose.CANDIDATE_APPLICATION,
                Math.max(1, properties.getCandidateLinkExpiryDays()),
                actor
        );
    }

    @Transactional
    public IssuedToken issueOnboardingToken(HrCandidate candidate, String actor) {
        // Once the person has entered onboarding, the application link should no longer
        // remain an alternative long-lived route into the record.
        revokeActiveTokens(candidate, HrTokenPurpose.CANDIDATE_APPLICATION);

        return issueToken(
                candidate,
                HrTokenPurpose.ONBOARDING_PORTAL,
                Math.max(1, properties.getOnboardingLinkExpiryDays()),
                actor
        );
    }

    @Transactional
    public HrCandidate resolveApplicationToken(String rawToken) {
        return resolveToken(
                rawToken,
                HrTokenPurpose.CANDIDATE_APPLICATION,
                "Application link is invalid.",
                "This application link has been revoked.",
                "This application link has expired. Please contact HR for a new link."
        );
    }

    @Transactional
    public HrCandidate resolveOnboardingToken(String rawToken) {
        return resolveToken(
                rawToken,
                HrTokenPurpose.ONBOARDING_PORTAL,
                "Onboarding link is invalid.",
                "This onboarding link has been revoked.",
                "This onboarding link has expired. Please contact HR for a new link."
        );
    }

    /**
     * Used only for candidate-owned document upload/download routes. It accepts either
     * the application token or the later onboarding portal token, while the application
     * form itself still accepts only CANDIDATE_APPLICATION tokens.
     */
    @Transactional
    public HrCandidate resolvePublicCandidateToken(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            throw HrFlowException.notFound("Candidate link is invalid.");
        }

        String tokenHash = hash(rawToken);

        var onboarding = tokenRepository
                .findByTokenHashAndPurpose(tokenHash, HrTokenPurpose.ONBOARDING_PORTAL);
        if (onboarding.isPresent()) {
            return validateAndResolve(
                    onboarding.get(),
                    "This onboarding link has been revoked.",
                    "This onboarding link has expired. Please contact HR for a new link."
            );
        }

        var application = tokenRepository
                .findByTokenHashAndPurpose(tokenHash, HrTokenPurpose.CANDIDATE_APPLICATION);
        if (application.isPresent()) {
            return validateAndResolve(
                    application.get(),
                    "This application link has been revoked.",
                    "This application link has expired. Please contact HR for a new link."
            );
        }

        throw HrFlowException.notFound("Candidate link is invalid.");
    }

    private IssuedToken issueToken(
            HrCandidate candidate,
            HrTokenPurpose purpose,
            int expiryDays,
            String actor
    ) {
        if (candidate == null || candidate.getId() == null) {
            throw HrFlowException.badRequest("Candidate is required before a portal link can be created.");
        }

        revokeActiveTokens(candidate, purpose);

        byte[] raw = new byte[32];
        secureRandom.nextBytes(raw);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(raw);
        LocalDateTime expiresAt = LocalDateTime.now().plusDays(expiryDays);

        HrCandidateAccessToken entity = new HrCandidateAccessToken();
        entity.setCandidate(candidate);
        entity.setPurpose(purpose);
        entity.setTokenHash(hash(token));
        entity.setExpiresAt(expiresAt);
        entity.setCreatedBy(actor == null || actor.isBlank() ? "SYSTEM" : actor);
        tokenRepository.save(entity);

        return new IssuedToken(token, expiresAt);
    }

    private void revokeActiveTokens(HrCandidate candidate, HrTokenPurpose purpose) {
        LocalDateTime now = LocalDateTime.now();
        tokenRepository.findAllByCandidateIdAndPurpose(candidate.getId(), purpose)
                .stream()
                .filter(t -> t.getRevokedAt() == null)
                .forEach(t -> t.setRevokedAt(now));
    }

    private HrCandidate resolveToken(
            String rawToken,
            HrTokenPurpose purpose,
            String invalidMessage,
            String revokedMessage,
            String expiredMessage
    ) {
        if (rawToken == null || rawToken.isBlank()) {
            throw HrFlowException.notFound(invalidMessage);
        }

        HrCandidateAccessToken token = tokenRepository
                .findByTokenHashAndPurpose(hash(rawToken), purpose)
                .orElseThrow(() -> HrFlowException.notFound(invalidMessage));

        return validateAndResolve(token, revokedMessage, expiredMessage);
    }

    private HrCandidate validateAndResolve(
            HrCandidateAccessToken token,
            String revokedMessage,
            String expiredMessage
    ) {
        if (token.getRevokedAt() != null) {
            throw HrFlowException.forbidden(revokedMessage);
        }
        if (token.getExpiresAt() == null || token.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw HrFlowException.forbidden(expiredMessage);
        }

        token.setLastUsedAt(LocalDateTime.now());

        /*
         * The token -> candidate association is LAZY. Some public controllers
         * resolve the token in this service and then pass the candidate into a
         * second transactional service. If we return an uninitialized Hibernate
         * proxy here, the first transaction closes and the next service can hit
         * LazyInitializationException when reading candidate fields.
         *
         * Touch a non-identifier field while this transaction is still open so
         * the proxy is initialized before it leaves the token boundary.
         */
        HrCandidate candidate = token.getCandidate();
        if (candidate == null) {
            throw HrFlowException.notFound("Candidate was not found.");
        }
        candidate.getStage();
        return candidate;
    }

    private String hash(String value) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(md.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is unavailable", e);
        }
    }
}
