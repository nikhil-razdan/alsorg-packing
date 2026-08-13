package com.alsorg.packing.repository.matflow;

import com.alsorg.packing.domain.matflow.MatFlowProjectDrawing;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Single repository for the Product/Item/Drawing child entity. */
public interface MatFlowProjectDrawingRepository extends JpaRepository<MatFlowProjectDrawing, UUID> {

        @Query("""
                        select case when count(projectDrawing) > 0 then true else false end
                        from MatFlowProjectDrawing projectDrawing
                        where upper(projectDrawing.plantCode) = :plantCode
                          and upper(projectDrawing.projectCode) = :projectCode
                          and upper(projectDrawing.drawingNo) = :drawingNo
                          and upper(projectDrawing.drawingRevision) = :drawingRevision
                        """)
        boolean existsDuplicate(
                        @Param("plantCode") String plantCode,
                        @Param("projectCode") String projectCode,
                        @Param("drawingNo") String drawingNo,
                        @Param("drawingRevision") String drawingRevision);

        @Query("""
                        select case when count(projectDrawing) > 0 then true else false end
                        from MatFlowProjectDrawing projectDrawing
                        where upper(projectDrawing.plantCode) = :plantCode
                          and upper(projectDrawing.projectCode) = :projectCode
                          and upper(projectDrawing.drawingNo) = :drawingNo
                          and upper(projectDrawing.drawingRevision) = :drawingRevision
                          and projectDrawing.id <> :id
                        """)
        boolean existsDuplicateExcludingId(
                        @Param("plantCode") String plantCode,
                        @Param("projectCode") String projectCode,
                        @Param("drawingNo") String drawingNo,
                        @Param("drawingRevision") String drawingRevision,
                        @Param("id") UUID id);

        List<MatFlowProjectDrawing> findByPlantCodeIgnoreCaseAndProjectCodeIgnoreCaseOrderByProductNameAscDrawingNoAscDrawingRevisionDesc(
                        String plantCode,
                        String projectCode);

        List<MatFlowProjectDrawing> findByPlantCodeIgnoreCaseAndProjectCodeIgnoreCaseAndDrawingNoIgnoreCaseOrderByDrawingRevisionDesc(
                        String plantCode,
                        String projectCode,
                        String drawingNo);

        List<MatFlowProjectDrawing> findByProject_IdOrderByCreatedAtAsc(UUID projectId);
}
