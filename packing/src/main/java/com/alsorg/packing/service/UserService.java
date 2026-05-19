package com.alsorg.packing.service;

import java.util.List;
import java.util.Optional;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import com.alsorg.packing.domain.users.User;
import com.alsorg.packing.repository.UserRepository;

@Service
public class UserService {

    private final UserRepository repo;
    private final PasswordEncoder encoder;

    public UserService(UserRepository repo, PasswordEncoder encoder) {
        this.repo = repo;
        this.encoder = encoder;
    }

    public User createUser(String username, String password, String role) {

        User user = new User();

        user.setUsername(username);
        user.setPassword(encoder.encode(password));
        user.setRole(role);

        return repo.save(user);
    }

    public List<User> getAllUsers() {
        return repo.findAll();
    }

    /* ================= UPDATE USER ================= */

    public User updateUser(Long id, String username, String role) {

        Optional<User> optional = repo.findById(id);

        if(optional.isEmpty()) {
            throw new RuntimeException("User not found");
        }

        User user = optional.get();

        user.setUsername(username);
        user.setRole(role);

        return repo.save(user);
    }

    /* ================= DELETE USER ================= */

    public void deleteUser(Long id) {
        repo.deleteById(id);
    }

}