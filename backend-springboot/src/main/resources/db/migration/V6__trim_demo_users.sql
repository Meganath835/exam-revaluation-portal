-- Fewer demo sign-ins: one student and the three CSE examiners are enough to show the whole workflow.
-- Removes students 21CS057 and 21EC013 and examiners examiner.ec01 ... examiner.ec03.

-- Requests of the removed students (their subjects, payments and activity go with them: on delete cascade).
delete from revaluation_request where student_id in ('21CS057', '21EC013');

-- Never leave an assignment pointing at a removed examiner.
update request_subject set examiner_id = null
 where examiner_id in ('examiner.ec01', 'examiner.ec02', 'examiner.ec03');

-- With no ECE student or examiner left, the ECE subjects can't be used; remove the ones no request refers to.
update subject_catalog set first_evaluator = null
 where first_evaluator in ('examiner.ec01', 'examiner.ec02', 'examiner.ec03');
delete from subject_catalog
 where department = 'ECE' and code not in (select subject_code from request_subject);

delete from app_user
 where username in ('21CS057', '21EC013', 'examiner.ec01', 'examiner.ec02', 'examiner.ec03');
