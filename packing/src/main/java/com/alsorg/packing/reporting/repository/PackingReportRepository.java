package com.alsorg.packing.reporting.repository;

import java.time.LocalDateTime;
import java.util.List;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.TypedQuery;

import org.springframework.stereotype.Repository;

import com.alsorg.packing.reporting.dto.PackingReportRow;

@Repository
public class PackingReportRepository {

    @PersistenceContext
    private EntityManager em;

    public List<PackingReportRow> fetchPackingReport(
            LocalDateTime from,
            LocalDateTime to
    ) {
        StringBuilder jpql = new StringBuilder("""
            select new com.alsorg.packing.reporting.dto.PackingReportRow(
                d.zohoItemId,
                d.name,
                d.clientName,

                d.zohoItemId,
                d.name,

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

        jpql.append(" order by d.packedAt desc ");

        TypedQuery<PackingReportRow> query =
                em.createQuery(
                        jpql.toString(),
                        PackingReportRow.class
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