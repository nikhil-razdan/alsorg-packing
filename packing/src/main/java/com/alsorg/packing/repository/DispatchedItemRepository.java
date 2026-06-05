package com.alsorg.packing.repository;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.alsorg.packing.domain.common.ApprovalStatus;
import com.alsorg.packing.domain.common.ItemDispatchStatus;
import com.alsorg.packing.domain.dispatch.DispatchedItem;
import java.util.Collection;
import java.util.List;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.alsorg.packing.domain.common.ItemDispatchStatus;
import com.alsorg.packing.domain.dispatch.DispatchedItem;

@Repository
public interface DispatchedItemRepository extends JpaRepository<DispatchedItem, String> {

    // ===================== STATUS =====================

    List<DispatchedItem> findByStatus(ItemDispatchStatus status);

    List<DispatchedItem> findByStatusIn(List<ItemDispatchStatus> statuses);

    long countByStatus(ItemDispatchStatus status);
    long countByStatusIn(List<ItemDispatchStatus> statuses);
    Optional<DispatchedItem> findBySku(String sku);
    Optional<DispatchedItem> findByName(String name);
    
    Optional<DispatchedItem> findByPacketItemId(UUID packetItemId);

    Optional<DispatchedItem> findByStickerNumber(String stickerNumber);
    // ===================== APPROVAL =====================

    List<DispatchedItem> findByApprovalStatus(ApprovalStatus status);
    List<DispatchedItem> findByGatePassNumber(String gatePassNumber);
    List<DispatchedItem> findByStatusAndApprovalStatus(
            ItemDispatchStatus status,
            ApprovalStatus approvalStatus
    );

    long countByStatusIn(Collection<ItemDispatchStatus> statuses);

    long countByStatusAndDispatchedAtBetween(
            ItemDispatchStatus status,
            LocalDateTime start,
            LocalDateTime end
    );
    // ===================== EXISTS =====================

    boolean existsByZohoItemId(String zohoItemId);
    
    List<DispatchedItem> findByStatusInAndPlantCodeIn(
            List<ItemDispatchStatus> statuses,
            Collection<String> plantCodes
    );

    List<DispatchedItem> findByStatusAndPlantCodeIn(
            ItemDispatchStatus status,
            Collection<String> plantCodes
    );
    
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
    	        @Param("plantCodes") Collection<String> plantCodes
    	);
}
