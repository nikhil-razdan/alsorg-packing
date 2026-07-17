package com.alsorg.packing.repository;

import com.alsorg.packing.domain.venflow.VenFlowEntry;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface VenFlowEntryRepository
                extends JpaRepository<VenFlowEntry, UUID>,
                JpaSpecificationExecutor<VenFlowEntry> {

        @Lock(LockModeType.PESSIMISTIC_WRITE)
        @Query("""
                        select e
                        from VenFlowEntry e
                        where e.id = :id
                        """)
        Optional<VenFlowEntry> findByIdForUpdate(
                        @Param("id") UUID id);
}