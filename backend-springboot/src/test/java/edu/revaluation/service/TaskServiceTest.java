package edu.revaluation.service;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class TaskServiceTest {
  @Test
  void revisedMarksAreTheAverageOfBothExaminersRoundedHalfUp() {
    assertThat(TaskService.averageOf(46, 50)).isEqualTo(48);
    assertThat(TaskService.averageOf(45, 46)).isEqualTo(46);
    assertThat(TaskService.averageOf(0, 0)).isZero();
  }
}
