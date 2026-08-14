package com.alsorg.packing.repository.matflow;

import com.alsorg.packing.domain.matflow.MatFlowMaterialReturn;

import jakarta.persistence.LockModeType;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MatFlowMaterialReturnRepository extends JpaRepository<MatFlowMaterialReturn, UUID> {

    List<MatFlowMaterialReturn> findAllByOrderByUpdatedAtDesc();

    @EntityGraph(attributePaths = { "requisition", "fromLocation", "viaLocation", "toLocation" })
    @Query("""
            select materialReturn
            from MatFlowMaterialReturn materialReturn
            where materialReturn.id = :id
            """)
    Optional<MatFlowMaterialReturn> findDetailById(@Param("id") UUID id);

    /**
     * Serializes dispatch/receipt transitions for one return document so two
     * operators cannot advance the same custody leg concurrently.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @EntityGraph(attributePaths = { "requisition", "fromLocation", "viaLocation", "toLocation" })
    @Query("""
            select materialReturn
            from MatFlowMaterialReturn materialReturn
            where materialReturn.id = :id
            """)
    Optional<MatFlowMaterialReturn> lockDetailById(@Param("id") UUID id);
}
