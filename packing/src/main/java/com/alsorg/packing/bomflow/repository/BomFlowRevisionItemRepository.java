package com.alsorg.packing.bomflow.repository;

import com.alsorg.packing.bomflow.domain.BomFlowRevisionItem;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface BomFlowRevisionItemRepository
        extends JpaRepository<BomFlowRevisionItem, UUID> {

    interface RevisionItemAggregate {
        UUID getRevisionId();
        long getItemCount();
        BigDecimal getTotalAmount();
    }

    List<BomFlowRevisionItem> findByRevisionIdOrderByLineNoAsc(UUID revisionId);

    Optional<BomFlowRevisionItem> findByIdAndRevisionId(UUID id, UUID revisionId);

    Optional<BomFlowRevisionItem> findTopByRevisionIdOrderByLineNoDesc(UUID revisionId);

    long countByRevisionId(UUID revisionId);

    @Query("""
            select i.revision.id as revisionId,
                   count(i) as itemCount,
                   sum(i.amount) as totalAmount
            from BomFlowRevisionItem i
            where i.revision.id in :revisionIds
            group by i.revision.id
            """)
    List<RevisionItemAggregate> aggregateByRevisionIds(
            @Param("revisionIds") Collection<UUID> revisionIds);
}
