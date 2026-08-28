package com.alsorg.packing.bomflow.repository;

import com.alsorg.packing.bomflow.domain.BomFlowRevision;
import com.alsorg.packing.bomflow.domain.BomFlowRevisionStatus;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface BomFlowRevisionRepository
        extends JpaRepository<BomFlowRevision, UUID> {

    interface ProductRevisionCount {
        UUID getProductId();
        long getRevisionCount();
    }

    @Query("""
            select r
            from BomFlowRevision r
            join fetch r.product p
            where p.id = :productId
            order by r.revisionNo desc
            """)
    List<BomFlowRevision> findByProductIdOrderByRevisionNoDesc(
            @Param("productId") UUID productId);

    Optional<BomFlowRevision> findTopByProductIdOrderByRevisionNoDesc(UUID productId);

    Optional<BomFlowRevision> findTopByProductIdAndStatusInOrderByRevisionNoDesc(
            UUID productId,
            Collection<BomFlowRevisionStatus> statuses);

    long countByProductId(UUID productId);

    @Query("""
            select r
            from BomFlowRevision r
            join fetch r.product p
            where p.id in :productIds
              and r.revisionNo = (
                    select max(r2.revisionNo)
                    from BomFlowRevision r2
                    where r2.product.id = p.id
                  )
            """)
    List<BomFlowRevision> findLatestByProductIds(
            @Param("productIds") Collection<UUID> productIds);

    @Query("""
            select r.product.id as productId,
                   count(r) as revisionCount
            from BomFlowRevision r
            where r.product.id in :productIds
            group by r.product.id
            """)
    List<ProductRevisionCount> countByProductIds(
            @Param("productIds") Collection<UUID> productIds);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select r
            from BomFlowRevision r
            join fetch r.product
            where r.id = :id
            """)
    Optional<BomFlowRevision> findByIdForUpdate(@Param("id") UUID id);

    @Query("""
            select r
            from BomFlowRevision r
            join fetch r.product
            where r.id = :id
            """)
    Optional<BomFlowRevision> findByIdWithProduct(@Param("id") UUID id);
}
