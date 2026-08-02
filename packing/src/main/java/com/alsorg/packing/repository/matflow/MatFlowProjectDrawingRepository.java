package com.alsorg.packing.repository.matflow;

import com.alsorg.packing.domain.matflow.MatFlowProjectDrawing;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MatFlowProjectDrawingRepository
    extends JpaRepository<MatFlowProjectDrawing, UUID> {

  /*
   * Checks whether the exact Product/Drawing revision
   * already exists inside the same plant and project.
   */
  @Query("""
      select case
          when count(projectDrawing) > 0
          then true
          else false
      end
      from MatFlowProjectDrawing projectDrawing
      where upper(projectDrawing.plantCode) =
            upper(:plantCode)

        and upper(projectDrawing.projectCode) =
            upper(:projectCode)

        and upper(projectDrawing.drawingNo) =
            upper(:drawingNo)

        and upper(projectDrawing.drawingRevision) =
            upper(:drawingRevision)
      """)
  boolean existsDuplicate(
      @Param("plantCode") String plantCode,

      @Param("projectCode") String projectCode,

      @Param("drawingNo") String drawingNo,

      @Param("drawingRevision") String drawingRevision);

  /*
   * Same duplicate check during edit while excluding
   * the Product/Drawing currently being edited.
   */
  @Query("""
      select case
          when count(projectDrawing) > 0
          then true
          else false
      end
      from MatFlowProjectDrawing projectDrawing
      where upper(projectDrawing.plantCode) =
            upper(:plantCode)

        and upper(projectDrawing.projectCode) =
            upper(:projectCode)

        and upper(projectDrawing.drawingNo) =
            upper(:drawingNo)

        and upper(projectDrawing.drawingRevision) =
            upper(:drawingRevision)

        and projectDrawing.id <> :id
      """)
  boolean existsDuplicateExcludingId(
      @Param("plantCode") String plantCode,

      @Param("projectCode") String projectCode,

      @Param("drawingNo") String drawingNo,

      @Param("drawingRevision") String drawingRevision,

      @Param("id") UUID id);

  /*
   * Returns every Product/Drawing belonging to one
   * logical Project / PD.
   */
  List<MatFlowProjectDrawing> findByPlantCodeIgnoreCaseAndProjectCodeIgnoreCaseOrderByProductNameAscDrawingNoAscDrawingRevisionDesc(
      String plantCode,
      String projectCode);

  /*
   * Returns revision history for one drawing inside
   * one plant and project.
   */
  List<MatFlowProjectDrawing> findByPlantCodeIgnoreCaseAndProjectCodeIgnoreCaseAndDrawingNoIgnoreCaseOrderByDrawingRevisionDesc(
      String plantCode,
      String projectCode,
      String drawingNo);
}