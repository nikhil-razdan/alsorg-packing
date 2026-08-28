package com.alsorg.packing.assetflow;

import com.alsorg.packing.assetflow.AssetFlowData.Reporter;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import jakarta.persistence.PersistenceContext;

import java.time.LocalDateTime;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Persists Reporter Pass failed-login state in its own transaction so a later
 * 403 does not roll the counter back with the caller transaction.
 */
@Service
public class AssetFlowReporterAuthStateService {

    @PersistenceContext
    private EntityManager em;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordFailure(UUID reporterId, LocalDateTime now) {
        if (reporterId == null) return;
        LocalDateTime effectiveNow = now == null ? LocalDateTime.now() : now;

        Reporter reporter = em.find(Reporter.class, reporterId, LockModeType.PESSIMISTIC_WRITE);
        if (reporter == null) return;

        reporter.failedAttempts++;
        if (reporter.failedAttempts >= 5) {
            reporter.lockedUntil = effectiveNow.plusMinutes(15);
            reporter.failedAttempts = 0;
        }
        reporter.updatedAt = effectiveNow;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void clearFailureState(UUID reporterId, LocalDateTime now) {
        if (reporterId == null) return;
        LocalDateTime effectiveNow = now == null ? LocalDateTime.now() : now;

        Reporter reporter = em.find(Reporter.class, reporterId, LockModeType.PESSIMISTIC_WRITE);
        if (reporter == null) return;

        if (reporter.failedAttempts != 0 || reporter.lockedUntil != null) {
            reporter.failedAttempts = 0;
            reporter.lockedUntil = null;
            reporter.updatedAt = effectiveNow;
        }
    }
}
