package com.alsorg.packing.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.alsorg.packing.domain.users.User;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByUsername(String username);

}