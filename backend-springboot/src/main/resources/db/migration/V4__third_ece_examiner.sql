-- The workflow now uses two independent examiners per subject, neither of whom did the first
-- evaluation. That needs at least three examiners per department; ECE had only two.
insert into app_user (username, display_name, email, role, department, candidate_groups) values
  ('examiner.ec03', 'Examiner EC-03', 'examiner.ec03@example.edu', 'EXAMINER', 'ECE', null);
