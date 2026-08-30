package com.alsorg.packing.repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.alsorg.packing.domain.site.PacketSiteEvidence;
import com.alsorg.packing.domain.site.SiteEvidenceStage;

public interface PacketSiteEvidenceRepository extends JpaRepository<PacketSiteEvidence, UUID> {

    List<PacketSiteEvidence> findByLifecycleIdOrderByStageAscOrdinalAsc(UUID lifecycleId);

    long countByLifecycleIdAndStage(UUID lifecycleId, SiteEvidenceStage stage);

    @Query("""
            SELECT e.lifecycleId, e.stage, COUNT(e)
            FROM PacketSiteEvidence e
            WHERE e.lifecycleId IN :lifecycleIds
            GROUP BY e.lifecycleId, e.stage
            """)
    List<Object[]> countByLifecycleIdsGrouped(
            @Param("lifecycleIds") Collection<UUID> lifecycleIds);

    @Query("""
            SELECT e.lifecycleId, e.id
            FROM PacketSiteEvidence e
            WHERE e.lifecycleId IN :lifecycleIds
            ORDER BY e.lifecycleId, e.stage, e.ordinal
            """)
    List<Object[]> findEvidenceIdsByLifecycleIds(
            @Param("lifecycleIds") Collection<UUID> lifecycleIds);
}
