package edu.revaluation.service;

import edu.revaluation.domain.RequestEvent;
import edu.revaluation.repository.RequestEventRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class EventLog {
  private static final Logger LOG = LoggerFactory.getLogger(EventLog.class);
  private final RequestEventRepository events;

  public EventLog(RequestEventRepository events) {
    this.events = events;
  }

  public void record(String requestId, String message) {
    LOG.info("[{}] {}", requestId, message);
    events.save(new RequestEvent(requestId, message));
  }
}
