package com.alsorg.packing.repository;

import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.alsorg.packing.domain.logistics.Driver;

public interface DriverRepository
        extends JpaRepository<Driver, UUID> {
}