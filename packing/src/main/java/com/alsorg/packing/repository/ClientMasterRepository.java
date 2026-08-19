package com.alsorg.packing.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.alsorg.packing.domain.client.ClientMaster;

public interface ClientMasterRepository extends JpaRepository<ClientMaster, UUID> {

    Optional<ClientMaster> findByNormalizedName(String normalizedName);

    boolean existsByNormalizedName(String normalizedName);

    long countByActiveTrue();

    long countByActiveFalse();

    Page<ClientMaster> findByNameContainingIgnoreCase(
            String name,
            Pageable pageable);

    Page<ClientMaster> findByActiveAndNameContainingIgnoreCase(
            boolean active,
            String name,
            Pageable pageable);

    @Query("""
            select client
            from ClientMaster client
            where client.active = true
              and client.normalizedName like concat('%', :query, '%')
            order by client.name asc
            """)
    List<ClientMaster> searchActive(
            @Param("query") String query,
            Pageable pageable);
}
