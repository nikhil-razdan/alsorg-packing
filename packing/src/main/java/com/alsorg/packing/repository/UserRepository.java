package com.alsorg.packing.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.alsorg.packing.domain.users.User;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByUsername(String username);

    Optional<User> findByUsernameIgnoreCase(String username);

    boolean existsByUsername(String username);

    boolean existsByUsernameIgnoreCase(String username);

    boolean existsByUsernameAndIdNot(
            String username,
            Long id
    );

    boolean existsByUsernameIgnoreCaseAndIdNot(
            String username,
            Long id
    );
}