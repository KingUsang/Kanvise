-- Payment confirmation is the only path that grants a paid entitlement. It is
-- idempotent because Paystack can retry a verified webhook.

CREATE OR REPLACE FUNCTION confirm_marketplace_payment(
    p_paystack_reference TEXT, p_paystack_transaction_id TEXT, p_amount_kobo INTEGER, p_now TIMESTAMPTZ
)
RETURNS TABLE(order_id UUID, entitlement_id UUID, already_processed BOOLEAN, student_id UUID, listing_title TEXT, student_email TEXT, student_first_name TEXT)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
    v_order mock_marketplace_orders%ROWTYPE;
    v_entitlement mock_marketplace_entitlements%ROWTYPE;
    v_listing mock_marketplace_listings%ROWTYPE;
BEGIN
    SELECT * INTO v_order FROM mock_marketplace_orders WHERE paystack_reference = p_paystack_reference FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'MARKETPLACE_ORDER_NOT_FOUND'; END IF;
    IF v_order.total_charged_kobo <> p_amount_kobo THEN RAISE EXCEPTION 'MARKETPLACE_PAYMENT_AMOUNT_MISMATCH'; END IF;
    IF v_order.status = 'paid' THEN
      SELECT * INTO v_entitlement FROM mock_marketplace_entitlements WHERE order_id = v_order.id;
      SELECT up.email, up.first_name INTO student_email, student_first_name FROM user_profiles up WHERE up.id = v_order.student_id;
      SELECT title INTO listing_title FROM mock_marketplace_listings WHERE id = v_order.listing_id;
      RETURN QUERY SELECT v_order.id, v_entitlement.id, true, v_order.student_id, listing_title, student_email, student_first_name;
      RETURN;
    END IF;
    IF v_order.status <> 'pending' THEN RAISE EXCEPTION 'MARKETPLACE_ORDER_NOT_PENDING'; END IF;
    SELECT * INTO v_listing FROM mock_marketplace_listings WHERE id = v_order.listing_id FOR SHARE;
    IF NOT FOUND OR v_listing.mock_version_id <> v_order.mock_version_id THEN RAISE EXCEPTION 'MARKETPLACE_LISTING_CHANGED'; END IF;
    UPDATE mock_marketplace_orders SET status = 'paid', paystack_transaction_id = p_paystack_transaction_id, paid_at = p_now, updated_at = p_now
      WHERE id = v_order.id RETURNING * INTO v_order;
    INSERT INTO mock_marketplace_entitlements(student_id, listing_id, mock_version_id, source, order_id, attempts_granted, granted_at)
      VALUES (v_order.student_id, v_order.listing_id, v_order.mock_version_id, 'purchase', v_order.id, v_listing.attempts_included, p_now)
      ON CONFLICT (student_id, mock_version_id) WHERE revoked_at IS NULL DO NOTHING
      RETURNING * INTO v_entitlement;
    IF v_entitlement.id IS NULL THEN
      SELECT * INTO v_entitlement FROM mock_marketplace_entitlements
        WHERE student_id = v_order.student_id AND mock_version_id = v_order.mock_version_id AND revoked_at IS NULL;
    END IF;
    INSERT INTO mock_marketplace_ledger_entries(order_id, listing_id, entry_type, mock_price_kobo, student_processing_fee_kobo,
      total_charged_kobo, platform_fee_kobo, creator_amount_kobo, currency, effective_at)
      VALUES (v_order.id, v_order.listing_id, 'payment', v_order.mock_price_kobo, v_order.student_processing_fee_kobo,
        v_order.total_charged_kobo, v_order.platform_fee_kobo, v_order.creator_amount_kobo, v_order.currency, p_now)
      ON CONFLICT (order_id, entry_type) DO NOTHING;
    SELECT up.email, up.first_name INTO student_email, student_first_name FROM user_profiles up WHERE up.id = v_order.student_id;
    RETURN QUERY SELECT v_order.id, v_entitlement.id, false, v_order.student_id, v_listing.title, student_email, student_first_name;
END;
$$;

REVOKE ALL ON FUNCTION confirm_marketplace_payment(TEXT, TEXT, INTEGER, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION confirm_marketplace_payment(TEXT, TEXT, INTEGER, TIMESTAMPTZ) TO service_role;
