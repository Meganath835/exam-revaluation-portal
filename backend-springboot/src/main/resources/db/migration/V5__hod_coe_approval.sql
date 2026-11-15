-- HOD and Controller of Examinations approval of mark increases.
-- "HOD reviews mark increase" goes to the candidate group hod-<department> of the request; the CoE
-- task goes to the existing group coe.
update app_user set candidate_groups = 'hod-cse' where username = 'hod.cse';
update app_user set candidate_groups = 'hod-ece' where username = 'hod.ece';
