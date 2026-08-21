package com.alsorg.packing.bomflow.repository;

import com.alsorg.packing.bomflow.domain.BomFlowRevisionItem;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface BomFlowRevisionItemRepository
        extends JpaRepository<BomFlowRevisionItem, UUID> {

    List<BomFlowRevisionItem> findByRevisionIdOrderByLineNoAsc(
            UUID revisionId);

    Optional<BomFlowRevisionItem> findByIdAndRevisionId(
            UUID id,
            UUID revisionId);

    Optional<BomFlowRevisionItem> findTopByRevisionIdOrderByLineNoDesc(
            UUID revisionId);

    long countByRevisionId(
            UUID revisionId);
}
