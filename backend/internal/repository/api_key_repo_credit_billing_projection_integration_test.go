//go:build integration

package repository

// 投影漏列回归（repository 半程）：真实 PostgreSQL 上认证专用
// 查询 GetByKeyForAuth 的分组显式投影必须携带 credit_billing。该查询是
// 认证快照（进而是 UsesCreditBilling）的唯一数据来源，漏选会让已启用
// credit 分组仍按 token 价表扣费，并把零值固化进认证缓存。新增快照分组
// 字段时必须同步扩展 GetByKeyForAuth 的 WithGroup Select 并在本测试补断言。

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/stretchr/testify/require"
)

func TestGetByKeyForAuthCarriesCreditBillingProjection(t *testing.T) {
	ctx := context.Background()
	suffix := time.Now().UnixNano()
	started := time.Date(2026, 10, 31, 5, 6, 15, 0, time.UTC)
	cost := 0.08
	group := mustCreateGroup(t, integrationEntClient, &service.Group{
		Name:           fmt.Sprintf("credit-proj-group-%d", suffix),
		Platform:       service.PlatformAnthropic,
		RateMultiplier: 1,
		CreditBilling: service.GroupCreditBilling{
			Enabled:       true,
			UnitPrice:     0.13,
			StartedAt:     &started,
			CostPerCredit: &cost,
		},
	})
	user := mustCreateUser(t, integrationEntClient, &service.User{
		Email: fmt.Sprintf("credit-proj-%d@example.com", suffix), Concurrency: 5,
	})
	groupID := group.ID
	keyValue := fmt.Sprintf("sk-credit-proj-%d", suffix)
	apiKeyRepo := NewAPIKeyRepository(integrationEntClient, integrationDB)
	key := &service.APIKey{UserID: user.ID, GroupID: &groupID, Key: keyValue, Name: "credit-proj", Status: service.StatusActive}
	require.NoError(t, apiKeyRepo.Create(ctx, key))
	t.Cleanup(func() {
		_, err := integrationDB.ExecContext(ctx, "DELETE FROM auth_cache_invalidation_outbox WHERE cache_key = encode(sha256(convert_to($1, 'UTF8')), 'hex')", keyValue)
		require.NoError(t, err)
		_, err = integrationDB.ExecContext(ctx, "DELETE FROM api_keys WHERE id = $1", key.ID)
		require.NoError(t, err)
		_, err = integrationDB.ExecContext(ctx, "DELETE FROM users WHERE id = $1", user.ID)
		require.NoError(t, err)
		_, err = integrationDB.ExecContext(ctx, "DELETE FROM groups WHERE id = $1", group.ID)
		require.NoError(t, err)
	})

	got, err := apiKeyRepo.GetByKeyForAuth(ctx, keyValue)
	require.NoError(t, err)
	require.NotNil(t, got.Group, "认证查询必须带出分组")

	require.True(t, got.Group.UsesCreditBilling(), "credit_billing.enabled 必须进入认证投影（漏列会按 token 价表扣费）")
	require.True(t, got.Group.CreditBilling.Enabled)
	require.InDelta(t, 0.13, got.Group.CreditBilling.UnitPrice, 1e-9)
	require.NotNil(t, got.Group.CreditBilling.StartedAt)
	require.True(t, started.Equal(got.Group.CreditBilling.StartedAt.UTC()))
	require.NotNil(t, got.Group.CreditBilling.CostPerCredit)
	require.InDelta(t, 0.08, *got.Group.CreditBilling.CostPerCredit, 1e-9)
}
