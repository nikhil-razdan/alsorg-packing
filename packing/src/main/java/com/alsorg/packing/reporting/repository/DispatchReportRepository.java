package com.alsorg.packing.reporting.repository;

import java.time.LocalDateTime;
import java.util.List;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;

import org.springframework.stereotype.Repository;

import com.alsorg.packing.domain.common.ItemDispatchStatus;
import com.alsorg.packing.reporting.dto.DispatchReportRow;

@Repository
public class DispatchReportRepository {

    @PersistenceContext
    private EntityManager em;

    public List<DispatchReportRow> fetchDispatchReport(
            LocalDateTime from,
            LocalDateTime to
    ) {
        return em.createQuery("""
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
              and (:from is null or d.dispatchedAt >= :from)
              and (:to is null or d.dispatchedAt <= :to)
            order by d.dispatchedAt desc
        """, DispatchReportRow.class)
        .setParameter("status", ItemDispatchStatus.DISPATCHED)
        .setParameter("from", from)
        .setParameter("to", to)
        .getResultList();
    }
}