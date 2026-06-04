package com.alsorg.packing.reporting.repository;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.TypedQuery;

import org.springframework.stereotype.Repository;

import com.alsorg.packing.domain.common.ItemDispatchStatus;
import com.alsorg.packing.reporting.dto.CombinedReportRow;

@Repository
public class CombinedReportRepository {

    @PersistenceContext
    private EntityManager em;

    public List<CombinedReportRow> fetchCombinedReport(
            LocalDateTime from,
            LocalDateTime to
    ) {
        List<CombinedReportRow> rows =
                new ArrayList<>();

        rows.addAll(
                fetchPackedRows(from, to)
        );

        rows.addAll(
                fetchDispatchedRows(from, to)
        );

        rows.sort((a, b) -> {
            LocalDateTime at = a.getEventTime();
            LocalDateTime bt = b.getEventTime();

            if (at == null && bt == null) {
                return 0;
            }

            if (at == null) {
                return 1;
            }

            if (bt == null) {
                return -1;
            }

            return bt.compareTo(at);
        });

        return rows;
    }

    private List<CombinedReportRow> fetchPackedRows(
            LocalDateTime from,
            LocalDateTime to
    ) {
        StringBuilder jpql = new StringBuilder("""
            select new com.alsorg.packing.reporting.dto.CombinedReportRow(
                d.zohoItemId,
                d.name,
                d.clientName,

                d.zohoItemId,
                d.name,

                'PACKED',
                d.packedAt,
                coalesce(d.packedBy, d.createdBy, 'SYSTEM')
            )
            from DispatchedItem d
            where d.packedAt is not null
        """);

        if (from != null) {
            jpql.append(" and d.packedAt >= :from ");
        }

        if (to != null) {
            jpql.append(" and d.packedAt <= :to ");
        }

        TypedQuery<CombinedReportRow> query =
                em.createQuery(
                        jpql.toString(),
                        CombinedReportRow.class
                );

        if (from != null) {
            query.setParameter("from", from);
        }

        if (to != null) {
            query.setParameter("to", to);
        }

        return query.getResultList();
    }

    private List<CombinedReportRow> fetchDispatchedRows(
            LocalDateTime from,
            LocalDateTime to
    ) {
        StringBuilder jpql = new StringBuilder("""
            select new com.alsorg.packing.reporting.dto.CombinedReportRow(
                d.zohoItemId,
                d.name,
                d.clientName,

                d.zohoItemId,
                d.name,

                'DISPATCHED',
                d.dispatchedAt,
                coalesce(d.dispatchedBy, d.createdBy, 'SYSTEM')
            )
            from DispatchedItem d
            where d.status = :status
              and d.dispatchedAt is not null
        """);

        if (from != null) {
            jpql.append(" and d.dispatchedAt >= :from ");
        }

        if (to != null) {
            jpql.append(" and d.dispatchedAt <= :to ");
        }

        TypedQuery<CombinedReportRow> query =
                em.createQuery(
                        jpql.toString(),
                        CombinedReportRow.class
                );

        query.setParameter(
                "status",
                ItemDispatchStatus.DISPATCHED
        );

        if (from != null) {
            query.setParameter("from", from);
        }

        if (to != null) {
            query.setParameter("to", to);
        }

        return query.getResultList();
    }
}