package com.alsorg.packing.repository.matflow;

import com.alsorg.packing.domain.matflow.MatFlowProjectDrawing;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MatFlowProjectDrawingRepository extends JpaRepository<MatFlowProjectDrawing, UUID> {
    List<MatFlowProjectDrawing> findByProject_IdOrderByCreatedAtAsc(UUID projectId);
    boolean existsByProject_IdAndDrawingNoIgnoreCase(UUID projectId, String drawingNo);
    boolean existsByProject_IdAndDrawingNoIgnoreCaseAndIdNot(UUID projectId, String drawingNo, UUID id);

    /* Legacy compatibility queries retained for older services. */
    @Query("""
            select case when count(p) > 0 then true else false end
            from MatFlowProjectDrawing p
            where upper(p.plantCode) = :plantCode
              and upper(p.projectCode) = :projectCode
              and upper(p.drawingNo) = :drawingNo
              and upper(p.drawingRevision) = :drawingRevision
            """)
    boolean existsDuplicate(
            @Param("plantCode") String plantCode,
            @Param("projectCode") String projectCode,
            @Param("drawingNo") String drawingNo,
            @Param("drawingRevision") String drawingRevision);

    @Query("""
            select case when count(p) > 0 then true else false end
            from MatFlowProjectDrawing p
            where upper(p.plantCode) = :plantCode
              and upper(p.projectCode) = :projectCode
              and upper(p.drawingNo) = :drawingNo
              and upper(p.drawingRevision) = :drawingRevision
              and p.id <> :id
            """)
    boolean existsDuplicateExcludingId(
            @Param("plantCode") String plantCode,
            @Param("projectCode") String projectCode,
            @Param("drawingNo") String drawingNo,
            @Param("drawingRevision") String drawingRevision,
            @Param("id") UUID id);

    List<MatFlowProjectDrawing> findByPlantCodeIgnoreCaseAndProjectCodeIgnoreCaseOrderByProductNameAscDrawingNoAscDrawingRevisionDesc(
            String plantCode, String projectCode);
    List<MatFlowProjectDrawing> findByPlantCodeIgnoreCaseAndProjectCodeIgnoreCaseAndDrawingNoIgnoreCaseOrderByDrawingRevisionDesc(
            String plantCode, String projectCode, String drawingNo);
}
