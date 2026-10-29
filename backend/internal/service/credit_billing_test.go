package service

import "testing"

func TestCreditBillingCost_CreditsTimesUnitPrice(t *testing.T) {
	group := &Group{
		ID:             7,
		RateMultiplier: 3,
		CreditBilling:  GroupCreditBilling{Enabled: true, UnitPrice: 0.144},
	}
	cost := creditBillingCost(group, 0.144, 0.544, true)
	if cost == nil {
		t.Fatal("expected credit cost")
	}
	const want = 0.078336
	if cost.ActualCost != want || cost.TotalCost != want {
		t.Fatalf("actual=%v total=%v, want %v", cost.ActualCost, cost.TotalCost, want)
	}
	if cost.BillingMode != BillingModeKiroCredit {
		t.Fatalf("mode=%s", cost.BillingMode)
	}
	if cost.CreditPrice != 0.144 {
		t.Fatalf("snapshot price=%v", cost.CreditPrice)
	}
}

func TestCreditBillingCost_DoesNotApplyRateMultiplier(t *testing.T) {
	group := &Group{
		RateMultiplier:     2,
		PeakRateMultiplier: 4,
		CreditBilling:      GroupCreditBilling{Enabled: true, UnitPrice: 0.144},
	}
	// Caller passes the effective unit price. A group multiplier must not be folded in.
	cost := creditBillingCost(group, 0.144, 1, true)
	if cost.ActualCost != 0.144 {
		t.Fatalf("actual=%v, want 0.144", cost.ActualCost)
	}
}

func TestCreditBillingCost_UserOverrideIsTheEffectivePrice(t *testing.T) {
	group := &Group{CreditBilling: GroupCreditBilling{Enabled: true, UnitPrice: 0.144}}
	cost := creditBillingCost(group, 0.2, 2, true)
	if cost.ActualCost != 0.4 || cost.CreditPrice != 0.2 {
		t.Fatalf("actual=%v price=%v", cost.ActualCost, cost.CreditPrice)
	}
}

func TestCreditBillingCost_TokenGroupUnchanged(t *testing.T) {
	group := &Group{RateMultiplier: 2, CreditBilling: GroupCreditBilling{UnitPrice: 0.144}}
	if group.UsesCreditBilling() {
		t.Fatal("disabled credit billing must stay on the token path")
	}
	if got := creditBillingCost(group, 0.144, 1, true); got != nil {
		t.Fatal("token group must not produce a credit cost")
	}
}

func TestCreditBillingCost_MissingAndErrorModes(t *testing.T) {
	group := &Group{ID: 3, CreditBilling: GroupCreditBilling{Enabled: true, UnitPrice: 0.144}}
	missing := creditBillingCost(group, 0.144, 0, false)
	if missing.BillingMode != BillingModeKiroCreditMissing || missing.ActualCost != 0 {
		t.Fatalf("missing=%+v", missing)
	}
	bad := creditBillingCost(group, 0, 1, true)
	if bad.BillingMode != BillingModeKiroCreditError || bad.ActualCost != 0 {
		t.Fatalf("error=%+v", bad)
	}
}

func TestApplyCreditBillingSnapshot_StableWhenPriceLaterChanges(t *testing.T) {
	cost := creditBillingCost(&Group{CreditBilling: GroupCreditBilling{Enabled: true, UnitPrice: 0.144}}, 0.144, 0.544, true)
	log := &UsageLog{RateMultiplier: 3, InputCost: 1}
	applyCreditBillingSnapshot(log, cost)
	if log.RateMultiplier != 1 || log.ActualCost != cost.ActualCost {
		t.Fatalf("log=%+v", log)
	}
	if log.CreditPrice == nil || *log.CreditPrice != 0.144 || log.Credits == nil {
		t.Fatalf("snapshot credits=%v price=%v", log.Credits, log.CreditPrice)
	}
	// A later group price does not rewrite the stored snapshot.
	if *log.CreditPrice == 0.2 {
		t.Fatal("snapshot followed a later price")
	}
}

func TestApplyGroupCreditBillingUpdate_StaysEnabled(t *testing.T) {
	current, err := applyGroupCreditBillingUpdate(GroupCreditBilling{}, &GroupCreditBilling{Enabled: true, UnitPrice: 0.144})
	if err != nil || !current.Enabled || current.StartedAt == nil {
		t.Fatalf("enable: %+v err=%v", current, err)
	}
	started := *current.StartedAt
	next, err := applyGroupCreditBillingUpdate(current, &GroupCreditBilling{Enabled: false, UnitPrice: 0.2})
	if err != nil {
		t.Fatal(err)
	}
	if !next.Enabled || next.UnitPrice != 0.2 || next.StartedAt == nil || !next.StartedAt.Equal(started) {
		t.Fatalf("update: %+v", next)
	}
}

func TestApplyCreditBillingSnapshot_IgnoresTokenCost(t *testing.T) {
	log := &UsageLog{RateMultiplier: 1.5, ActualCost: 0.2}
	applyCreditBillingSnapshot(log, &CostBreakdown{BillingMode: string(BillingModeToken), ActualCost: 9})
	if log.RateMultiplier != 1.5 || log.ActualCost != 0.2 || log.Credits != nil {
		t.Fatalf("token log was modified: %+v", log)
	}
}

func TestParseSSEUsage_CreditMeteringSurvivesLaterTokenUsage(t *testing.T) {
	svc := &OpenAIGatewayService{}
	usage := &OpenAIUsage{}
	svc.parseSSEUsageBytes([]byte(`{"type":"meteringEvent","unit":"credit","unitPlural":"credits","usage":0.544}`), usage)
	svc.parseSSEUsageBytes([]byte(`{"type":"response.completed","response":{"usage":{"input_tokens":10,"output_tokens":2}}}`), usage)
	if !usage.CreditsSeen || usage.Credits != 0.544 {
		t.Fatalf("credits=%v seen=%v", usage.Credits, usage.CreditsSeen)
	}
	if usage.InputTokens != 10 || usage.OutputTokens != 2 {
		t.Fatalf("tokens in=%d out=%d", usage.InputTokens, usage.OutputTokens)
	}
}
