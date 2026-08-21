package com.alsorg.packing.bomflow.repository;

import com.alsorg.packing.bomflow.domain.BomFlowProduct;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface BomFlowProductRepository
        extends JpaRepository<BomFlowProduct, UUID> {

    Optional<BomFlowProduct> findByProductCodeIgnoreCase(
            String productCode);

    boolean existsByProductCodeIgnoreCase(
            String productCode);

    boolean existsByProductCodeIgnoreCaseAndIdNot(
            String productCode,
            UUID id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select p
            from BomFlowProduct p
            where p.id = :id
            """)
    Optional<BomFlowProduct> findByIdForUpdate(
            @Param("id") UUID id);
}
