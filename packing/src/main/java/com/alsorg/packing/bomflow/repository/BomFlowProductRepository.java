package com.alsorg.packing.bomflow.repository;

import com.alsorg.packing.bomflow.domain.BomFlowProduct;

import jakarta.persistence.LockModeType;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface BomFlowProductRepository
        extends JpaRepository<BomFlowProduct, UUID> {

    Optional<BomFlowProduct> findByProductCodeIgnoreCase(String productCode);

    boolean existsByProductCodeIgnoreCase(String productCode);

    boolean existsByProductCodeIgnoreCaseAndIdNot(String productCode, UUID id);

    @Query("""
            select p
            from BomFlowProduct p
            where (
                    :q is null
                    or :q = ''
                    or lower(coalesce(p.productName, '')) like lower(concat('%', :q, '%'))
                    or lower(coalesce(p.productCode, '')) like lower(concat('%', :q, '%'))
                    or lower(coalesce(p.drawingNumber, '')) like lower(concat('%', :q, '%'))
                    or lower(coalesce(p.category, '')) like lower(concat('%', :q, '%'))
                    or lower(coalesce(p.collection, '')) like lower(concat('%', :q, '%'))
                    or lower(coalesce(p.projectReference, '')) like lower(concat('%', :q, '%'))
                    or lower(coalesce(p.clientEntity, '')) like lower(concat('%', :q, '%'))
                  )
            order by p.updatedAt desc, p.productName asc, p.id asc
            """)
    List<BomFlowProduct> search(
            @Param("q") String q,
            Pageable pageable);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select p
            from BomFlowProduct p
            where p.id = :id
            """)
    Optional<BomFlowProduct> findByIdForUpdate(@Param("id") UUID id);
}
