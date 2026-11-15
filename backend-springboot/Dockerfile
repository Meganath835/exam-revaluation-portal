# Multi-stage build. The build context is the REPOSITORY ROOT (see docker-compose.yml) so that
# the bpmn-models/ folder is packaged into the jar and deployed to Camunda at startup.

# ---- build stage: compile and package with Maven ----
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY backend-springboot/pom.xml backend-springboot/
RUN mvn -q -B -f backend-springboot/pom.xml dependency:go-offline
COPY bpmn-models ./bpmn-models
COPY backend-springboot/src backend-springboot/src
RUN mvn -q -B -f backend-springboot/pom.xml package -DskipTests

# ---- runtime stage: small JRE image, non-root user ----
FROM eclipse-temurin:21-jre
RUN useradd --system --uid 10001 app
WORKDIR /app
COPY --from=build /app/backend-springboot/target/revaluation-backend-*.jar app.jar
USER app
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --start-period=40s --retries=10 \
  CMD wget -qO- http://localhost:8080/actuator/health || exit 1
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-jar", "/app/app.jar"]
