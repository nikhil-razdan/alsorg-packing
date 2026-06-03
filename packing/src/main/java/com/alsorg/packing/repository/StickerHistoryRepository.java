package com.alsorg.packing.repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import com.alsorg.packing.controller.dto.StickerHistoryResponse;
import com.alsorg.packing.domain.sticker.StickerHistory;
import org.springframework.data.repository.query.Param;
import com.alsorg.packing.controller.dto.GeneratedPacketHistoryResponse;

public interface StickerHistoryRepository
        extends JpaRepository<StickerHistory, UUID> {

	@Query("""
		    SELECT new com.alsorg.packing.controller.dto.GeneratedPacketHistoryResponse(
		        h.id,
		        h.packetItem.id,
		        h.stickerNumber,
		        h.printIteration,
		        h.reason,
		        h.generatedAt,
		        h.generatedBy,
		        h.packetItem.itemName,
		        h.packetItem.sku,
		        h.packetItem.pdNo,
		        h.packetItem.drawingNo,
		        h.packetItem.clientName,
		        h.packetItem.description,
		        h.packetItem.packetNumber,
		        h.packetItem.floor,
		        h.packetItem.weight,
		        h.packetItem.dimensions,
		        h.packetItem.remarks
		    )
		    FROM StickerHistory h
		    WHERE h.packetItem IS NOT NULL
		    ORDER BY h.generatedAt DESC
		""")
		List<GeneratedPacketHistoryResponse> findGeneratedPacketHistoryAll();


		@Query("""
		    SELECT new com.alsorg.packing.controller.dto.GeneratedPacketHistoryResponse(
		        h.id,
		        h.packetItem.id,
		        h.stickerNumber,
		        h.printIteration,
		        h.reason,
		        h.generatedAt,
		        h.generatedBy,
		        h.packetItem.itemName,
		        h.packetItem.sku,
		        h.packetItem.pdNo,
		        h.packetItem.drawingNo,
		        h.packetItem.clientName,
		        h.packetItem.description,
		        h.packetItem.packetNumber,
		        h.packetItem.floor,
		        h.packetItem.weight,
		        h.packetItem.dimensions,
		        h.packetItem.remarks
		    )
		    FROM StickerHistory h
		    WHERE h.packetItem IS NOT NULL
		      AND LOWER(h.generatedBy) = LOWER(:generatedBy)
		    ORDER BY h.generatedAt DESC
		""")
		List<GeneratedPacketHistoryResponse> findGeneratedPacketHistoryByUser(
		        @Param("generatedBy") String generatedBy
		);


		@Query("""
		    SELECT DISTINCT h.generatedBy
		    FROM StickerHistory h
		    WHERE h.generatedBy IS NOT NULL
		      AND h.generatedBy <> ''
		    ORDER BY h.generatedBy ASC
		""")
		List<String> findDistinctGeneratedByUsers();
    
    
    List<StickerHistoryResponse>
    findHistoryByItemId(UUID itemId);
    long countByGeneratedAtBetween(
            LocalDateTime start,
            LocalDateTime end
    );
    Optional<StickerHistory> findTopByStickerNumberOrderByGeneratedAtDesc(String stickerNumber);
    
}