package dto

import (
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/service"
)

func TestCustomerGroupOmitsCreditInternals(t *testing.T) {
	cost := 0.075
	started := time.Date(2026, 10, 11, 18, 26, 36, 0, time.UTC)
	price := 0.02
	group := &service.Group{
		ID:             22,
		Name:           "kiro",
		Platform:       "anthropic",
		RateMultiplier: 1.6,
		Status:         service.StatusActive,
		CreditBilling: service.GroupCreditBilling{
			Enabled: true, UnitPrice: 0.144, StartedAt: &started, CostPerCredit: &cost,
		},
		PeakRateEnabled:           true,
		PeakRateMultiplier:        2,
		ImagePrice1K:              &price,
		ProfitControlEnabled:      true,
		ProfitMinMargin:           0.3,
		ProfitSafetyBuffer:        0.05,
		LongContextPricingEnabled: true,
	}

	user := marshalToMap(t, GroupFromService(group))
	for _, key := range profitControlJSONFields {
		if _, ok := user[key]; ok {
			t.Errorf("customer group leaked %q", key)
		}
	}
	if user["rate_multiplier"].(float64) != 0 || user["peak_rate_multiplier"].(float64) != 0 {
		t.Fatalf("customer group kept a multiplier: %v", user)
	}
	if user["image_price_1k"] != nil {
		t.Fatalf("customer group kept a token/image price: %v", user["image_price_1k"])
	}
	raw, _ := json.Marshal(user)
	if strings.Contains(string(raw), "cost_per_credit") || strings.Contains(string(raw), "profit_min_margin") || strings.Contains(string(raw), "1.6") {
		t.Fatalf("customer group JSON leaked internals: %s", raw)
	}
	cb := user["credit_billing"].(map[string]any)
	if cb["enabled"] != true || cb["unit_price"].(float64) != 0.144 {
		t.Fatalf("credit_billing=%v", cb)
	}
	if _, ok := cb["cost_per_credit"]; ok {
		t.Fatal("cost_per_credit leaked")
	}

	admin := marshalToMap(t, GroupFromServiceAdmin(group))
	if admin["rate_multiplier"].(float64) != 1.6 {
		t.Fatal("admin group should keep rate_multiplier")
	}
	if _, ok := admin["profit_min_margin"]; !ok {
		t.Fatal("admin group should keep profit_min_margin")
	}
	adminCredit := admin["credit_billing"].(map[string]any)
	if _, ok := adminCredit["cost_per_credit"]; !ok {
		t.Fatal("admin credit_billing should keep cost_per_credit")
	}
}

func TestCustomerUsageOmitsTokenCostsForCreditRows(t *testing.T) {
	mode := "kiro_credit"
	credits := 0.544
	price := 0.144
	log := &service.UsageLog{
		ID: 1, UserID: 2, APIKeyID: 3, AccountID: 4, Model: "claude",
		InputTokens: 1000, OutputTokens: 20,
		InputCost: 1.2, OutputCost: 0.4, CacheReadCost: 0.1, TotalCost: 9, ActualCost: 0.078336,
		RateMultiplier: 1.6,
		Credits:        &credits,
		CreditPrice:    &price,
		BillingMode:    &mode,
	}
	fields := marshalToMap(t, UsageLogFromService(log))
	if fields["rate_multiplier"].(float64) != 0 || fields["input_cost"].(float64) != 0 || fields["output_cost"].(float64) != 0 || fields["cache_read_cost"].(float64) != 0 {
		t.Fatalf("credit usage kept token costs or a multiplier: %v", fields)
	}
	if fields["actual_cost"].(float64) != 0.078336 || fields["total_cost"].(float64) != 0.078336 {
		t.Fatalf("sell amount=%v total=%v", fields["actual_cost"], fields["total_cost"])
	}
	if fields["credits"].(float64) != 0.544 || fields["credit_price"].(float64) != 0.144 {
		t.Fatalf("snapshot=%v", fields)
	}
	raw, _ := json.Marshal(fields)
	if strings.Contains(string(raw), "cost_per_credit") || strings.Contains(string(raw), "account_stats_cost") || strings.Contains(string(raw), "account_rate_multiplier") {
		t.Fatalf("usage JSON leaked internals: %s", raw)
	}

	tokenMode := "token"
	token := marshalToMap(t, UsageLogFromService(&service.UsageLog{
		ID: 2, Model: "claude", InputCost: 0.1, TotalCost: 0.2, ActualCost: 0.3, RateMultiplier: 1.5,
		BillingMode: &tokenMode,
	}))
	if _, ok := token["rate_multiplier"]; !ok {
		t.Fatal("token usage should keep rate_multiplier")
	}
	if token["input_cost"].(float64) != 0.1 || token["total_cost"].(float64) != 0.2 {
		t.Fatalf("token costs changed: %v", token)
	}
}
