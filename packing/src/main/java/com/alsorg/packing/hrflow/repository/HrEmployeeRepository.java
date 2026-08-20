package com.alsorg.packing.hrflow.repository;

import com.alsorg.packing.hrflow.domain.HrEmployee;
import com.alsorg.packing.hrflow.domain.HrEmployeeStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface HrEmployeeRepository extends JpaRepository<HrEmployee, UUID> {

    boolean existsByEmployeeCodeIgnoreCase(String employeeCode);

    Optional<HrEmployee> findByCandidateId(UUID candidateId);

    @Query("""
            select e
            from HrEmployee e
            where (:status is null or e.status = :status)
              and (
                    :q is null
                    or :q = ''
                    or lower(e.employeeCode) like lower(concat('%', :q, '%'))
                    or lower(e.fullName) like lower(concat('%', :q, '%'))
                    or lower(e.department) like lower(concat('%', :q, '%'))
                    or lower(e.designation) like lower(concat('%', :q, '%'))
                  )
            order by e.updatedAt desc
            """)
    Page<HrEmployee> search(
            @Param("q") String q,
            @Param("status") HrEmployeeStatus status,
            Pageable pageable
    );
}
