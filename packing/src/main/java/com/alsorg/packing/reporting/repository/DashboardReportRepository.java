package com.alsorg.packing.reporting.repository;

import java.time.LocalDateTime;
import java.util.List;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;

import org.springframework.stereotype.Repository;

import com.alsorg.packing.domain.common.ItemDispatchStatus;
import com.alsorg.packing.reporting.dto.DailyThroughputUserDTO;
import com.alsorg.packing.domain.common.ItemDispatchStatus;

import java.time.LocalDateTime;
import java.util.List;
import java.time.LocalDateTime;
import java.util.List;

import com.alsorg.packing.domain.common.ItemDispatchStatus;
import com.alsorg.packing.reporting.dto.DailyThroughputUserDTO;

@Repository
public class DashboardReportRepository {

    @PersistenceContext
    private EntityManager em;

    public long countWarehouseItems() {
        return countByDispatchStatus(ItemDispatchStatus.IN_WAREHOUSE);
    }

    public long countReadyToDispatchItems() {
        return countByDispatchStatus(ItemDispatchStatus.READY_TO_DISPATCH);
    }

    public long countReadyItems() {
        return countByDispatchStatus(ItemDispatchStatus.READY);
    }

    public long countDispatchedItems() {
        return countByDispatchStatus(ItemDispatchStatus.DISPATCHED);
    }

    public long countPackedItems() {
        return em.createQuery("""
            select count(d)
            from DispatchedItem d
            where d.status in :statuses
        """, Long.class)
        .setParameter("statuses", List.of(
                ItemDispatchStatus.READY,
                ItemDispatchStatus.READY_TO_STORE,
                ItemDispatchStatus.READY_TO_DISPATCH,
                ItemDispatchStatus.WAREHOUSE_REQUESTED,
                ItemDispatchStatus.WAREHOUSE_RETURN_REQUESTED,
                ItemDispatchStatus.IN_WAREHOUSE
        ))
        .getSingleResult();
    }

    public long countPendingItems() {
        return em.createQuery("""
            select count(p)
            from PacketItem p
            where p.status = :status
        """, Long.class)
        .setParameter("status", "CREATED")
        .getSingleResult();
    }

    public long countStickersGenerated() {
        return em.createQuery("""
            select count(s)
            from StickerHistory s
        """, Long.class)
        .getSingleResult();
    }

    public long countTodayStickerGenerated(
            LocalDateTime from,
            LocalDateTime to
    ) {
        return em.createQuery("""
            select count(s)
            from StickerHistory s
            where s.generatedAt >= :from
              and s.generatedAt < :to
        """, Long.class)
        .setParameter("from", from)
        .setParameter("to", to)
        .getSingleResult();
    }

    public long countTodayChallanGenerated(
            LocalDateTime from,
            LocalDateTime to
    ) {
        return em.createQuery("""
            select count(d)
            from DispatchedItem d
            where d.status = :status
              and d.dispatchedAt >= :from
              and d.dispatchedAt < :to
        """, Long.class)
        .setParameter("status", ItemDispatchStatus.DISPATCHED)
        .setParameter("from", from)
        .setParameter("to", to)
        .getSingleResult();
    }

    private long countByDispatchStatus(ItemDispatchStatus status) {
        return em.createQuery("""
            select count(d)
            from DispatchedItem d
            where d.status = :status
        """, Long.class)
        .setParameter("status", status)
        .getSingleResult();
    }
    
    public List<DailyThroughputUserDTO> fetchTodayPackingByUser(
            LocalDateTime from,
            LocalDateTime to
    ) {
        return em.createQuery("""
            select new com.alsorg.packing.reporting.dto.DailyThroughputUserDTO(
                h.generatedBy,
                count(h)
            )
            from StickerHistory h
            where h.generatedAt >= :from
              and h.generatedAt < :to
            group by h.generatedBy
            order by count(h) desc
        """, DailyThroughputUserDTO.class)
        .setParameter("from", from)
        .setParameter("to", to)
        .getResultList();
    }

    public List<DailyThroughputUserDTO> fetchTodayDispatchByUser(
            LocalDateTime from,
            LocalDateTime to
    ) {
        return em.createQuery("""
            select new com.alsorg.packing.reporting.dto.DailyThroughputUserDTO(
                d.dispatchedBy,
                count(d)
            )
            from DispatchedItem d
            where d.status = :status
              and d.dispatchedAt >= :from
              and d.dispatchedAt < :to
            group by d.dispatchedBy
            order by count(d) desc
        """, DailyThroughputUserDTO.class)
        .setParameter("status", ItemDispatchStatus.DISPATCHED)
        .setParameter("from", from)
        .setParameter("to", to)
        .getResultList();
    }
}