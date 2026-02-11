package com.alsorg.packing.reporting.repository;

import java.time.LocalDateTime;
import java.util.List;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;

import org.springframework.stereotype.Repository;

import com.alsorg.packing.reporting.dto.CombinedReportRow;

@Repository
public class CombinedReportRepository {

    @PersistenceContext
    private EntityManager em;

    public List<CombinedReportRow> fetchCombinedReport(
            LocalDateTime from,
            LocalDateTime to
    ) {
        return em.createQuery("""
            select new com.alsorg.packing.reporting.dto.CombinedReportRow(
                d.zohoItemId,
                d.name,
                d.clientName,
                case
                    when d.dispatchedAt is not null then 'DISPATCHED'
                    else 'PACKED'
                end,
                coalesce(d.dispatchedAt, d.packedAt),
                coalesce(d.dispatchedBy, 'SYSTEM')
            )
            from DispatchedItem d
            where (d.packedAt between :from and :to)
               or (d.dispatchedAt between :from and :to)
            order by coalesce(d.dispatchedAt, d.packedAt) desc
        """, CombinedReportRow.class)
        .setParameter("from", from)
        .setParameter("to", to)
        .getResultList();
    }
}
