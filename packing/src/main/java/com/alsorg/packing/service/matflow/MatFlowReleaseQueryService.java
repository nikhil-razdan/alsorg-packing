package com.alsorg.packing.service.matflow;

import com.alsorg.packing.controller.dto.matflow.MatFlowReleaseDtos.MatFlowAuditResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowReleaseDtos.MatFlowReleaseDetailResponse;

import com.alsorg.packing.domain.matflow.MatFlowLine;
import com.alsorg.packing.domain.matflow.MatFlowRelease;

import com.alsorg.packing.repository.matflow.MatFlowLineRepository;
import com.alsorg.packing.repository.matflow.MatFlowReleaseRepository;

import org.springframework.http.HttpStatus;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class MatFlowReleaseQueryService {

    private final MatFlowReleaseRepository releaseRepo;
    private final MatFlowLineRepository lineRepo;

    private final MatFlowAccessService access;
    private final MatFlowReleaseMapper mapper;
    private final MatFlowAuditService auditService;

    public MatFlowReleaseQueryService(
            MatFlowReleaseRepository releaseRepo,
            MatFlowLineRepository lineRepo,
            MatFlowAccessService access,
            MatFlowReleaseMapper mapper,
            MatFlowAuditService auditService) {

        this.releaseRepo = releaseRepo;

        this.lineRepo = lineRepo;

        this.access = access;

        this.mapper = mapper;

        this.auditService = auditService;
    }

    public MatFlowReleaseDetailResponse get(
            UUID releaseId) {

        access.requireMatFlowAccess();

        MatFlowRelease release = releaseRepo
                .findById(releaseId)
                .orElseThrow(() -> notFound(
                        "MatFlow release not found."));

        access.assertPlantAccess(
                release.plantCode);

        List<MatFlowLine> lines = lineRepo
                .findByReleaseIdOrderBySourceLineNoAsc(
                        release.id);

        return mapper.toDetailResponse(
                release,
                lines);
    }

    public MatFlowReleaseDetailResponse getBySourceRevision(
            UUID revisionId) {

        access.requireMatFlowAccess();

        MatFlowRelease release = releaseRepo
                .findBySourceRevisionId(
                        revisionId)
                .orElseThrow(() -> notFound(
                        "No MatFlow release exists "
                                + "for this BOM revision."));

        access.assertPlantAccess(
                release.plantCode);

        List<MatFlowLine> lines = lineRepo
                .findByReleaseIdOrderBySourceLineNoAsc(
                        release.id);

        return mapper.toDetailResponse(
                release,
                lines);
    }

    public List<MatFlowReleaseDetailResponse> listBySourceBom(
            UUID sourceBomId) {

        access.requireMatFlowAccess();

        List<MatFlowRelease> releases = releaseRepo
                .findBySourceBomIdOrderBySourceRevisionNoDesc(
                        sourceBomId);

        return releases.stream()
                .map(release -> {
                    access.assertPlantAccess(
                            release.plantCode);

                    List<MatFlowLine> lines = lineRepo
                            .findByReleaseIdOrderBySourceLineNoAsc(
                                    release.id);

                    return mapper.toDetailResponse(
                            release,
                            lines);
                })
                .toList();
    }

    public List<MatFlowAuditResponse> audit(
            UUID releaseId) {

        /*
         * get() validates release existence and plant access.
         */
        get(releaseId);

        return auditService.list(
                releaseId);
    }

    private ResponseStatusException notFound(
            String message) {

        return new ResponseStatusException(
                HttpStatus.NOT_FOUND,
                message);
    }
}