package com.alsorg.packing.service;

import java.util.List;
import java.util.Optional;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import com.alsorg.packing.domain.users.User;
import com.alsorg.packing.repository.UserRepository;
import java.util.LinkedHashSet;
import java.util.Set;

@Service
public class UserService {

    private final UserRepository repo;
    private final PasswordEncoder encoder;

    public UserService(UserRepository repo, PasswordEncoder encoder) {
        this.repo = repo;
        this.encoder = encoder;
    }

    public User createUser(
            String username,
            String password,
            String role,
            Set<String> plantCodes
    ) {

        User user = new User();

        user.setUsername(username);
        user.setPassword(encoder.encode(password));
        user.setRole(role);

        Set<String> cleanPlants = cleanPlantCodes(plantCodes);

        user.setPlantCodes(cleanPlants);

        if (!cleanPlants.isEmpty()) {
            user.setPlantCode(cleanPlants.iterator().next());
        }

        return repo.save(user);
    }

    public List<User> getAllUsers() {
        return repo.findAll();
    }

    /* ================= UPDATE USER ================= */

    public User updateUser(
            Long id,
            String username,
            String role,
            Set<String> plantCodes
    ) {

        Optional<User> optional = repo.findById(id);

        if (optional.isEmpty()) {
            throw new RuntimeException("User not found");
        }

        User user = optional.get();

        user.setUsername(username);
        user.setRole(role);

        Set<String> cleanPlants = cleanPlantCodes(plantCodes);

        user.setPlantCodes(cleanPlants);

        if (!cleanPlants.isEmpty()) {
            user.setPlantCode(cleanPlants.iterator().next());
        } else {
            user.setPlantCode(null);
        }

        return repo.save(user);
    }

    /* ================= DELETE USER ================= */

    public void deleteUser(Long id) {
        repo.deleteById(id);
    }

    private Set<String> cleanPlantCodes(Set<String> plantCodes) {
        Set<String> clean = new LinkedHashSet<>();

        if (plantCodes == null) {
            return clean;
        }

        for (String code : plantCodes) {
            if (code != null && !code.isBlank()) {
                clean.add(code.trim());
            }
        }

        return clean;
    }
}