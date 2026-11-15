package edu.revaluation;

import edu.revaluation.config.AppProperties;
import io.camunda.client.annotation.Deployment;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

/**
 * Entry point. @Deployment deploys every BPMN, DMN and form from the repo-level bpmn-models/
 * folder (packaged under classpath:/bpmn by the Maven build) when the application starts.
 */
@SpringBootApplication
@EnableConfigurationProperties(AppProperties.class)
@Deployment(resources = {"classpath*:/bpmn/**/*.bpmn", "classpath*:/bpmn/**/*.dmn", "classpath*:/bpmn/**/*.form"})
public class RevaluationApplication {
  public static void main(String[] args) {
    SpringApplication.run(RevaluationApplication.class, args);
  }
}
