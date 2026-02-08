package com.alsorg.packing.repository;

import com.alsorg.packing.domain.common.Company;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface CompanyRepository extends JpaRepository<Company, UUID> {

    Optional<Company> findByCode(String code);
}
