package com.alsorg.packing.service;

import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;

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

    public List<Driver> getAll() {
        return repository.findAll();
    }

    public Driver create(
            Driver driver
    ) {
        return repository.save(driver);
    }

    public void delete(UUID id) {
        repository.deleteById(id);
    }
}