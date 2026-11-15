package edu.revaluation.web;

import edu.revaluation.config.AppProperties;
import edu.revaluation.domain.AppUser;
import edu.revaluation.domain.Role;
import edu.revaluation.dto.Dtos.*;
import edu.revaluation.service.*;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/requests")
public class RequestController {
  private final RequestService requests;
  private final StatusService status;
  private final CamundaGateway camunda;
  private final CurrentUserService currentUser;
  private final AppProperties props;

  public RequestController(RequestService requests, StatusService status, CamundaGateway camunda,
      CurrentUserService currentUser, AppProperties props) {
    this.requests = requests;
    this.status = status;
    this.camunda = camunda;
    this.currentUser = currentUser;
    this.props = props;
  }

  /** Student submits a request; this starts revaluationProcess. */
  @PostMapping
  public ResponseEntity<RequestDetail> create(@RequestHeader(value = "X-User", required = false) String user,
      @Valid @RequestBody CreateRequest body) {
    AppUser student = currentUser.requireRole(user, Role.STUDENT);
    var created = requests.create(student, body);
    return ResponseEntity.created(URI.create("/api/requests/" + created.getId()))
        .body(Views.detail(created, props.revaluationWindow()));
  }

  @GetMapping
  public List<RequestSummary> list(@RequestHeader(value = "X-User", required = false) String user) {
    return requests.list(currentUser.require(user)).stream().map(Views::summary).toList();
  }

  @GetMapping("/{id}")
  public RequestDetail get(@RequestHeader(value = "X-User", required = false) String user, @PathVariable String id) {
    return Views.detail(requests.getFor(currentUser.require(user), id), props.revaluationWindow());
  }

  /**
   * Live status tracker data; the React page polls this every few seconds. BPMN element states are
   * included only for the exam cell (Process View); everyone else gets stages, subjects and activity.
   */
  @GetMapping("/{id}/status")
  public StatusView status(@RequestHeader(value = "X-User", required = false) String user, @PathVariable String id) {
    AppUser u = currentUser.require(user);
    return status.status(requests.getFor(u, id), CurrentUserService.canViewProcess(u));
  }

  /** BPMN XML of the request's process instance, drawn by bpmn-js in the exam cell's Process View. */
  @GetMapping(value = "/{id}/diagram", produces = MediaType.APPLICATION_XML_VALUE)
  public String diagram(@RequestHeader(value = "X-User", required = false) String user, @PathVariable String id) {
    var r = requests.getFor(currentUser.requireProcessViewer(user), id);
    if (r.getProcessInstanceKey() == null) throw ApiException.notFound("Process for " + id);
    long definitionKey = camunda.processInstance(r.getProcessInstanceKey()).getProcessDefinitionKey();
    return camunda.processXml(definitionKey);
  }
}
