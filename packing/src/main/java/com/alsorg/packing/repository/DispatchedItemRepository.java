package com.alsorg.packing.repository;

import com.alsorg.packing.domain.common.ApprovalStatus;
import com.alsorg.packing.domain.common.ItemDispatchStatus;
import com.alsorg.packing.domain.dispatch.DispatchedItem;

import jakarta.persistence.LockModeType;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Slice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface DispatchedItemRepository
                extends JpaRepository<DispatchedItem, String>,
                JpaSpecificationExecutor<DispatchedItem> {

        /*
         * =====================================================
         * STATUS
         * =====================================================
         */

        List<DispatchedItem> findByStatus(
                        ItemDispatchStatus status);

        List<DispatchedItem> findByStatusIn(
                        List<ItemDispatchStatus> statuses);

        Page<DispatchedItem> findByStatusIn(
                        Collection<ItemDispatchStatus> statuses,
                        Pageable pageable);

        long countByStatus(
                        ItemDispatchStatus status);

        long countByStatusIn(
                        List<ItemDispatchStatus> statuses);

        long countByStatusIn(
                        Collection<ItemDispatchStatus> statuses);

        Optional<DispatchedItem> findBySku(
                        String sku);

        Optional<DispatchedItem> findByName(
                        String name);

        Optional<DispatchedItem> findByPacketItemId(
                        UUID packetItemId);

        Optional<DispatchedItem> findByStickerNumber(
                        String stickerNumber);

        @Query("""
                            SELECT d
                            FROM DispatchedItem d
                            WHERE d.status IN :statuses
                              AND (
                                    d.plantCode IN :plantCodes
                                    OR d.plantCode IS NULL
                                    OR d.plantCode = ''
                                  )
                        """)
        Slice<DispatchedItem> findVisibleSliceByStatusesAndPlantsIncludingLegacy(
                        @Param("statuses") Collection<ItemDispatchStatus> statuses,

                        @Param("plantCodes") Collection<String> plantCodes,

                        Pageable pageable);

        @Query("""
                            SELECT d
                            FROM DispatchedItem d
                            WHERE d.status IN :statuses
                              AND (
                                    d.plantCode IS NULL
                                    OR d.plantCode = ''
                                  )
                        """)
        Slice<DispatchedItem> findLegacyVisibleSliceByStatuses(
                        @Param("statuses") Collection<ItemDispatchStatus> statuses,

                        Pageable pageable);

        /*
         * =====================================================
         * APPROVAL / GATE PASS
         * =====================================================
         */

        List<DispatchedItem> findByApprovalStatus(
                        ApprovalStatus status);

        List<DispatchedItem> findByGatePassNumber(
                        String gatePassNumber);

        List<DispatchedItem> findByStatusAndApprovalStatus(
                        ItemDispatchStatus status,
                        ApprovalStatus approvalStatus);

        long countByStatusAndDispatchedAtBetween(
                        ItemDispatchStatus status,
                        LocalDateTime start,
                        LocalDateTime end);

        boolean existsByZohoItemId(
                        String zohoItemId);

        /*
         * =====================================================
         * PLANT FILTERS
         * =====================================================
         */

        List<DispatchedItem> findByStatusInAndPlantCodeIn(
                        List<ItemDispatchStatus> statuses,
                        Collection<String> plantCodes);

        List<DispatchedItem> findByStatusAndPlantCodeIn(
                        ItemDispatchStatus status,
                        Collection<String> plantCodes);

        @Query("""
                            SELECT d
                            FROM DispatchedItem d
                            WHERE d.status IN :statuses
                              AND (
                                    d.plantCode IN :plantCodes
                                    OR d.plantCode IS NULL
                                    OR d.plantCode = ''
                                  )
                        """)
        List<DispatchedItem> findVisibleByStatusesAndPlantsIncludingLegacy(
                        @Param("statuses") List<ItemDispatchStatus> statuses,

                        @Param("plantCodes") Collection<String> plantCodes);

        @Query(value = """
                        SELECT d
                        FROM DispatchedItem d
                        WHERE d.status IN :statuses
                          AND (
                                d.plantCode IN :plantCodes
                                OR d.plantCode IS NULL
                                OR TRIM(d.plantCode) = ''
                              )
                        """, countQuery = """
                        SELECT COUNT(d)
                        FROM DispatchedItem d
                        WHERE d.status IN :statuses
                          AND (
                                d.plantCode IN :plantCodes
                                OR d.plantCode IS NULL
                                OR TRIM(d.plantCode) = ''
                              )
                        """)
        Page<DispatchedItem> findVisiblePageByStatusesAndPlantsIncludingLegacy(
                        @Param("statuses") Collection<ItemDispatchStatus> statuses,

                        @Param("plantCodes") Collection<String> plantCodes,

                        Pageable pageable);

        @Query(value = """
                        SELECT d
                        FROM DispatchedItem d
                        WHERE d.status IN :statuses
                          AND (
                                d.plantCode IS NULL
                                OR TRIM(d.plantCode) = ''
                              )
                        """, countQuery = """
                        SELECT COUNT(d)
                        FROM DispatchedItem d
                        WHERE d.status IN :statuses
                          AND (
                                d.plantCode IS NULL
                                OR TRIM(d.plantCode) = ''
                              )
                        """)
        Page<DispatchedItem> findLegacyVisiblePageByStatuses(
                        @Param("statuses") Collection<ItemDispatchStatus> statuses,

                        Pageable pageable);

        /*
         * =====================================================
         * PAGED DISPATCH CHALLAN HISTORY
         * =====================================================
         *
         * Page by distinct challan number first, then load only the items for
         * those challans. This avoids materializing the entire DISPATCHED history
         * every time the Challan History modal opens.
         */
        @Query(value = """
                        SELECT d.chalaanNumber
                        FROM DispatchedItem d
                        WHERE d.status = :status
                          AND d.chalaanNumber IS NOT NULL
                          AND TRIM(d.chalaanNumber) <> ''
                        GROUP BY d.chalaanNumber
                        ORDER BY MAX(d.dispatchedAt) DESC, d.chalaanNumber DESC
                        """, countQuery = """
                        SELECT COUNT(DISTINCT d.chalaanNumber)
                        FROM DispatchedItem d
                        WHERE d.status = :status
                          AND d.chalaanNumber IS NOT NULL
                          AND TRIM(d.chalaanNumber) <> ''
                        """)
        Page<String> findChallanNumbersPage(
                        @Param("status") ItemDispatchStatus status,
                        Pageable pageable);

        @Query(value = """
                        SELECT d.chalaanNumber
                        FROM DispatchedItem d
                        WHERE d.status = :status
                          AND d.chalaanNumber IS NOT NULL
                          AND TRIM(d.chalaanNumber) <> ''
                          AND LOWER(TRIM(COALESCE(d.dispatchedBy, ''))) = :username
                          AND (
                                d.plantCode IN :plantCodes
                                OR d.plantCode IS NULL
                                OR TRIM(d.plantCode) = ''
                              )
                        GROUP BY d.chalaanNumber
                        ORDER BY MAX(d.dispatchedAt) DESC, d.chalaanNumber DESC
                        """, countQuery = """
                        SELECT COUNT(DISTINCT d.chalaanNumber)
                        FROM DispatchedItem d
                        WHERE d.status = :status
                          AND d.chalaanNumber IS NOT NULL
                          AND TRIM(d.chalaanNumber) <> ''
                          AND LOWER(TRIM(COALESCE(d.dispatchedBy, ''))) = :username
                          AND (
                                d.plantCode IN :plantCodes
                                OR d.plantCode IS NULL
                                OR TRIM(d.plantCode) = ''
                              )
                        """)
        Page<String> findVisibleChallanNumbersPageForUser(
                        @Param("status") ItemDispatchStatus status,
                        @Param("username") String username,
                        @Param("plantCodes") Collection<String> plantCodes,
                        Pageable pageable);

        /*
         * =====================================================
         * LOGISTICS
         * =====================================================
         */

        List<DispatchedItem> findByStatusAndChalaanNumber(
                        ItemDispatchStatus status,
                        String chalaanNumber);

        @Query("""
                            SELECT d
                            FROM DispatchedItem d
                            WHERE d.status = :status
                              AND d.chalaanNumber = :chalaanNumber
                              AND (
                                    d.plantCode IN :plantCodes
                                    OR d.plantCode IS NULL
                                    OR d.plantCode = ''
                                  )
                        """)
        List<DispatchedItem> findVisibleByStatusAndChalaanNumberIncludingLegacy(
                        @Param("status") ItemDispatchStatus status,

                        @Param("chalaanNumber") String chalaanNumber,

                        @Param("plantCodes") Collection<String> plantCodes);

        @Query("""
                            SELECT d
                            FROM DispatchedItem d
                            WHERE d.status = :status
                              AND d.chalaanNumber = :chalaanNumber
                              AND (
                                    d.plantCode IS NULL
                                    OR d.plantCode = ''
                                  )
                        """)
        List<DispatchedItem> findLegacyByStatusAndChalaanNumber(
                        @Param("status") ItemDispatchStatus status,

                        @Param("chalaanNumber") String chalaanNumber);

        List<DispatchedItem> findByLogisticsTripId(
                        UUID logisticsTripId);

        long countByLogisticsTripId(
                        UUID logisticsTripId);

        /*
         * =====================================================
         * DISPATCH / IMPORT CONCURRENCY LOCKS
         * =====================================================
         *
         * Critical lifecycle mutations lock selected Dispatch rows in a stable
         * primary-key order. This prevents two concurrent requests from both
         * validating the same READY row and dispatching it independently.
         */
        @Lock(LockModeType.PESSIMISTIC_WRITE)
        @Query("""
                            SELECT d
                            FROM DispatchedItem d
                            WHERE d.zohoItemId = :zohoItemId
                        """)
        Optional<DispatchedItem> findByIdForLifecycleUpdate(
                        @Param("zohoItemId") String zohoItemId);

        @Lock(LockModeType.PESSIMISTIC_WRITE)
        @Query("""
                            SELECT d
                            FROM DispatchedItem d
                            WHERE d.zohoItemId IN :zohoItemIds
                            ORDER BY d.zohoItemId ASC
                        """)
        List<DispatchedItem> findAllByIdForDispatchUpdate(
                        @Param("zohoItemIds") Collection<String> zohoItemIds);

        /*
         * =====================================================
         * ADMIN LIFECYCLE ROLLBACK LOCKS
         * =====================================================
         *
         * These methods must only be called from a normal writable
         * 
         * @Transactional service method.
         * =====================================================
         */

        @Lock(LockModeType.PESSIMISTIC_WRITE)
        @Query("""
                            SELECT d
                            FROM DispatchedItem d
                            WHERE d.packetItemId = :packetItemId
                        """)
        Optional<DispatchedItem> findByPacketItemIdForAdminRollback(
                        @Param("packetItemId") UUID packetItemId);

        /*
         * DispatchedItem primary key is zohoItemId.
         *
         * A custom JPQL query is required here because normal findById()
         * does not apply a pessimistic lock.
         */
        @Lock(LockModeType.PESSIMISTIC_WRITE)
        @Query("""
                            SELECT d
                            FROM DispatchedItem d
                            WHERE d.zohoItemId = :zohoItemId
                        """)
        Optional<DispatchedItem> findByIdForAdminRollback(
                        @Param("zohoItemId") String zohoItemId);

        /*
         * Final fallback for legacy records where packetItemId was not
         * populated but the active sticker still matches.
         */
        @Lock(LockModeType.PESSIMISTIC_WRITE)
        @Query("""
                            SELECT d
                            FROM DispatchedItem d
                            WHERE d.stickerNumber = :stickerNumber
                        """)
        Optional<DispatchedItem> findByStickerNumberForAdminRollback(
                        @Param("stickerNumber") String stickerNumber);

        /*
         * =====================================================
         * ADMIN DELETE
         * =====================================================
         */

        @Query("""
                            SELECT DISTINCT d
                            FROM DispatchedItem d
                            WHERE d.packetItemId IN :packetItemIds
                               OR d.zohoItemId IN :lookupIds
                        """)
        List<DispatchedItem> findForAdminDeletion(
                        @Param("packetItemIds") Collection<UUID> packetItemIds,

                        @Param("lookupIds") Collection<String> lookupIds);

        @Modifying(flushAutomatically = true, clearAutomatically = false)
        @Query("""
                            DELETE FROM DispatchedItem d
                            WHERE d.packetItemId IN :packetItemIds
                               OR d.zohoItemId IN :lookupIds
                        """)
        int deleteForAdminDeletion(
                        @Param("packetItemIds") Collection<UUID> packetItemIds,

                        @Param("lookupIds") Collection<String> lookupIds);

        /*
         * Complete Dispatch-page listing for plant-scoped users.
         *
         * No status condition is applied here because the React Dispatch page
         * already handles status filtering. This also keeps legacy rows whose
         * status is null.
         */
        @Query(value = """
                        SELECT d
                        FROM DispatchedItem d
                        WHERE (
                                d.plantCode IN :plantCodes
                                OR d.plantCode IS NULL
                                OR TRIM(d.plantCode) = ''
                        )
                        """, countQuery = """
                        SELECT COUNT(d)
                        FROM DispatchedItem d
                        WHERE (
                                d.plantCode IN :plantCodes
                                OR d.plantCode IS NULL
                                OR TRIM(d.plantCode) = ''
                        )
                        """)
        Page<DispatchedItem> findVisiblePageByPlantsIncludingLegacy(
                        @Param("plantCodes") Collection<String> plantCodes,
                        Pageable pageable);

        /*
         * Legacy rows visible to a user who has no assigned plants.
         */
        @Query(value = """
                        SELECT d
                        FROM DispatchedItem d
                        WHERE d.plantCode IS NULL
                           OR TRIM(d.plantCode) = ''
                        """, countQuery = """
                        SELECT COUNT(d)
                        FROM DispatchedItem d
                        WHERE d.plantCode IS NULL
                           OR TRIM(d.plantCode) = ''
                        """)
        Page<DispatchedItem> findLegacyVisiblePage(
                        Pageable pageable);

        List<DispatchedItem> findAllByZohoItemIdIn(
                        Collection<String> zohoItemIds);

        List<DispatchedItem> findAllByChalaanNumberIn(
                        Collection<String> challanNumbers);
}