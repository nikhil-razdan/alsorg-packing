package com.alsorg.packing.service;

import java.util.Comparator;
import java.util.List;
import java.util.UUID;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.alsorg.packing.domain.logistics.Driver;
import com.alsorg.packing.repository.DriverRepository;

@Service
public class DriverService {

    private final DriverRepository repository;

    public DriverService(
            DriverRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public List<Driver> getAll() {
        return repository
                .findAll()
                .stream()
                .sorted(
                        Comparator.comparing(
                                driver -> safeSortValue(
                                        driver.getName()),
                                String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    @Transactional
    public Driver create(
            Driver driver) {

        if (driver == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Driver request is required");
        }

        String cleanName = cleanName(driver.getName());

        if (cleanName == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Driver name is required");
        }

        if (cleanName.length() > 150) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Driver name cannot exceed 150 characters");
        }

        if (repository
                .existsByNameIgnoreCase(
                        cleanName)) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Driver already exists: " +
                            cleanName);
        }

        driver.setName(cleanName);

        try {
            return repository.saveAndFlush(driver);
        } catch (DataIntegrityViolationException exception) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Driver already exists or conflicts with an existing driver",
                    exception);
        }
    }

    @Transactional
    public void delete(
            UUID id) {

        if (id == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Driver id is required");
        }

        Driver driver = repository
                .findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Driver not found"));

        try {
            repository.delete(driver);
            repository.flush();
        } catch (DataIntegrityViolationException exception) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Driver cannot be deleted because it is still used by logistics records",
                    exception);
        }
    }

    private String cleanName(
            String value) {

        if (value == null) {
            return null;
        }

        String clean = value.trim()
                .replaceAll(
                        "\\s+",
                        " ");

        return clean.isBlank()
                ? null
                : clean;
    }

    private String safeSortValue(
            String value) {

        return value == null
                ? ""
                : value.trim();
    }
}