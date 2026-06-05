package com.alsorg.packing.repository;

import com.alsorg.packing.domain.item.PacketItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.Collection;

public interface PacketItemRepository extends JpaRepository<PacketItem, UUID> {

    List<PacketItem> findByPacketId(UUID packetId);

    Optional<PacketItem> findBySku(String sku);

    Optional<PacketItem> findByZohoItemId(String zohoItemId);
    
    Optional<PacketItem> findByStickerNumber(String stickerNumber);
    
    List<PacketItem> findByPlantCodeIn(Collection<String> plantCodes);

    List<PacketItem> findByPlantCodeIsNull();
    
    boolean existsByMasterItemIdAndPacketNumber(UUID masterItemId, String packetNumber);
    
    long countByMasterItemId(UUID masterItemId);
    
    @Query("""
    	    SELECT COUNT(p) > 0
    	    FROM PacketItem p
    	    WHERE p.sku IS NOT NULL
    	      AND LOWER(TRIM(p.sku)) = LOWER(TRIM(:sku))
    	""")
    	boolean existsSkuAlready(
    	        @Param("sku") String sku
    	);

    	@Query("""
    	    SELECT COUNT(p) > 0
    	    FROM PacketItem p
    	    WHERE p.sku IS NOT NULL
    	      AND LOWER(TRIM(p.sku)) = LOWER(TRIM(:sku))
    	      AND p.id <> :itemId
    	""")
    	boolean existsSkuAlreadyForOtherItem(
    	        @Param("sku") String sku,
    	        @Param("itemId") UUID itemId
    	);
    	
    	@Query("""
    		    SELECT p
    		    FROM PacketItem p
    		    WHERE p.plantCode IN :plantCodes
    		       OR p.plantCode IS NULL
    		       OR p.plantCode = ''
    		""")
    		List<PacketItem> findVisibleByPlantsIncludingLegacy(
    		        @Param("plantCodes") Collection<String> plantCodes
    		);
}
