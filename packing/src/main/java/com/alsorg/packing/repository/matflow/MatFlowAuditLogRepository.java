package com.alsorg.packing.repository.matflow;

import com.alsorg.packing.domain.matflow.MatFlowAuditLog;

import java.time.LocalDateTime;
import java.util.Set;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MatFlowAuditLogRepository
                extends JpaRepository<MatFlowAuditLog, UUID> {

        @Query("""
                        select audit
                        from MatFlowAuditLog audit
                        where (
                                audit.plantCode is null
                                or audit.plantCode in :plantCodes
                          )

                          and (
                                :entityType is null
                                or upper(audit.entityType) =
                                   upper(:entityType)
                          )

                          and (
                                :entityId is null
                                or audit.entityId = :entityId
                          )

                          and (
                                :action is null
                                or upper(audit.action) =
                                   upper(:action)
                          )

                          and (
                                :fromDate is null
                                or audit.actionAt >= :fromDate
                          )

                          and (
                                :toDate is null
                                or audit.actionAt <= :toDate
                          )

                          and (
                                :searchText is null

                                or lower(
                                    coalesce(
                                        audit.actor,
                                        ''
                                    )
                                ) like lower(
                                    concat(
                                        '%',
                                        :searchText,
                                        '%'
                                    )
                                )

                                or lower(
                                    coalesce(
                                        audit.projectCode,
                                        ''
                                    )
                                ) like lower(
                                    concat(
                                        '%',
                                        :searchText,
                                        '%'
                                    )
                                )

                                or lower(
                                    coalesce(
                                        audit.drawingNo,
                                        ''
                                    )
                                ) like lower(
                                    concat(
                                        '%',
                                        :searchText,
                                        '%'
                                    )
                                )

                                or lower(
                                    coalesce(
                                        audit.detailsJson,
                                        ''
                                    )
                                ) like lower(
                                    concat(
                                        '%',
                                        :searchText,
                                        '%'
                                    )
                                )
                          )
                        """)
        Page<MatFlowAuditLog> search(
                        @Param("plantCodes") Set<String> plantCodes,

                        @Param("entityType") String entityType,

                        @Param("entityId") UUID entityId,

                        @Param("action") String action,

                        @Param("fromDate") LocalDateTime fromDate,

                        @Param("toDate") LocalDateTime toDate,

                        @Param("searchText") String searchText,

                        Pageable pageable);
}