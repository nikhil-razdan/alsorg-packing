package com.alsorg.packing.repository;

import com.alsorg.packing.domain.dispatch.CustomChallan;

import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CustomChallanRepository
        extends JpaRepository<CustomChallan, String> {

    List<CustomChallan> findAllByOrderByGeneratedAtDesc();

    Page<CustomChallan> findAllByOrderByGeneratedAtDesc(Pageable pageable);
}
