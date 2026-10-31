package repository

import (
	"context"
	"testing"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/stretchr/testify/require"
)

func TestAPIKeyRepository_GetByKeyForAuth_CarriesCreditBilling_SQLite(t *testing.T) {
	repo, client := newAPIKeyRepoSQLite(t)
	ctx := context.Background()
	user := mustCreateAPIKeyRepoUser(t, ctx, client, "getbykey-auth-credit-billing@test.com")

	started := time.Date(2026, 10, 31, 5, 6, 15, 0, time.UTC)
	cost := 0.08
	group, err := client.Group.Create().
		SetName("g-auth-credit-billing").
		SetPlatform(service.PlatformAnthropic).
		SetStatus(service.StatusActive).
		SetSubscriptionType(service.SubscriptionTypeStandard).
		SetRateMultiplier(1).
		SetCreditBilling(service.GroupCreditBilling{
			Enabled:       true,
			UnitPrice:     0.13,
			StartedAt:     &started,
			CostPerCredit: &cost,
		}).
		Save(ctx)
	require.NoError(t, err)

	key := &service.APIKey{
		UserID:  user.ID,
		Key:     "sk-getbykey-auth-credit-billing",
		Name:    "Credit Billing Key",
		GroupID: &group.ID,
		Status:  service.StatusActive,
	}
	require.NoError(t, repo.Create(ctx, key))

	got, err := repo.GetByKeyForAuth(ctx, key.Key)
	require.NoError(t, err)
	require.NotNil(t, got.Group)
	require.True(t, got.Group.UsesCreditBilling(), "credit_billing.enabled 必须进入认证投影（漏列会按 token 价表扣费）")
	require.True(t, got.Group.CreditBilling.Enabled)
	require.InDelta(t, 0.13, got.Group.CreditBilling.UnitPrice, 1e-9)
	require.NotNil(t, got.Group.CreditBilling.StartedAt)
	require.True(t, started.Equal(got.Group.CreditBilling.StartedAt.UTC()))
	require.NotNil(t, got.Group.CreditBilling.CostPerCredit)
	require.InDelta(t, 0.08, *got.Group.CreditBilling.CostPerCredit, 1e-9)
}
