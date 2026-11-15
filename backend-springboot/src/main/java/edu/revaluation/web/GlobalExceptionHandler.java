package edu.revaluation.web;

import edu.revaluation.service.ApiException;
import io.camunda.client.api.command.ClientStatusException;
import io.camunda.client.api.command.ProblemException;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.resource.NoResourceFoundException;

/** Turns every error into one JSON shape the React forms can show: {status, message, fieldErrors}. */
@RestControllerAdvice
public class GlobalExceptionHandler {
  private static final Logger LOG = LoggerFactory.getLogger(GlobalExceptionHandler.class);

  public record ErrorBody(int status, String message, Map<String, String> fieldErrors, OffsetDateTime at) {}

  @ExceptionHandler(ApiException.class)
  ResponseEntity<ErrorBody> api(ApiException e) {
    return body(e.getStatus(), e.getMessage(), e.getFieldErrors());
  }

  @ExceptionHandler(MethodArgumentNotValidException.class)
  ResponseEntity<ErrorBody> invalid(MethodArgumentNotValidException e) {
    Map<String, String> fields = new LinkedHashMap<>();
    e.getBindingResult().getFieldErrors().forEach(f -> fields.putIfAbsent(f.getField(), f.getDefaultMessage()));
    return body(HttpStatus.BAD_REQUEST, "Some fields need attention.", fields);
  }

  @ExceptionHandler(HttpMessageNotReadableException.class)
  ResponseEntity<ErrorBody> unreadable(HttpMessageNotReadableException e) {
    return body(HttpStatus.BAD_REQUEST, "The request body is not valid JSON.", Map.of());
  }

  /** Errors from the Camunda engine, for example a task that was completed a moment ago. */
  @ExceptionHandler({ProblemException.class, ClientStatusException.class})
  ResponseEntity<ErrorBody> camunda(RuntimeException e) {
    LOG.warn("Camunda call failed: {}", e.getMessage());
    HttpStatus status = e instanceof ProblemException p && p.code() == 404 ? HttpStatus.NOT_FOUND : HttpStatus.CONFLICT;
    String msg = status == HttpStatus.NOT_FOUND
        ? "The workflow engine has no record of this yet. Try again in a moment."
        : "The workflow engine rejected the action. Refresh and try again.";
    return body(status, msg, Map.of());
  }

  /** A URL with no endpoint behind it (for example a removed one) is a 404, not a server error. */
  @ExceptionHandler(NoResourceFoundException.class)
  ResponseEntity<ErrorBody> noEndpoint(NoResourceFoundException e) {
    return body(HttpStatus.NOT_FOUND, "There is no such endpoint.", Map.of());
  }

  @ExceptionHandler(Exception.class)
  ResponseEntity<ErrorBody> other(Exception e) {
    LOG.error("Unexpected error", e);
    return body(HttpStatus.INTERNAL_SERVER_ERROR, "Something went wrong on the server. Check the backend logs.", Map.of());
  }

  private ResponseEntity<ErrorBody> body(HttpStatus status, String message, Map<String, String> fields) {
    return ResponseEntity.status(status).body(new ErrorBody(status.value(), message, fields, OffsetDateTime.now()));
  }
}
