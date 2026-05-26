package com.alsorg.packing.service;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.alsorg.packing.domain.logistics.Driver;
import com.alsorg.packing.repository.DriverRepository;

@Service
public class DriverService {

    private final DriverRepository repository;

    public DriverService(
            DriverRepository repository
    ) {
        this.repository = repository;
    }

    /*
     * CREATE DRIVER
     */

    @Transactional
    public Driver create(Driver driver) {

        if (repository.existsByNameIgnoreCase(
                driver.getName()
        )) {
            throw new RuntimeException(
                    "Driver already exists"
            );
        }

        return repository.save(driver);
    }

    /*
     * GET ALL
     */

    public List<Driver> getAll() {
        return repository.findAll();
    }

    /*
     * DELETE
     */

    @Transactional
    public void delete(java.util.UUID id) {

        Driver driver = repository.findById(id)
                .orElseThrow(() ->
                        new RuntimeException(
                                "Driver not found"
                        ));

        repository.delete(driver);
    }
}