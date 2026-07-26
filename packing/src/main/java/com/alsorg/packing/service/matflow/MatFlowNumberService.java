package com.alsorg.packing.service.matflow;

import com.alsorg.packing.domain.matflow.MatFlowRequisitionSequence;
import com.alsorg.packing.repository.matflow.MatFlowRequisitionSequenceRepository;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Year;
import java.util.Locale;

@Service
public class MatFlowNumberService {

    private final MatFlowRequisitionSequenceRepository sequenceRepo;

    public MatFlowNumberService(
            MatFlowRequisitionSequenceRepository sequenceRepo) {

        this.sequenceRepo = sequenceRepo;
    }

    /*
     * This method must be called from an existing transaction.
     *
     * MatFlowRequisitionService.createDraft() is already
     * transactional, so Propagation.MANDATORY is correct.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public String nextRequisitionNo() {

        Integer year = Year.now().getValue();

        sequenceRepo.ensureYearExists(year);

        MatFlowRequisitionSequence sequence = sequenceRepo.findByYearForUpdate(year)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.INTERNAL_SERVER_ERROR,
                        "Unable to initialize MatFlow "
                                + "requisition number sequence."));

        long nextValue = sequence.currentValue == null
                ? 1L
                : sequence.currentValue + 1L;

        sequence.currentValue = nextValue;

        sequenceRepo.saveAndFlush(sequence);

        return String.format(
                Locale.ROOT,
                "MREQ-%d-%06d",
                year,
                nextValue);
    }
}