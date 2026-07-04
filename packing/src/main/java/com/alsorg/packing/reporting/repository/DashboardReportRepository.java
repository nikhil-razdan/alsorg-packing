package com.alsorg.packing.reporting.repository;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.stereotype.Repository;

import com.alsorg.packing.domain.common.ItemDispatchStatus;
import com.alsorg.packing.reporting.dto.DailyThroughputUserDTO;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.time.LocalDate;

@Repository
public class DashboardReportRepository {

    @PersistenceContext
    private EntityManager em;

    /*
     * =========================================================
     * COMMON HELPERS
     * =========================================================
     */

    private long countNative(
            String sql,
            Object... params) {
        var query = em.createNativeQuery(sql);

        for (int i = 0; i < params.length; i++) {
            query.setParameter(i + 1, params[i]);
        }

        Object value = query.getSingleResult();

        if (value == null) {
            return 0;
        }

        if (value instanceof Number number) {
            return number.longValue();
        }

        try {
            return Long.parseLong(String.valueOf(value));
        } catch (Exception e) {
            return 0;
        }
    }

    /*
     * =========================================================
     * MASTER / PACKET COUNTS
     * =========================================================
     */

    public long countMasterItems() {
        return countNative("""
                    select count(*)
                    from master_item
                """);
    }

    public long countTotalPackets() {
        return countNative("""
                    select count(*)
                    from packets
                """);
    }

    public long countPacketItems() {
        return countNative("""
                    select count(*)
                    from packet_items
                """);
    }

    public long countFullyPackedMasterItems() {
        return countNative("""
                    select count(*)
                    from (
                        select
                            mi.id,
                            count(distinct pi.id) as total_items,
                            count(distinct case
                                when pi.sticker_number is not null
                                  or pi.packed_at is not null
                                  or sh.id is not null
                                then pi.id
                            end) as packed_items
                        from master_item mi
                        left join packet_items pi
                            on pi.master_item_id = mi.id
                        left join sticker_history sh
                            on sh.packet_item_id = pi.id
                        group by mi.id
                    ) x
                    where x.total_items > 0
                      and x.total_items = x.packed_items
                """);
    }

    public long countPartiallyPackedMasterItems() {
        return countNative("""
                    select count(*)
                    from (
                        select
                            mi.id,
                            count(distinct pi.id) as total_items,
                            count(distinct case
                                when pi.sticker_number is not null
                                  or pi.packed_at is not null
                                  or sh.id is not null
                                then pi.id
                            end) as packed_items
                        from master_item mi
                        left join packet_items pi
                            on pi.master_item_id = mi.id
                        left join sticker_history sh
                            on sh.packet_item_id = pi.id
                        group by mi.id
                    ) x
                    where x.total_items > 0
                      and x.packed_items > 0
                      and x.packed_items < x.total_items
                """);
    }

    public long countUnpackedMasterItems() {
        return countNative("""
                    select count(*)
                    from (
                        select
                            mi.id,
                            count(distinct pi.id) as total_items,
                            count(distinct case
                                when pi.sticker_number is not null
                                  or pi.packed_at is not null
                                  or sh.id is not null
                                then pi.id
                            end) as packed_items
                        from master_item mi
                        left join packet_items pi
                            on pi.master_item_id = mi.id
                        left join sticker_history sh
                            on sh.packet_item_id = pi.id
                        group by mi.id
                    ) x
                    where x.total_items = 0
                       or x.packed_items = 0
                """);
    }

    public long countPackedPackets() {
        return countNative("""
                    select count(*)
                    from (
                        select
                            p.id,
                            count(distinct pi.id) as total_items,
                            count(distinct case
                                when pi.sticker_number is not null
                                  or pi.packed_at is not null
                                  or sh.id is not null
                                then pi.id
                            end) as packed_items
                        from packets p
                        left join packet_items pi
                            on pi.packet_id = p.id
                        left join sticker_history sh
                            on sh.packet_item_id = pi.id
                        group by p.id
                    ) x
                    where x.total_items > 0
                      and x.total_items = x.packed_items
                """);
    }

    public long countPendingPackets() {
        return countNative("""
                    select count(*)
                    from (
                        select
                            p.id,
                            count(distinct pi.id) as total_items,
                            count(distinct case
                                when pi.sticker_number is not null
                                  or pi.packed_at is not null
                                  or sh.id is not null
                                then pi.id
                            end) as packed_items
                        from packets p
                        left join packet_items pi
                            on pi.packet_id = p.id
                        left join sticker_history sh
                            on sh.packet_item_id = pi.id
                        group by p.id
                    ) x
                    where x.total_items = 0
                       or x.packed_items < x.total_items
                """);
    }

    /*
     * =========================================================
     * STICKER / PACKING COUNTS
     * =========================================================
     */

    public long countPacketItemsWithSticker() {
        return countNative("""
                    select count(distinct pi.id)
                    from packet_items pi
                    left join sticker_history sh
                        on sh.packet_item_id = pi.id
                    where pi.sticker_number is not null
                       or pi.packed_at is not null
                       or sh.id is not null
                """);
    }

    public long countPacketItemsPendingSticker() {
        return countNative("""
                    select count(distinct pi.id)
                    from packet_items pi
                    left join sticker_history sh
                        on sh.packet_item_id = pi.id
                    where pi.sticker_number is null
                      and pi.packed_at is null
                      and sh.id is null
                """);
    }

    public long countPackedItems() {
        return countPacketItemsWithSticker();
    }

    public long countPendingItems() {
        return countPacketItemsPendingSticker();
    }

    public long countStickersGenerated() {
        return countNative("""
                    select count(*)
                    from sticker_history
                """);
    }

    public long countStickerReprints() {
        return countNative("""
                    select count(*)
                    from sticker_history
                    where coalesce(print_iteration, 1) > 1
                """);
    }

    public long countTodayStickerGenerated(
            LocalDateTime from,
            LocalDateTime to) {
        return countNative("""
                    select count(*)
                    from sticker_history
                    where generated_at >= ?
                      and generated_at < ?
                """, from, to);
    }

    /*
     * =========================================================
     * DISPATCH / WAREHOUSE COUNTS
     * =========================================================
     */

    public long countWarehouseItems() {
        return countByDispatchStatus("IN_WAREHOUSE");
    }

    public long countReadyToDispatchItems() {
        return countByDispatchStatus("READY_TO_DISPATCH");
    }

    public long countReadyItems() {
        return countByDispatchStatus("READY");
    }

    public long countReadyToStoreItems() {
        return countByDispatchStatus("READY_TO_STORE");
    }

    public long countWarehouseRequestedItems() {
        return countByDispatchStatus("WAREHOUSE_REQUESTED");
    }

    public long countReturnRequestedItems() {
        return countByDispatchStatus("WAREHOUSE_RETURN_REQUESTED");
    }

    public long countQueuedItems() {
        return countNative("""
                    select count(*)
                    from dispatched_items
                    where upper(coalesce(status, '')) in ('LOADED', 'QUEUED')
                """);
    }

    public long countDispatchedItems() {
        return countByDispatchStatus("DISPATCHED");
    }

    private long countByDispatchStatus(
            String status) {
        return countNative("""
                    select count(*)
                    from dispatched_items
                    where upper(coalesce(status, '')) = ?
                """, status);
    }

    public long countPkdItems() {
        return countNative("""
                    select count(*)
                    from dispatched_items
                    where upper(coalesce(current_location_code, location, '')) like 'PKD%'
                """);
    }

    public long countFgItems() {
        return countNative("""
                    select count(*)
                    from dispatched_items
                    where (
                        fg_area_code is not null
                        and current_location_code is not null
                        and current_location_code like fg_area_code || '%'
                    )
                    or upper(coalesce(current_location_code, location, '')) like 'FG%'
                """);
    }

    public long countNormalDispatchChallans() {
        return countNative("""
                    select count(distinct chalaan_number)
                    from dispatched_items
                    where chalaan_number is not null
                      and trim(chalaan_number) <> ''
                """);
    }

    public long countTodayDispatchedItems(
            LocalDateTime from,
            LocalDateTime to) {
        return countNative("""
                    select count(*)
                    from dispatched_items
                    where upper(coalesce(status, '')) = 'DISPATCHED'
                      and dispatched_at >= ?
                      and dispatched_at < ?
                """, from, to);
    }

    public long countTodayDispatchChallans(
            LocalDateTime from,
            LocalDateTime to) {
        return countNative("""
                    select count(distinct chalaan_number)
                    from dispatched_items
                    where upper(coalesce(status, '')) = 'DISPATCHED'
                      and chalaan_number is not null
                      and trim(chalaan_number) <> ''
                      and dispatched_at >= ?
                      and dispatched_at < ?
                """, from, to);
    }

    public long countRunningTrips() {
        return countNative("""
                    select count(*)
                    from (
                        select chalaan_number
                        from dispatched_items
                        where chalaan_number is not null
                          and trim(chalaan_number) <> ''
                          and trip_started_at is not null
                        group by chalaan_number
                        having max(trip_ended_at) is null
                    ) x
                """);
    }

    public long countEndedTrips() {
        return countNative("""
                    select count(*)
                    from (
                        select chalaan_number
                        from dispatched_items
                        where chalaan_number is not null
                          and trim(chalaan_number) <> ''
                          and trip_started_at is not null
                        group by chalaan_number
                        having max(trip_ended_at) is not null
                    ) x
                """);
    }

    /*
     * =========================================================
     * CUSTOM CHALLAN COUNTS
     * =========================================================
     */

    public long countCustomChallans() {
        return countNative("""
                    select count(*)
                    from custom_challans
                """);
    }

    public long countTodayCustomChallans(
            LocalDateTime from,
            LocalDateTime to) {
        return countNative("""
                    select count(*)
                    from custom_challans
                    where generated_at >= ?
                      and generated_at < ?
                """, from, to);
    }

    public long countCustomChallanItems() {
        return countNative("""
                    select count(*)
                    from custom_challan_items
                """);
    }

    /*
     * =========================================================
     * DRIVER / VEHICLE COUNTS
     * =========================================================
     */

    public long countActiveDrivers() {
        return countNative("""
                    select count(*)
                    from drivers
                    where active = true
                """);
    }

    public long countActiveVehicles() {
        return countNative("""
                    select count(*)
                    from vehicles
                    where active = true
                """);
    }

    public long countExpiredFitness(
            LocalDate today) {
        return countNative("""
                    select count(*)
                    from vehicles
                    where active = true
                      and fitness_valid_upto is not null
                      and fitness_valid_upto < ?
                """, today);
    }

    public long countExpiredInsurance(
            LocalDate today) {
        return countNative("""
                    select count(*)
                    from vehicles
                    where active = true
                      and insurance_valid_upto is not null
                      and insurance_valid_upto < ?
                """, today);
    }

    public long countExpiredPucc(
            LocalDate today) {
        return countNative("""
                    select count(*)
                    from vehicles
                    where active = true
                      and pucc_valid_upto is not null
                      and pucc_valid_upto < ?
                """, today);
    }

    /*
     * =========================================================
     * EXCEPTION COUNTS
     * =========================================================
     */

    public long countMasterItemsWithoutPackets() {
        return countNative("""
                    select count(*)
                    from master_item mi
                    where not exists (
                        select 1
                        from packet_items pi
                        where pi.master_item_id = mi.id
                    )
                """);
    }

    public long countPacketsWithoutPacketItems() {
        return countNative("""
                    select count(*)
                    from packets p
                    where not exists (
                        select 1
                        from packet_items pi
                        where pi.packet_id = p.id
                    )
                """);
    }

    public long countPacketItemsWithoutMaster() {
        return countNative("""
                    select count(*)
                    from packet_items pi
                    left join master_item mi
                        on mi.id = pi.master_item_id
                    where pi.master_item_id is null
                       or mi.id is null
                """);
    }

    public long countDispatchedWithoutPacketItem() {
        return countNative("""
                    select count(*)
                    from dispatched_items d
                    left join packet_items pi
                        on pi.id = d.packet_item_id
                    where d.packet_item_id is null
                       or pi.id is null
                """);
    }

    public long countDispatchedWithoutChallan() {
        return countNative("""
                    select count(*)
                    from dispatched_items
                    where upper(coalesce(status, '')) = 'DISPATCHED'
                      and (
                            chalaan_number is null
                            or trim(chalaan_number) = ''
                      )
                """);
    }

    public long countDispatchedWithoutDriver() {
        return countNative("""
                    select count(*)
                    from dispatched_items
                    where upper(coalesce(status, '')) = 'DISPATCHED'
                      and (
                            driver_id is null
                            or vehicle_id is null
                            or driver_name is null
                            or trim(driver_name) = ''
                            or vehicle_number is null
                            or trim(vehicle_number) = ''
                      )
                """);
    }

    public long countDuplicateCurrentStickers() {
        return countNative("""
                    select count(*)
                    from (
                        select sticker_number
                        from packet_items
                        where sticker_number is not null
                          and trim(sticker_number) <> ''
                        group by sticker_number
                        having count(*) > 1
                    ) x
                """);
    }

    public long countReadyItemsStillInPkd() {
        return countNative("""
                    select count(*)
                    from dispatched_items
                    where upper(coalesce(status, '')) = 'READY'
                      and upper(coalesce(current_location_code, location, '')) like 'PKD%'
                """);
    }

    /*
     * =========================================================
     * USER-WISE THROUGHPUT
     * Keep JPQL here because existing DTO constructor already works.
     * =========================================================
     */

    public List<DailyThroughputUserDTO> fetchTodayPackingByUser(
            LocalDateTime from,
            LocalDateTime to) {
        return em.createQuery("""
                    select new com.alsorg.packing.reporting.dto.DailyThroughputUserDTO(
                        coalesce(d.packedBy, d.createdBy, 'SYSTEM'),
                        count(d)
                    )
                    from DispatchedItem d
                    where d.packedAt >= :from
                      and d.packedAt < :to
                    group by coalesce(d.packedBy, d.createdBy, 'SYSTEM')
                    order by count(d) desc
                """, DailyThroughputUserDTO.class)
                .setParameter("from", from)
                .setParameter("to", to)
                .getResultList();
    }

    public List<DailyThroughputUserDTO> fetchTodayDispatchByUser(
            LocalDateTime from,
            LocalDateTime to) {
        return em.createQuery("""
                    select new com.alsorg.packing.reporting.dto.DailyThroughputUserDTO(
                        coalesce(d.dispatchedBy, d.createdBy, 'SYSTEM'),
                        count(d)
                    )
                    from DispatchedItem d
                    where d.status = :status
                      and d.dispatchedAt >= :from
                      and d.dispatchedAt < :to
                    group by coalesce(d.dispatchedBy, d.createdBy, 'SYSTEM')
                    order by count(d) desc
                """, DailyThroughputUserDTO.class)
                .setParameter("status", ItemDispatchStatus.DISPATCHED)
                .setParameter("from", from)
                .setParameter("to", to)
                .getResultList();
    }
}