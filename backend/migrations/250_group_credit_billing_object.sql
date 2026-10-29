-- Replace the unreleased billing_mode/credit_price columns with the
-- SuperGPT-shaped credit_billing object, and add per-user credit unit prices.
--
-- credit_billing JSON:
--   {"enabled": true, "unit_price": 0.144, "started_at": "...", "cost_per_credit": null}
-- Token groups stay {"enabled": false} or NULL and keep token × rate billing.
--
-- Rollback: deploy the previous binary first. To undo this migration:
--   DROP TABLE IF EXISTS user_group_credit_prices;
--   ALTER TABLE groups DROP COLUMN IF EXISTS credit_billing;
--   restore enqueue_group_auth_cache_invalidation from migration 193
--   (do not restore billing_mode/credit_price; that shape was never released).

ALTER TABLE groups ADD COLUMN IF NOT EXISTS credit_billing JSONB;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'groups' AND column_name = 'billing_mode'
    ) THEN
        UPDATE groups
        SET credit_billing = jsonb_build_object(
            'enabled', TRUE,
            'unit_price', credit_price,
            'started_at', NOW()
        )
        WHERE billing_mode = 'credit'
          AND (credit_billing IS NULL OR credit_billing = 'null'::jsonb);

        ALTER TABLE groups DROP CONSTRAINT IF EXISTS groups_billing_mode_check;
        ALTER TABLE groups DROP CONSTRAINT IF EXISTS groups_credit_price_nonnegative_check;
        ALTER TABLE groups DROP COLUMN IF EXISTS billing_mode;
        ALTER TABLE groups DROP COLUMN IF EXISTS credit_price;
    END IF;
END $$;

COMMENT ON COLUMN groups.credit_billing IS '分组 Credit 计费：enabled/unit_price/started_at/cost_per_credit。未启用时按 token 计费。';

CREATE TABLE IF NOT EXISTS user_group_credit_prices (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    group_id BIGINT NOT NULL REFERENCES groups (id) ON DELETE CASCADE,
    credit_unit_price DECIMAL(20, 8) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT user_group_credit_prices_user_group_key UNIQUE (user_id, group_id),
    CONSTRAINT user_group_credit_prices_price_range CHECK (
        credit_unit_price >= 0.00000001 AND credit_unit_price <= 1000
    )
);

COMMENT ON TABLE user_group_credit_prices IS '用户在 credit 分组上的专属每积分单价，覆盖分组 unit_price。不是按模型定价。';

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
       AND OLD.credit_billing IS NOT DISTINCT FROM NEW.credit_billing
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
