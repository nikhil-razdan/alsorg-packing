package com.alsorg.packing.repository.matflow;

import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.LocationType;
import com.alsorg.packing.domain.matflow.MatFlowStockBalance;

import jakarta.persistence.LockModeType;
import java.util.EnumSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MatFlowStockBalanceRepository
        extends JpaRepository<MatFlowStockBalance, UUID> {

    Optional<MatFlowStockBalance> findByMaterial_IdAndLocation_Id(
            UUID materialId,
            UUID locationId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select s
            from MatFlowStockBalance s
            where s.material.id = :materialId
              and s.location.id = :locationId
            """)
    Optional<MatFlowStockBalance> lockBalance(
            @Param("materialId") UUID materialId,
            @Param("locationId") UUID locationId);

    @Query("""
            select s
            from MatFlowStockBalance s
            where s.location.plantCode in :plantCodes
            order by s.location.plantCode,
                     s.location.locationCode,
                     s.material.materialCode
            """)
    List<MatFlowStockBalance> findVisibleBalances(
            @Param("plantCodes") Set<String> plantCodes);

    @Query("""
            select s
            from MatFlowStockBalance s
            where s.material.id = :materialId
              and s.location.plantCode in :plantCodes
              and s.location.locationType in :locationTypes
              and s.location.active = true
              and s.location.supportsStock = true
            """)
    List<MatFlowStockBalance> findPlanningCandidates(
            @Param("materialId") UUID materialId,

            @Param("plantCodes") Set<String> plantCodes,

            @Param("locationTypes") Set<LocationType> locationTypes);
}