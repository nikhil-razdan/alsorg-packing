package com.alsorg.packing.reporting.repository;

import java.util.List;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;

import org.springframework.stereotype.Repository;

import com.alsorg.packing.reporting.dto.DashboardActivityRow;

@Repository
public class DashboardActivityRepository {

    @PersistenceContext
    private EntityManager em;

    public List<DashboardActivityRow> fetchRecent(int limit, int offset) {

        return em.createQuery("""
            select new com.alsorg.packing.reporting.dto.DashboardActivityRow(
                a.id,
                a.zohoItemId,
                d.name,
                a.action,
                a.performedBy,
                a.role,
                a.createdAt
            )
            from ActivityLog a
            left join DispatchedItem d
                on d.zohoItemId = a.zohoItemId
            order by a.createdAt desc
        """, DashboardActivityRow.class)
        .setFirstResult(offset)
        .setMaxResults(limit)
        .getResultList();
    }
}
