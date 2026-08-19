package com.alsorg.packing.service;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.alsorg.packing.controller.dto.client.ClientMasterRequest;
import com.alsorg.packing.controller.dto.client.ClientMasterResponse;
import com.alsorg.packing.controller.dto.client.ClientMasterStatsResponse;
import com.alsorg.packing.domain.client.ClientMaster;
import com.alsorg.packing.repository.ClientMasterRepository;

@Service
public class ClientMasterService {

    private static final int DEFAULT_SUGGESTION_LIMIT = 12;
    private static final int MAX_SUGGESTION_LIMIT = 25;
    private static final int MIN_SEARCH_LENGTH = 2;

    private final ClientMasterRepository clientMasterRepository;

    public ClientMasterService(
            ClientMasterRepository clientMasterRepository) {
        this.clientMasterRepository = clientMasterRepository;
    }

    @Transactional(readOnly = true)
    public List<ClientMasterResponse> searchSuggestions(
            String query,
            Integer requestedLimit) {

        String normalizedQuery = normalizeName(query);

        /*
         * Important UX/performance rule:
         * never return the complete client list when the field is empty.
         * Packing users must type at least two characters first.
         */
        if (normalizedQuery.length() < MIN_SEARCH_LENGTH) {
            return List.of();
        }

        int limit = requestedLimit == null
                ? DEFAULT_SUGGESTION_LIMIT
                : Math.max(
                        1,
                        Math.min(
                                requestedLimit,
                                MAX_SUGGESTION_LIMIT));

        Pageable pageable = PageRequest.of(
                0,
                limit,
                Sort.by(
                        Sort.Order.asc("name")
                                .ignoreCase()));

        return clientMasterRepository
                .searchActive(
                        normalizedQuery,
                        pageable)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public Page<ClientMasterResponse> list(
            String search,
            String status,
            int page,
            int size) {

        int safePage = Math.max(0, page);
        int safeSize = Math.min(
                Math.max(1, size),
                200);

        String cleanSearch = search == null
                ? ""
                : search.trim();

        String cleanStatus = status == null
                ? "ALL"
                : status.trim()
                        .toUpperCase(Locale.ROOT);

        Pageable pageable = PageRequest.of(
                safePage,
                safeSize,
                Sort.by(
                        Sort.Order.asc("name")
                                .ignoreCase()));

        Page<ClientMaster> result;

        if ("ACTIVE".equals(cleanStatus)) {
            result = clientMasterRepository
                    .findByActiveAndNameContainingIgnoreCase(
                            true,
                            cleanSearch,
                            pageable);
        } else if ("INACTIVE".equals(cleanStatus)) {
            result = clientMasterRepository
                    .findByActiveAndNameContainingIgnoreCase(
                            false,
                            cleanSearch,
                            pageable);
        } else {
            result = clientMasterRepository
                    .findByNameContainingIgnoreCase(
                            cleanSearch,
                            pageable);
        }

        return result.map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public ClientMasterStatsResponse stats() {
        long total = clientMasterRepository.count();
        long active = clientMasterRepository.countByActiveTrue();
        long inactive = clientMasterRepository.countByActiveFalse();

        return new ClientMasterStatsResponse(
                total,
                active,
                inactive);
    }

    @Transactional
    public ClientMasterResponse create(
            ClientMasterRequest request,
            String actor) {

        if (request == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Client request is required");
        }

        String name = cleanRequiredName(
                request.name());

        String normalizedName = normalizeName(name);

        if (clientMasterRepository
                .existsByNormalizedName(normalizedName)) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Client already exists in Client Master");
        }

        ClientMaster client = new ClientMaster();
        client.setName(name);
        client.setNormalizedName(normalizedName);
        client.setAddress(cleanOptional(
                request.address()));
        client.setActive(
                request.active() == null ||
                        request.active());
        client.setSource("MANUAL");
        client.setCreatedBy(cleanActor(actor));
        client.setUpdatedBy(cleanActor(actor));

        return toResponse(
                clientMasterRepository.save(client));
    }

    @Transactional
    public ClientMasterResponse update(
            UUID id,
            ClientMasterRequest request,
            String actor) {

        if (id == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Client ID is required");
        }

        ClientMaster client = clientMasterRepository
                .findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Client not found"));

        if (request == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Client request is required");
        }

        String name = cleanRequiredName(
                request.name());

        String normalizedName = normalizeName(name);

        clientMasterRepository
                .findByNormalizedName(normalizedName)
                .filter(existing -> !existing.getId()
                        .equals(id))
                .ifPresent(existing -> {
                    throw new ResponseStatusException(
                            HttpStatus.CONFLICT,
                            "Another client already uses this name");
                });

        client.setName(name);
        client.setNormalizedName(normalizedName);
        client.setAddress(cleanOptional(
                request.address()));

        if (request.active() != null) {
            client.setActive(request.active());
        }

        client.setUpdatedBy(cleanActor(actor));

        return toResponse(
                clientMasterRepository.save(client));
    }

    @Transactional
    public ClientMasterResponse setActive(
            UUID id,
            boolean active,
            String actor) {

        ClientMaster client = clientMasterRepository
                .findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Client not found"));

        client.setActive(active);
        client.setUpdatedBy(cleanActor(actor));

        return toResponse(
                clientMasterRepository.save(client));
    }

    @Transactional
    public int seedNames(
            Collection<String> names,
            String source,
            String actor) {

        if (names == null || names.isEmpty()) {
            return 0;
        }

        List<ClientMaster> pending = new ArrayList<>();
        Set<String> pendingNormalizedNames = new LinkedHashSet<>();

        for (String rawName : names) {
            String name = cleanOptional(rawName);

            if (name == null) {
                continue;
            }

            String normalizedName = normalizeName(name);

            if (normalizedName.isBlank() ||
                    pendingNormalizedNames.contains(normalizedName) ||
                    clientMasterRepository
                            .existsByNormalizedName(normalizedName)) {
                continue;
            }

            pendingNormalizedNames.add(normalizedName);

            ClientMaster client = new ClientMaster();
            client.setName(name);
            client.setNormalizedName(normalizedName);
            client.setAddress(null);
            client.setActive(true);
            client.setSource(
                    source == null || source.isBlank()
                            ? "SEED"
                            : source.trim());
            client.setCreatedBy(cleanActor(actor));
            client.setUpdatedBy(cleanActor(actor));

            pending.add(client);
        }

        if (pending.isEmpty()) {
            return 0;
        }

        clientMasterRepository.saveAll(pending);

        return pending.size();
    }

    private ClientMasterResponse toResponse(
            ClientMaster client) {
        return new ClientMasterResponse(
                client.getId(),
                client.getName(),
                client.getAddress(),
                client.isActive(),
                client.getSource(),
                client.getCreatedBy(),
                client.getCreatedAt(),
                client.getUpdatedBy(),
                client.getUpdatedAt());
    }

    private String cleanRequiredName(
            String value) {
        String clean = cleanOptional(value);

        if (clean == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Client name is required");
        }

        if (clean.length() > 250) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Client name is too long");
        }

        return clean;
    }

    private String cleanOptional(
            String value) {
        if (value == null) {
            return null;
        }

        String clean = value
                .trim()
                .replaceAll("\\s+", " ");

        return clean.isBlank()
                ? null
                : clean;
    }

    private String cleanActor(
            String actor) {
        if (actor == null || actor.isBlank()) {
            return "SYSTEM";
        }

        return actor.trim();
    }

    public String normalizeName(
            String value) {
        if (value == null || value.isBlank()) {
            return "";
        }

        String decomposed = Normalizer.normalize(
                value,
                Normalizer.Form.NFD);

        return decomposed
                .replaceAll("\\p{M}+", "")
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^\\p{Alnum}]+", " ")
                .trim()
                .replaceAll("\\s+", " ");
    }
}
