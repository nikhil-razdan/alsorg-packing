# syntax=docker/dockerfile:1

# ---------- BUILD STAGE ----------
FROM maven:3.9.9-eclipse-temurin-17 AS build

WORKDIR /app

COPY pom.xml ./

# Cache dependencies separately from source changes.
RUN mvn -B -ntp dependency:go-offline

COPY src ./src

RUN mvn -B -ntp clean package -DskipTests


# ---------- RUN STAGE ----------
FROM eclipse-temurin:17-jre-jammy

WORKDIR /app

# Run the application as a dedicated non-root user.
RUN groupadd --system flowsuite \
    && useradd --system --gid flowsuite --home-dir /app --shell /usr/sbin/nologin flowsuite \
    && mkdir -p /app/data/stickers /tmp/flowsuite \
    && chown -R flowsuite:flowsuite /app /tmp/flowsuite

COPY --from=build --chown=flowsuite:flowsuite \
    /app/target/packing-0.0.1-SNAPSHOT.jar \
    /app/app.jar

USER flowsuite:flowsuite

ENV JAVA_TOOL_OPTIONS="-XX:InitialRAMPercentage=20.0 -XX:MaxRAMPercentage=75.0 -XX:+ExitOnOutOfMemoryError -Djava.io.tmpdir=/tmp/flowsuite"

EXPOSE 8080

STOPSIGNAL SIGTERM

ENTRYPOINT ["java", "-jar", "/app/app.jar"]
