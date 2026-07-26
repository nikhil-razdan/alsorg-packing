package com.alsorg.packing.repository.matflow;

import com.alsorg.packing.domain.matflow.MatFlowVendorQuote;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MatFlowVendorQuoteRepository
        extends JpaRepository<MatFlowVendorQuote, UUID> {

    List<MatFlowVendorQuote> findByIndentIdOrderByGrandTotalAscCreatedAtAsc(
            UUID indentId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select quote
            from MatFlowVendorQuote quote
            where quote.id = :quoteId
            """)
    Optional<MatFlowVendorQuote> findByIdForUpdate(
            @Param("quoteId") UUID quoteId);
}