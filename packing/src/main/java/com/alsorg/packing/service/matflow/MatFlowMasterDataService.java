package com.alsorg.packing.service.matflow;

import static com.alsorg.packing.controller.dto.matflow.MatFlowMasterDtos.*;

import com.alsorg.packing.domain.matflow.MatFlowMaterial;
import com.alsorg.packing.repository.matflow.MatFlowMaterialRepository;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class MatFlowMasterDataService {
    private final MatFlowMaterialRepository materialRepository;
    private final MatFlowAccessService accessService;

    public MatFlowMasterDataService(MatFlowMaterialRepository materialRepository, MatFlowAccessService accessService) {
        this.materialRepository = materialRepository;
        this.accessService = accessService;
    }

    @Transactional(readOnly = true)
    public List<MaterialResponse> materials(String search, Boolean active) {
        accessService.requireRead();
        String q = clean(search).toLowerCase(Locale.ROOT);
        return materialRepository.findAllByOrderByMaterialNameAsc().stream()
                .filter(row -> active == null || row.isActive() == active)
                .filter(row -> q.isBlank() || contains(row.getMaterialCode(), q) || contains(row.getMaterialName(), q)
                        || contains(row.getCategory(), q) || contains(row.getSpecification(), q))
                .map(this::toResponse).toList();
    }

    @Transactional
    public MaterialResponse createMaterial(MaterialRequest request) {
        accessService.requireMasterWrite();
        String code = upper(request.materialCode());
        if (materialRepository.existsByMaterialCodeIgnoreCase(code)) throw conflict("Material code already exists: " + code);
        MatFlowMaterial row = new MatFlowMaterial();
        apply(row, request);
        row.setCreatedBy(accessService.actor()); row.setUpdatedBy(accessService.actor());
        return toResponse(materialRepository.save(row));
    }

    @Transactional
    public MaterialResponse updateMaterial(UUID id, MaterialRequest request) {
        accessService.requireMasterWrite();
        MatFlowMaterial row = materialRepository.findById(id).orElseThrow(() -> notFound("Material not found"));
        requireVersion(row.getRowVersion(), request.rowVersion());
        String code = upper(request.materialCode());
        if (materialRepository.existsByMaterialCodeIgnoreCaseAndIdNot(code, id)) throw conflict("Material code already exists: " + code);
        apply(row, request); row.setUpdatedBy(accessService.actor());
        return toResponse(materialRepository.save(row));
    }

    private void apply(MatFlowMaterial row, MaterialRequest request) {
        row.setMaterialCode(request.materialCode()); row.setMaterialName(request.materialName()); row.setCategory(request.category());
        row.setSpecification(request.specification()); row.setUom(request.uom());
        if (request.active() != null) row.setActive(request.active());
    }

    private MaterialResponse toResponse(MatFlowMaterial row) {
        return new MaterialResponse(row.getId(), row.getMaterialCode(), row.getMaterialName(), row.getCategory(),
                row.getSpecification(), row.getUom(), row.isActive(), row.getRowVersion(), row.getUpdatedAt());
    }

    private void requireVersion(Long actual, Long supplied) {
        if (supplied == null || !supplied.equals(actual)) throw conflict("Record changed. Refresh and retry.");
    }
    private boolean contains(String value, String q) { return value != null && value.toLowerCase(Locale.ROOT).contains(q); }
    private String clean(String value) { return value == null ? "" : value.trim(); }
    private String upper(String value) { return clean(value).toUpperCase(Locale.ROOT); }
    private ResponseStatusException notFound(String m) { return new ResponseStatusException(HttpStatus.NOT_FOUND, m); }
    private ResponseStatusException conflict(String m) { return new ResponseStatusException(HttpStatus.CONFLICT, m); }
}
