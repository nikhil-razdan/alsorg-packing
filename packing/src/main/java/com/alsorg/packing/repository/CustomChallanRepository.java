package com.alsorg.packing.repository;

import com.alsorg.packing.domain.dispatch.CustomChallan;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CustomChallanRepository extends JpaRepository<CustomChallan, String> {

    List<CustomChallan> findAllByOrderByGeneratedAtDesc();
}