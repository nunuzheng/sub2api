-- Group credit billing.
-- token (default) keeps the existing price-table × rate_multiplier path.
-- credit bills actual_cost = consumed credits × groups.credit_price and does
-- not apply rate_multiplier. credit_price is operator-configured, not hardcoded.
--
-- Rollback: deploy the previous binary first. It ignores these columns and
-- bills every group as token. The columns can stay. To drop them later:
--   ALTER TABLE groups DROP CONSTRAINT IF EXISTS groups_billing_mode_check;
--   ALTER TABLE groups DROP CONSTRAINT IF EXISTS groups_credit_price_nonnegative_check;
--   ALTER TABLE groups DROP COLUMN IF EXISTS billing_mode;
--   ALTER TABLE groups DROP COLUMN IF EXISTS credit_price;
--   ALTER TABLE usage_logs DROP COLUMN IF EXISTS credits;
--   ALTER TABLE usage_logs DROP COLUMN IF EXISTS credit_price;
-- Then restore enqueue_group_auth_cache_invalidation from migration 193.

ALTER TABLE groups ADD COLUMN IF NOT EXISTS billing_mode VARCHAR(20) NOT NULL DEFAULT 'token';
ALTER TABLE groups ADD COLUMN IF NOT EXISTS credit_price DECIMAL(20,8) NOT NULL DEFAULT 0;

ALTER TABLE groups DROP CONSTRAINT IF EXISTS groups_billing_mode_check;
ALTER TABLE groups ADD CONSTRAINT groups_billing_mode_check CHECK (billing_mode IN ('token', 'credit'));

ALTER TABLE groups DROP CONSTRAINT IF EXISTS groups_credit_price_nonnegative_check;
ALTER TABLE groups ADD CONSTRAINT groups_credit_price_nonnegative_check CHECK (credit_price >= 0);

COMMENT ON COLUMN groups.billing_mode IS '客户扣费方式：token（默认）或 credit。credit 时 actual_cost = 消耗 credit × credit_price，不叠 rate_multiplier。';
COMMENT ON COLUMN groups.credit_price IS 'credit 模式每 credit 单价（USD）。后台可改，不写死。token 模式不使用。';

ALTER TABLE usage_logs ADD COLUMN IF NOT EXISTS credits DECIMAL(20,8);
ALTER TABLE usage_logs ADD COLUMN IF NOT EXISTS credit_price DECIMAL(20,8);

COMMENT ON COLUMN usage_logs.credits IS '上游消耗 credit 快照。token 模式为 NULL。';
COMMENT ON COLUMN usage_logs.credit_price IS '结算时分组 credit 单价快照（USD/credit）。历史记录不随之后的改价变化。';

-- Extend the auth-cache invalidation trigger so an out-of-band edit of the
-- credit billing columns cannot leave a cached API key on the token path.
CREATE OR REPLACE FUNCTION enqueue_group_auth_cache_invalidation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    target_group_id BIGINT;
BEGIN
    target_group_id := OLD.id;
    IF TG_OP = 'UPDATE'
       AND OLD.status IS NOT DISTINCT FROM NEW.status
       AND OLD.is_exclusive IS NOT DISTINCT FROM NEW.is_exclusive
       AND OLD.allow_image_generation IS NOT DISTINCT FROM NEW.allow_image_generation
       AND OLD.platform IS NOT DISTINCT FROM NEW.platform
       AND OLD.subscription_type IS NOT DISTINCT FROM NEW.subscription_type
       AND OLD.rate_multiplier IS NOT DISTINCT FROM NEW.rate_multiplier
       AND OLD.peak_rate_enabled IS NOT DISTINCT FROM NEW.peak_rate_enabled
       AND OLD.peak_start IS NOT DISTINCT FROM NEW.peak_start
       AND OLD.peak_end IS NOT DISTINCT FROM NEW.peak_end
       AND OLD.peak_rate_multiplier IS NOT DISTINCT FROM NEW.peak_rate_multiplier
       AND OLD.profit_control_enabled IS NOT DISTINCT FROM NEW.profit_control_enabled
       AND OLD.profit_min_margin IS NOT DISTINCT FROM NEW.profit_min_margin
       AND OLD.profit_safety_buffer IS NOT DISTINCT FROM NEW.profit_safety_buffer
       AND OLD.billing_mode IS NOT DISTINCT FROM NEW.billing_mode
       AND OLD.credit_price IS NOT DISTINCT FROM NEW.credit_price
       AND OLD.deleted_at IS NOT DISTINCT FROM NEW.deleted_at THEN
        RETURN NEW;
    END IF;

    INSERT INTO auth_cache_invalidation_outbox (cache_key)
    SELECT encode(sha256(convert_to(k.key, 'UTF8')), 'hex')
    FROM api_keys AS k
    WHERE k.group_id = target_group_id
      AND k.deleted_at IS NULL
      AND k.key <> '';
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;
