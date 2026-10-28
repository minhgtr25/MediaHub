-- These RPCs were renamed and revoked when their replacements shipped.
-- Current application and SQL function bodies have no callers for either.
-- Drop without CASCADE so any unreviewed database dependency stops the migration.
drop function if exists public.legacy_order_payment_action_028(
  uuid,
  uuid,
  text,
  jsonb
);

drop function if exists public.legacy_public_completed_creator_reviews_036(
  text,
  integer
);
