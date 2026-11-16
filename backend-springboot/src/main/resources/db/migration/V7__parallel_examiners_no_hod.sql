-- Both independent examiners of a subject are now assigned together and evaluate at the same time,
-- so a subject keeps both of them (examiner_id is the first, second_examiner_id the second).
alter table request_subject add column second_examiner_id varchar(64) references app_user(username);

-- A mark increase now goes straight to the Controller of Examinations: the HOD review step is gone,
-- and with it the three sign-ins that only existed for it.
delete from app_user where username in ('hod.cse', 'hod.ece', 'dean.academics');
