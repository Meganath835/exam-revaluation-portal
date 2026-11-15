package edu.revaluation.web;

import edu.revaluation.dto.Dtos.CompleteTask;
import edu.revaluation.dto.Dtos.TaskView;
import edu.revaluation.service.CurrentUserService;
import edu.revaluation.service.TaskService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.*;

/** The custom Tasklist API used by the React inbox. */
@RestController
@RequestMapping("/api/tasks")
public class TaskController {
  private final TaskService tasks;
  private final CurrentUserService currentUser;

  public TaskController(TaskService tasks, CurrentUserService currentUser) {
    this.tasks = tasks;
    this.currentUser = currentUser;
  }

  /** view = mine (assigned to me), group (my candidate groups) or completed. */
  @GetMapping
  public List<TaskView> list(@RequestHeader(value = "X-User", required = false) String user,
      @RequestParam(defaultValue = "mine") String view) {
    return tasks.list(currentUser.require(user), view);
  }

  @GetMapping("/{key}")
  public TaskView get(@RequestHeader(value = "X-User", required = false) String user, @PathVariable long key) {
    return tasks.get(currentUser.require(user), key);
  }

  @PostMapping("/{key}/claim")
  public Map<String, String> claim(@RequestHeader(value = "X-User", required = false) String user, @PathVariable long key) {
    tasks.claim(currentUser.require(user), key);
    return Map.of("status", "CLAIMED");
  }

  @PostMapping("/{key}/unclaim")
  public Map<String, String> unclaim(@RequestHeader(value = "X-User", required = false) String user, @PathVariable long key) {
    tasks.unclaim(currentUser.require(user), key);
    return Map.of("status", "RELEASED");
  }

  @PostMapping("/{key}/complete")
  public Map<String, String> complete(@RequestHeader(value = "X-User", required = false) String user, @PathVariable long key,
      @Valid @RequestBody CompleteTask body) {
    tasks.complete(currentUser.require(user), key, body.variables());
    return Map.of("status", "COMPLETED");
  }
}
