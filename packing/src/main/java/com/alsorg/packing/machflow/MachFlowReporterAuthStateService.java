package com.alsorg.packing.machflow;

import com.alsorg.packing.machflow.MachFlowData.Reporter;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import jakarta.persistence.PersistenceContext;
import java.time.LocalDateTime;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Persists Reporter Pass failed-login state in its own transaction.
 *
 * This deliberately sits outside MachFlowService's request transaction so a
 * later 403 response cannot roll back the failed-attempt counter. Reporter
 * passes grant request-only access and never create a Spring Security session.
 */
@Service
public class MachFlowReporterAuthStateService {

    @PersistenceContext
    private EntityManager em;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordFailure(UUID reporterId, LocalDateTime now) {
        if (reporterId == null) {
            return;
        }

        Reporter reporter = em.find(
                Reporter.class,
                reporterId,
                LockModeType.PESSIMISTIC_WRITE);

        if (reporter == null) {
            return;
        }

        reporter.failedAttempts++;

        if (reporter.failedAttempts >= 5) {
            reporter.lockedUntil = now.plusMinutes(15);
            reporter.failedAttempts = 0;
        }

        reporter.updatedAt = now;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void clearFailureState(UUID reporterId, LocalDateTime now) {
        if (reporterId == null) {
            return;
        }

        Reporter reporter = em.find(
                Reporter.class,
                reporterId,
                LockModeType.PESSIMISTIC_WRITE);

        if (reporter == null) {
            return;
        }

        if (reporter.failedAttempts != 0 || reporter.lockedUntil != null) {
            reporter.failedAttempts = 0;
            reporter.lockedUntil = null;
            reporter.updatedAt = now;
        }
    }
}
