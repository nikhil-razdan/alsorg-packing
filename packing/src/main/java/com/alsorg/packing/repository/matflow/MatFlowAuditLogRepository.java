package com.alsorg.packing.repository.matflow;

import com.alsorg.packing.domain.matflow.MatFlowAuditLog;

import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

/**
 * Audit repository.
 *
 * Filtering is intentionally implemented with JPA Specifications inside
 * MatFlowInsightService instead of one large nullable-parameter JPQL query.
 * PostgreSQL can fail to infer the type of nullable LocalDateTime parameters
 * used in predicates such as ":fromDate is null", producing:
 * "could not determine data type of parameter".
 *
 * Specifications add only the predicates that are actually required, so no
 * untyped nullable SQL bind is emitted.
 */
public interface MatFlowAuditLogRepository
        extends JpaRepository<MatFlowAuditLog, UUID>,
        JpaSpecificationExecutor<MatFlowAuditLog> {
}
