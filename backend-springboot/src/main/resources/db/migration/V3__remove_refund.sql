-- The refund step was removed from the revaluation workflow (no refundProcess, no manual refund task).
-- The accounts role existed only to handle manual refunds, so its demo user goes too.
-- No other table references this user: it never owned requests, subjects or payments.
delete from app_user where username = 'accounts.01' and role = 'ACCOUNTS';
