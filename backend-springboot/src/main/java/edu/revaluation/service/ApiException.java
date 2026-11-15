package edu.revaluation.service;

import java.util.Map;
import org.springframework.http.HttpStatus;

/** An error the API reports to the frontend with a clear message and optional field errors. */
public class ApiException extends RuntimeException {
  private final HttpStatus status;
  private final Map<String, String> fieldErrors;

  public ApiException(HttpStatus status, String message) {
    this(status, message, Map.of());
  }

  public ApiException(HttpStatus status, String message, Map<String, String> fieldErrors) {
    super(message);
    this.status = status;
    this.fieldErrors = fieldErrors;
  }

  public static ApiException notFound(String what) {
    return new ApiException(HttpStatus.NOT_FOUND, what + " was not found.");
  }

  public static ApiException forbidden(String message) {
    return new ApiException(HttpStatus.FORBIDDEN, message);
  }

  public static ApiException badRequest(String message) {
    return new ApiException(HttpStatus.BAD_REQUEST, message);
  }

  public static ApiException invalid(Map<String, String> fieldErrors) {
    return new ApiException(HttpStatus.BAD_REQUEST, "Some fields need attention.", fieldErrors);
  }

  public HttpStatus getStatus() { return status; }
  public Map<String, String> getFieldErrors() { return fieldErrors; }
}
