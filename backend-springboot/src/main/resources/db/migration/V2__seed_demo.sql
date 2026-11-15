-- Demo data. All people are fictional; emails use the reserved example.edu domain.

insert into app_user (username, display_name, email, role, department, candidate_groups) values
  ('21CS042', 'Sample Student',        'student.21cs042@example.edu', 'STUDENT',  'CSE', null),
  ('21CS057', 'Second Student',        'student.21cs057@example.edu', 'STUDENT',  'CSE', null),
  ('21EC013', 'Third Student',         'student.21ec013@example.edu', 'STUDENT',  'ECE', null),
  ('examcell.clerk', 'Exam Cell Clerk', 'examcell@example.edu',        'EXAM_CELL', null, 'exam-cell'),
  ('examiner.cs01', 'Examiner CS-01',  'examiner.cs01@example.edu',   'EXAMINER', 'CSE', null),
  ('examiner.cs02', 'Examiner CS-02',  'examiner.cs02@example.edu',   'EXAMINER', 'CSE', null),
  ('examiner.cs03', 'Examiner CS-03',  'examiner.cs03@example.edu',   'EXAMINER', 'CSE', null),
  ('examiner.ec01', 'Examiner EC-01',  'examiner.ec01@example.edu',   'EXAMINER', 'ECE', null),
  ('examiner.ec02', 'Examiner EC-02',  'examiner.ec02@example.edu',   'EXAMINER', 'ECE', null),
  ('hod.cse', 'HOD, Computer Science', 'hod.cse@example.edu',         'MODERATOR', 'CSE', null),
  ('hod.ece', 'HOD, Electronics',      'hod.ece@example.edu',         'MODERATOR', 'ECE', null),
  ('dean.academics', 'Dean of Academics', 'dean@example.edu',         'MODERATOR', null, null),
  ('coe', 'Controller of Examinations', 'coe@example.edu',            'COE', null, 'coe'),
  ('accounts.01', 'Accounts Officer',  'accounts@example.edu',        'ACCOUNTS', null, 'accounts');

-- Results published 5 days before the database was created, so the 15-day window is open during the demo.
-- DEC-2025 is long closed: use it to show the "window closed" rejection.
insert into exam_session (code, name, result_published_on) values
  ('MAY-2026', 'May 2026 semester examinations', current_date - 5),
  ('DEC-2025', 'December 2025 semester examinations', current_date - 160);

insert into subject_catalog (code, name, department, max_marks, script_available, first_evaluator) values
  ('CS301', 'Operating Systems',              'CSE', 100, true,  'examiner.cs01'),
  ('CS305', 'Computer Networks',              'CSE', 100, true,  'examiner.cs02'),
  ('CS310', 'Database Management Systems',    'CSE', 100, true,  'examiner.cs03'),
  ('CS320', 'Software Engineering',           'CSE', 75,  true,  'examiner.cs01'),
  ('CS399', 'Compiler Design',                'CSE', 100, false, 'examiner.cs02'),
  ('EC201', 'Signals and Systems',            'ECE', 100, true,  'examiner.ec01'),
  ('EC205', 'Analog Circuits',                'ECE', 100, true,  'examiner.ec02');
