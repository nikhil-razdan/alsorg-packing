package com.alsorg.packing.reporting.repository;

import java.time.LocalDateTime;
import java.util.List;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.TypedQuery;

import org.springframework.stereotype.Repository;

import com.alsorg.packing.domain.common.ItemDispatchStatus;
import com.alsorg.packing.reporting.dto.DispatchReportRow;
import java.time.LocalDate;

@Repository
public class DispatchReportRepository {

    @PersistenceContext
    private EntityManager em;

    public List<DispatchReportRow> fetchDispatchReport(
            LocalDateTime from,
            LocalDateTime to
    ) {
        StringBuilder jpql = new StringBuilder("""
            select new com.alsorg.packing.reporting.dto.DispatchReportRow(
                d.zohoItemId,
                d.name,
                d.clientName,

                d.zohoItemId,
                d.name,

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

        jpql.append(" order by d.dispatchedAt desc ");

        TypedQuery<DispatchReportRow> query =
                em.createQuery(
                        jpql.toString(),
                        DispatchReportRow.class
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