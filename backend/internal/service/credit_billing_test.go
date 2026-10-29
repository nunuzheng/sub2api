package service

import "testing"

func TestCreditBillingCost_SuperGPTExample(t *testing.T) {
	// Usage page口径: 0.544 credit × $0.08/credit.
	group := &Group{ID: 7, BillingMode: GroupBillingModeCredit, CreditPrice: 0.08, RateMultiplier: 3}
	cost := creditBillingCost(group, 0.544)
	if cost == nil {
		t.Fatal("expected credit cost")
	}
	const want = 0.04352
	if cost.ActualCost != want || cost.TotalCost != want {
		t.Fatalf("actual=%v total=%v, want %v", cost.ActualCost, cost.TotalCost, want)
	}
	if cost.BillingMode != GroupBillingModeCredit {
		t.Fatalf("mode=%s", cost.BillingMode)
	}
	if cost.Credits != 0.544 || cost.CreditPrice != 0.08 {
		t.Fatalf("credits=%v price=%v", cost.Credits, cost.CreditPrice)
	}
}

func TestCreditBillingCost_DoesNotApplyRateMultiplier(t *testing.T) {
	group := &Group{BillingMode: GroupBillingModeCredit, CreditPrice: 0.08, RateMultiplier: 2, PeakRateMultiplier: 4}
	cost := creditBillingCost(group, 1)
	if cost.ActualCost != 0.08 {
		t.Fatalf("actual=%v, want 0.08 without rate_multiplier", cost.ActualCost)
	}
}

func TestCreditBillingCost_TokenModeUnchanged(t *testing.T) {
	for _, mode := range []string{"", GroupBillingModeToken, "TOKEN"} {
		group := &Group{BillingMode: mode, CreditPrice: 0.08, RateMultiplier: 2}
		if mode == "TOKEN" {
			// Only the exact credit mode switches. Unknown values are not credit.
		}
		if got := creditBillingCost(group, 0.544); got != nil {
			t.Fatalf("mode %q returned a credit cost", mode)
		}
		if group.UsesCreditBilling() {
			t.Fatalf("mode %q must stay on the token path", mode)
		}
	}
}

func TestNormalizeGroupBillingMode(t *testing.T) {
	mode, err := NormalizeGroupBillingMode(" credit ")
	if err != nil || mode != GroupBillingModeCredit {
		t.Fatalf("mode=%s err=%v", mode, err)
	}
	mode, err = NormalizeGroupBillingMode("")
	if err != nil || mode != GroupBillingModeToken {
		t.Fatalf("default mode=%s err=%v", mode, err)
	}
	if _, err := NormalizeGroupBillingMode("image"); err == nil {
		t.Fatal("expected invalid mode")
	}
}

func TestNormalizeGroupCreditPrice(t *testing.T) {
	price, err := NormalizeGroupCreditPrice(0.08)
	if err != nil || price != 0.08 {
		t.Fatalf("price=%v err=%v", price, err)
	}
	if _, err := NormalizeGroupCreditPrice(-0.01); err == nil {
		t.Fatal("expected negative price to be rejected")
	}
}

func TestApplyCreditBillingSnapshot_ForcesMultiplierOne(t *testing.T) {
	mode := GroupBillingModeCredit
	cost := &CostBreakdown{TotalCost: 0.04352, ActualCost: 0.04352, BillingMode: mode, Credits: 0.544, CreditPrice: 0.08}
	log := &UsageLog{RateMultiplier: 3, InputCost: 1, BillingMode: &mode}
	applyCreditBillingSnapshot(log, cost)
	if log.RateMultiplier != 1 {
		t.Fatalf("multiplier=%v", log.RateMultiplier)
	}
	if log.ActualCost != 0.04352 || log.InputCost != 0 {
		t.Fatalf("actual=%v input=%v", log.ActualCost, log.InputCost)
	}
	if log.Credits == nil || *log.Credits != 0.544 || log.CreditPrice == nil || *log.CreditPrice != 0.08 {
		t.Fatalf("snapshot credits=%v price=%v", log.Credits, log.CreditPrice)
	}
}

func TestParseSSEUsage_CreditMeteringSurvivesLaterTokenUsage(t *testing.T) {
	svc := &OpenAIGatewayService{}
	usage := &OpenAIUsage{}
	svc.parseSSEUsageBytes([]byte(`{"type":"meteringEvent","unit":"credit","unitPlural":"credits","usage":0.544}`), usage)
	svc.parseSSEUsageBytes([]byte(`{"type":"response.completed","response":{"usage":{"input_tokens":10,"output_tokens":2}}}`), usage)
	if usage.Credits != 0.544 {
		t.Fatalf("credits=%v", usage.Credits)
	}
	if usage.InputTokens != 10 || usage.OutputTokens != 2 {
		t.Fatalf("tokens in=%d out=%d", usage.InputTokens, usage.OutputTokens)
	}
}

func TestApplyCreditBillingSnapshot_IgnoresTokenCost(t *testing.T) {
	log := &UsageLog{RateMultiplier: 1.5, ActualCost: 0.2}
	applyCreditBillingSnapshot(log, &CostBreakdown{BillingMode: GroupBillingModeToken, ActualCost: 9, Credits: 1, CreditPrice: 1})
	if log.RateMultiplier != 1.5 || log.ActualCost != 0.2 || log.Credits != nil {
		t.Fatalf("token log was modified: %+v", log)
	}
}
