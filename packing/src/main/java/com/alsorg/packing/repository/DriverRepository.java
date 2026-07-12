package com.alsorg.packing.repository;

import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.alsorg.packing.domain.logistics.Driver;

@Repository
public interface DriverRepository
        extends JpaRepository<Driver, UUID> {

    boolean existsByNameIgnoreCase(
            String name);
}