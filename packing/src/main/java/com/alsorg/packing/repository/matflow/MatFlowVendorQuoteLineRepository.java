package com.alsorg.packing.repository.matflow;

import com.alsorg.packing.domain.matflow.MatFlowVendorQuoteLine;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MatFlowVendorQuoteLineRepository
        extends JpaRepository<MatFlowVendorQuoteLine, UUID> {

    List<MatFlowVendorQuoteLine> findByQuoteIdAndActiveTrueOrderBySourceLineNoAsc(
            UUID quoteId);

    Optional<MatFlowVendorQuoteLine> findByQuoteIdAndIndentLineIdAndActiveTrue(
            UUID quoteId,
            UUID indentLineId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select line
            from MatFlowVendorQuoteLine line
            where line.id = :lineId
              and line.quoteId = :quoteId
              and line.active = true
            """)
    Optional<MatFlowVendorQuoteLine> findActiveLineForUpdate(
            @Param("quoteId") UUID quoteId,
            @Param("lineId") UUID lineId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select line
            from MatFlowVendorQuoteLine line
            where line.quoteId = :quoteId
              and line.active = true
            order by line.sourceLineNo asc
            """)
    List<MatFlowVendorQuoteLine> findActiveByQuoteIdForUpdate(
            @Param("quoteId") UUID quoteId);
}