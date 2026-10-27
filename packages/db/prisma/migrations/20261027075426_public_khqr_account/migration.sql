-- KHQR for buyers (roadmap step 5): placing a KHQR order builds the code
-- with the shop's Bakong account, but buyers can't read the shop's payment
-- settings (store_payment_configs: the seller's own; PayWay's keys will join
-- them). This gives the shop page only that one value — the account a KHQR
-- shows anyway — and only while KHQR is turned on. NULL = no KHQR.
CREATE FUNCTION app_public_store_khqr_account() RETURNS text
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
  AS $$
    SELECT c.bakong_account_id FROM store_payment_configs c
    WHERE c.store_id = app_public_store() AND c.provider = 'bakong_khqr' AND c.enabled AND coalesce(c.bakong_account_id, '') <> ''
  $$;
REVOKE ALL ON FUNCTION app_public_store_khqr_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_public_store_khqr_account() TO khmer_micro_store_app;
