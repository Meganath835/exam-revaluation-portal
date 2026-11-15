package edu.revaluation.web;

import edu.revaluation.dto.Dtos.ProcessInstanceDetail;
import edu.revaluation.dto.Dtos.ProcessOverview;
import edu.revaluation.service.CurrentUserService;
import edu.revaluation.service.ProcessViewService;
import edu.revaluation.service.RequestService;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;

/**
 * Process View API for the exam cell clerk. Every endpoint checks the role on the server, so a
 * student (or any other role) gets 403 even when calling the URL directly.
 */
@RestController
@RequestMapping("/api/process-view")
public class ProcessViewController {
  private final ProcessViewService processView;
  private final RequestService requests;
  private final CurrentUserService currentUser;

  public ProcessViewController(ProcessViewService processView, RequestService requests, CurrentUserService currentUser) {
    this.processView = processView;
    this.requests = requests;
    this.currentUser = currentUser;
  }

  /** Workflow overview: deployed version, per-element counts, every request with its stage and open tasks. */
  @GetMapping
  public ProcessOverview overview(@RequestHeader(value = "X-User", required = false) String user) {
    currentUser.requireProcessViewer(user);
    return processView.overview();
  }

  /** The deployed BPMN model (latest version), drawn by bpmn-js. */
  @GetMapping(value = "/definition", produces = MediaType.APPLICATION_XML_VALUE)
  public String definition(@RequestHeader(value = "X-User", required = false) String user) {
    currentUser.requireProcessViewer(user);
    return processView.definitionXml();
  }

  /** One request's process instance: element states and all of its user tasks. */
  @GetMapping("/requests/{id}")
  public ProcessInstanceDetail instance(@RequestHeader(value = "X-User", required = false) String user, @PathVariable String id) {
    var clerk = currentUser.requireProcessViewer(user);
    return processView.instance(requests.getFor(clerk, id));
  }
}
