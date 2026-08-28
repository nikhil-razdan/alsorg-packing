package com.alsorg.packing.repository.matflow;

import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.LocationType;
import com.alsorg.packing.domain.matflow.MatFlowStockBalance;

import jakarta.persistence.LockModeType;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
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
            select balance
            from MatFlowStockBalance balance
            join fetch balance.material material
            join fetch balance.location location
            where material.id = :materialId
              and location.id = :locationId
            """)
    Optional<MatFlowStockBalance> lockBalance(
            @Param("materialId") UUID materialId,
            @Param("locationId") UUID locationId);

    @Query("""
            select balance
            from MatFlowStockBalance balance
            join fetch balance.material material
            join fetch balance.location location
            where upper(location.plantCode) in :plantCodes
            order by location.plantCode asc,
                     location.locationCode asc,
                     material.materialCode asc,
                     balance.id asc
            """)
    List<MatFlowStockBalance> findVisibleBalances(
            @Param("plantCodes") Set<String> plantCodes);

    @Query(value = """
            select balance
            from MatFlowStockBalance balance
            join fetch balance.material material
            join fetch balance.location location
            where upper(location.plantCode) in :plantCodes
            order by location.plantCode asc,
                     location.locationCode asc,
                     material.materialCode asc,
                     balance.id asc
            """, countQuery = """
            select count(balance)
            from MatFlowStockBalance balance
            join balance.location location
            where upper(location.plantCode) in :plantCodes
            """)
    Page<MatFlowStockBalance> findVisibleBalances(
            @Param("plantCodes") Set<String> plantCodes,
            Pageable pageable);

    @Query("""
            select balance
            from MatFlowStockBalance balance
            join fetch balance.material material
            join fetch balance.location location
            where material.id = :materialId
              and upper(location.plantCode) in :plantCodes
              and location.locationType in :locationTypes
              and location.active = true
              and location.supportsStock = true
            order by location.plantCode asc,
                     location.locationCode asc,
                     balance.id asc
            """)
    List<MatFlowStockBalance> findPlanningCandidates(
            @Param("materialId") UUID materialId,
            @Param("plantCodes") Set<String> plantCodes,
            @Param("locationTypes") Set<LocationType> locationTypes);
}
