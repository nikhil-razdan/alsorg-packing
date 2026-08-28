package com.alsorg.packing.repository;

import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.alsorg.packing.domain.files.PodFile;

public interface PodFileRepository extends JpaRepository<PodFile, UUID> {
}
