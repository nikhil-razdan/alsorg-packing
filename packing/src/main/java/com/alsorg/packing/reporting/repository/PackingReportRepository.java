package com.alsorg.packing.reporting.repository;

import java.time.LocalDateTime;
import java.util.List;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;

import org.springframework.stereotype.Repository;

import com.alsorg.packing.reporting.dto.PackingReportRow;
import com.alsorg.packing.domain.common.ItemDispatchStatus;

@Repository
public class PackingReportRepository {

    @PersistenceContext
    private EntityManager em;

    public List<PackingReportRow> fetchPackingReport(
            LocalDateTime from,
            LocalDateTime to
    ) {
        return em.createQuery("""
            select new com.alsorg.packing.reporting.dto.PackingReportRow(
                d.zohoItemId,
                d.name,
                d.clientName,
                d.packedAt,
                'SYSTEM'
            )
            from DispatchedItem d
            where d.status = :status
              and d.packedAt between :from and :to
            order by d.packedAt desc
        """, PackingReportRow.class)
        .setParameter("status", ItemDispatchStatus.PACKED)
        .setParameter("from", from)
        .setParameter("to", to)
        .getResultList();
    }
}
