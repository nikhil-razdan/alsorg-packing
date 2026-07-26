package com.alsorg.packing.service.matflow;

import com.alsorg.packing.domain.matflow.MatFlowPurchaseOrderSequence;
import com.alsorg.packing.repository.matflow.MatFlowPurchaseOrderSequenceRepository;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Year;
import java.util.Locale;

@Service
public class MatFlowPurchaseOrderNumberService {

    private final MatFlowPurchaseOrderSequenceRepository sequenceRepo;

    public MatFlowPurchaseOrderNumberService(
            MatFlowPurchaseOrderSequenceRepository sequenceRepo) {

        this.sequenceRepo = sequenceRepo;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public String nextPoNo(
            String plantCode) {

        String normalizedPlant =
                normalizePlantCode(plantCode);

        Integer year =
                Year.now().getValue();

        sequenceRepo.ensureSequenceExists(
                normalizedPlant,
                year
        );

        MatFlowPurchaseOrderSequence sequence =
                sequenceRepo.findForUpdate(
                                normalizedPlant,
                                year
                        )
                        .orElseThrow(() ->
                                new ResponseStatusException(
                                        HttpStatus.INTERNAL_SERVER_ERROR,
                                        "Unable to initialize Purchase Order "
                                                + "number sequence."
                                )
                        );

        long nextValue =
                sequence.currentValue == null
                        ? 1L
                        : sequence.currentValue + 1L;

        sequence.currentValue =
                nextValue;

        sequenceRepo.saveAndFlush(
                sequence
        );

        return String.format(
                Locale.ROOT,
                "MPO-%s-%d-%06d",
                normalizedPlant,
                year,
                nextValue
        );
    }

    private String normalizePlantCode(
            String value) {

        if (value == null
                || value.isBlank()) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Plant Code is required."
            );
        }

        String normalized =
                value.trim()
                        .toUpperCase(Locale.ROOT)
                        .replaceAll(
                                "[^A-Z0-9]",
                                ""
                        );

        if (normalized.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Plant Code is invalid."
            );
        }

        return normalized;
    }
}