package com.alsorg.packing.security;

import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * In-process login abuse protection.
 *
 * Two independent limits are maintained:
 * 1. per username/account, regardless of source IP
 * 2. per source IP, regardless of username
 *
 * This protects one FlowSuite instance immediately without adding an external
 * dependency. When FlowSuite is scaled to multiple backend instances, move
 * these counters to Render Key Value / Redis so every instance shares the
 * same limits.
 */
@Service
public class LoginAttemptService {

    private static final int MAX_PRINCIPAL_WINDOWS = 10_000;
    private static final int MAX_IP_WINDOWS = 5_000;

    private static final String OVERFLOW_KEY = "\u0000flowsuite-overflow";

    private final Map<String, AttemptWindow> principalWindows = new ConcurrentHashMap<>();
    private final Map<String, AttemptWindow> ipWindows = new ConcurrentHashMap<>();

    private final AtomicLong operations = new AtomicLong();

    private final int maxFailuresPerPrincipal;
    private final int maxFailuresPerIp;
    private final Duration windowDuration;
    private final Duration blockDuration;

    public LoginAttemptService(
            @Value("${app.security.login.max-failures-per-principal:8}") int maxFailuresPerPrincipal,
            @Value("${app.security.login.max-failures-per-ip:40}") int maxFailuresPerIp,
            @Value("${app.security.login.window-seconds:900}") long windowSeconds,
            @Value("${app.security.login.block-seconds:900}") long blockSeconds) {

        this.maxFailuresPerPrincipal = Math.max(3, maxFailuresPerPrincipal);
        this.maxFailuresPerIp = Math.max(this.maxFailuresPerPrincipal, maxFailuresPerIp);
        this.windowDuration = Duration.ofSeconds(Math.max(60L, windowSeconds));
        this.blockDuration = Duration.ofSeconds(Math.max(60L, blockSeconds));
    }

    public Decision checkAllowed(
            String clientIp,
            String username) {

        cleanupOccasionally();

        Instant now = Instant.now();

        String ipKey = normalizeIp(clientIp);
        String principalKey = principalKey(username);

        long ipRetry = retryAfterSeconds(
                windowForLookup(
                        ipWindows,
                        ipKey,
                        MAX_IP_WINDOWS),
                now);

        long principalRetry = retryAfterSeconds(
                windowForLookup(
                        principalWindows,
                        principalKey,
                        MAX_PRINCIPAL_WINDOWS),
                now);

        long retryAfter = Math.max(
                ipRetry,
                principalRetry);

        return new Decision(
                retryAfter <= 0L,
                Math.max(0L, retryAfter));
    }

    public void recordFailure(
            String clientIp,
            String username) {

        cleanupOccasionally();

        Instant now = Instant.now();

        String ipKey = normalizeIp(clientIp);
        String principalKey = principalKey(username);

        windowForFailure(
                ipWindows,
                ipKey,
                MAX_IP_WINDOWS,
                now)
                .recordFailure(
                        now,
                        windowDuration,
                        blockDuration,
                        maxFailuresPerIp);

        windowForFailure(
                principalWindows,
                principalKey,
                MAX_PRINCIPAL_WINDOWS,
                now)
                .recordFailure(
                        now,
                        windowDuration,
                        blockDuration,
                        maxFailuresPerPrincipal);
    }

    public void recordSuccess(
            String clientIp,
            String username) {

        String principalKey = principalKey(username);

        /*
         * Clear only the successful account's failure window.
         *
         * Do not erase the IP-wide counter because a successful login to one
         * account must not reset a brute-force attack against many accounts.
         */
        principalWindows.remove(principalKey);
    }

    private long retryAfterSeconds(
            AttemptWindow window,
            Instant now) {

        if (window == null) {
            return 0L;
        }

        return window.retryAfterSeconds(
                now,
                windowDuration);
    }

    private String normalizeIp(
            String value) {

        String clean = value == null
                ? "unknown"
                : value.trim();

        if (clean.isBlank()) {
            clean = "unknown";
        }

        if (clean.length() > 128) {
            clean = clean.substring(0, 128);
        }

        return clean;
    }

    private String principalKey(
            String username) {

        String cleanUser = username == null
                ? "<blank>"
                : username
                        .trim()
                        .toLowerCase(Locale.ROOT);

        if (cleanUser.isBlank()) {
            cleanUser = "<blank>";
        }

        if (cleanUser.length() > 180) {
            cleanUser = cleanUser.substring(0, 180);
        }

        return cleanUser;
    }

    private void cleanupOccasionally() {

        long operation = operations.incrementAndGet();

        if ((operation & 0xFFL) != 0L) {
            return;
        }

        Instant now = Instant.now();

        cleanupMap(
                principalWindows,
                now);

        cleanupMap(
                ipWindows,
                now);
    }

    private void cleanupMap(
            Map<String, AttemptWindow> map,
            Instant now) {

        for (Map.Entry<String, AttemptWindow> entry : map.entrySet()) {
            AttemptWindow window = entry.getValue();

            if (window == null
                    || window.isDisposable(
                            now,
                            windowDuration,
                            blockDuration)) {

                map.remove(
                        entry.getKey(),
                        window);
            }
        }

    }

    private AttemptWindow windowForLookup(
            Map<String, AttemptWindow> map,
            String key,
            int maxEntries) {

        AttemptWindow direct = map.get(key);

        if (direct != null) {
            return direct;
        }

        if (map.size() >= maxEntries) {
            return map.get(OVERFLOW_KEY);
        }

        return null;
    }

    private AttemptWindow windowForFailure(
            Map<String, AttemptWindow> map,
            String key,
            int maxEntries,
            Instant now) {

        AttemptWindow direct = map.get(key);

        if (direct != null) {
            return direct;
        }

        if (map.size() >= maxEntries) {
            cleanupMap(
                    map,
                    now);

            if (map.size() >= maxEntries) {
                return map.computeIfAbsent(
                        OVERFLOW_KEY,
                        ignored -> new AttemptWindow());
            }
        }

        return map.computeIfAbsent(
                key,
                ignored -> new AttemptWindow());
    }

    public record Decision(
            boolean allowed,
            long retryAfterSeconds) {
    }

    private static final class AttemptWindow {

        private Instant windowStartedAt;
        private Instant lastFailureAt;
        private Instant blockedUntil;
        private int failures;

        synchronized void recordFailure(
                Instant now,
                Duration windowDuration,
                Duration blockDuration,
                int maxFailures) {

            resetWindowIfExpired(
                    now,
                    windowDuration);

            if (windowStartedAt == null) {
                windowStartedAt = now;
            }

            lastFailureAt = now;
            failures++;

            if (failures >= maxFailures) {
                blockedUntil = now.plus(blockDuration);
            }
        }

        synchronized long retryAfterSeconds(
                Instant now,
                Duration windowDuration) {

            resetWindowIfExpired(
                    now,
                    windowDuration);

            if (blockedUntil == null
                    || !blockedUntil.isAfter(now)) {
                return 0L;
            }

            return Math.max(
                    1L,
                    Duration.between(
                            now,
                            blockedUntil)
                            .toSeconds());
        }

        synchronized boolean isDisposable(
                Instant now,
                Duration windowDuration,
                Duration blockDuration) {

            if (blockedUntil != null
                    && blockedUntil.isAfter(now)) {
                return false;
            }

            if (lastFailureAt == null) {
                return true;
            }

            Duration retention = windowDuration
                    .plus(blockDuration);

            return lastFailureAt
                    .plus(retention)
                    .isBefore(now);
        }

        private void resetWindowIfExpired(
                Instant now,
                Duration windowDuration) {

            if (windowStartedAt == null) {
                return;
            }

            if (windowStartedAt
                    .plus(windowDuration)
                    .isAfter(now)) {
                return;
            }

            if (blockedUntil != null
                    && blockedUntil.isAfter(now)) {
                return;
            }

            windowStartedAt = null;
            lastFailureAt = null;
            blockedUntil = null;
            failures = 0;
        }
    }
}
