package com.alsorg.packing.repository.matflow;

import com.alsorg.packing.domain.matflow.MatFlowProjectDrawing;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MatFlowProjectDrawingRepository
                extends JpaRepository<MatFlowProjectDrawing, UUID> {

        @Query("""
                        select case when count(p) > 0 then true else false end
                        from MatFlowProjectDrawing p
                        where upper(p.projectCode) = upper(:projectCode)
                          and upper(p.drawingNo) = upper(:drawingNo)
                          and upper(p.drawingRevision) = upper(:drawingRevision)
                        """)
        boolean existsDuplicate(
                        @Param("projectCode") String projectCode,
                        @Param("drawingNo") String drawingNo,
                        @Param("drawingRevision") String drawingRevision);

        @Query("""
                        select case when count(p) > 0 then true else false end
                        from MatFlowProjectDrawing p
                        where upper(p.projectCode) = upper(:projectCode)
                          and upper(p.drawingNo) = upper(:drawingNo)
                          and upper(p.drawingRevision) = upper(:drawingRevision)
                          and p.id <> :id
                        """)
        boolean existsDuplicateExcludingId(
                        @Param("projectCode") String projectCode,
                        @Param("drawingNo") String drawingNo,
                        @Param("drawingRevision") String drawingRevision,
                        @Param("id") UUID id);

        List<MatFlowProjectDrawing> findByProjectCodeIgnoreCaseAndDrawingNoIgnoreCaseOrderByDrawingRevisionDesc(
                        String projectCode,
                        String drawingNo);
}