package com.alsorg.packing.security;

import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.DelegatingPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * Compatibility-preserving password encoder.
 *
 * New/changed passwords are encoded with BCrypt at the configured stronger
 * work factor, while existing Spring "{bcrypt}" hashes and older un-prefixed
 * bcrypt hashes continue to verify normally.
 */
public final class FlowSuitePasswordEncoder
        implements PasswordEncoder {

    private static final String BCRYPT_PREFIX = "{bcrypt}";

    private final BCryptPasswordEncoder strongBcrypt;
    private final DelegatingPasswordEncoder compatibility;

    public FlowSuitePasswordEncoder(
            int requestedStrength) {

        int safeStrength = Math.max(
                10,
                Math.min(
                        14,
                        requestedStrength));

        this.strongBcrypt =
                new BCryptPasswordEncoder(
                        safeStrength);

        this.compatibility =
                (DelegatingPasswordEncoder)
                        PasswordEncoderFactories
                                .createDelegatingPasswordEncoder();

        /*
         * Legacy FlowSuite rows may contain raw "$2..." bcrypt hashes without
         * the "{bcrypt}" id prefix.
         */
        this.compatibility
                .setDefaultPasswordEncoderForMatches(
                        new BCryptPasswordEncoder());
    }

    @Override
    public String encode(
            CharSequence rawPassword) {

        if (rawPassword == null) {
            throw new IllegalArgumentException(
                    "Password is required");
        }

        return BCRYPT_PREFIX
                + strongBcrypt.encode(
                        rawPassword);
    }

    @Override
    public boolean matches(
            CharSequence rawPassword,
            String encodedPassword) {

        if (rawPassword == null
                || encodedPassword == null
                || encodedPassword.isBlank()) {
            return false;
        }

        try {
            return compatibility.matches(
                    rawPassword,
                    encodedPassword);
        } catch (IllegalArgumentException exception) {
            return false;
        }
    }

    @Override
    public boolean upgradeEncoding(
            String encodedPassword) {

        if (encodedPassword == null
                || encodedPassword.isBlank()) {
            return true;
        }

        String clean = encodedPassword.trim();

        if (clean.startsWith(
                BCRYPT_PREFIX)) {

            return strongBcrypt.upgradeEncoding(
                    clean.substring(
                            BCRYPT_PREFIX.length()));
        }

        if (clean.startsWith("$2a$")
                || clean.startsWith("$2b$")
                || clean.startsWith("$2y$")) {

            return strongBcrypt.upgradeEncoding(
                    clean);
        }

        /*
         * Any other supported legacy DelegatingPasswordEncoder format is
         * upgraded to the current BCrypt policy after a successful login.
         */
        return true;
    }
}
