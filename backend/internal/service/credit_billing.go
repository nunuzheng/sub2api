package service

import (
	"fmt"
	"math"
	"strings"

	"github.com/Wei-Shaw/sub2api/internal/pkg/logger"
	"github.com/Wei-Shaw/sub2api/internal/pkg/upstreamcredit"
)

const (
	// GroupBillingModeToken is the default group billing mode. Customer cost
	// stays on the existing token / per-request / image / video paths, including
	// rate_multiplier.
	GroupBillingModeToken = "token"
	// GroupBillingModeCredit bills the customer for upstream consumed credits:
	// actual_cost = credits × group credit_price. rate_multiplier is not applied.
	GroupBillingModeCredit = "credit"
)

// GroupBillingModeOrToken maps empty storage to token and leaves an explicit
// credit value intact. Invalid values fall back to token so a bad row cannot
// change the default billing path.
func GroupBillingModeOrToken(mode string) string {
	normalized, err := NormalizeGroupBillingMode(mode)
	if err != nil {
		return GroupBillingModeToken
	}
	return normalized
}

// NormalizeGroupBillingMode accepts only token (default) and credit.
func NormalizeGroupBillingMode(mode string) (string, error) {
	switch strings.ToLower(strings.TrimSpace(mode)) {
	case "", GroupBillingModeToken:
		return GroupBillingModeToken, nil
	case GroupBillingModeCredit:
		return GroupBillingModeCredit, nil
	default:
		return "", fmt.Errorf("billing_mode must be token or credit")
	}
}

// NormalizeGroupCreditPrice rejects negative and non-finite prices.
// Zero is allowed and means a credit-mode group charges nothing until an
// admin sets a price. The price is never hardcoded.
func NormalizeGroupCreditPrice(price float64) (float64, error) {
	if math.IsNaN(price) || math.IsInf(price, 0) || price < 0 {
		return 0, fmt.Errorf("credit_price must be >= 0")
	}
	return price, nil
}

// UsesCreditBilling reports whether this group deducts customer balance from
// upstream credits. Empty and token modes stay on the existing billing path.
func (g *Group) UsesCreditBilling() bool {
	return g != nil && strings.EqualFold(strings.TrimSpace(g.BillingMode), GroupBillingModeCredit)
}

// creditBillingCost is the customer charge for a credit-mode group.
// It returns nil for token groups so callers leave the existing cost path
// untouched. The charge is credits × credit_price and does not include
// rate_multiplier, peak multiplier, or the model token price table.
func creditBillingCost(group *Group, credits float64) *CostBreakdown {
	if group == nil || !group.UsesCreditBilling() {
		return nil
	}
	credits = normalizeCreditQuantity(credits)
	price, err := NormalizeGroupCreditPrice(group.CreditPrice)
	if err != nil {
		price = 0
	}
	if credits == 0 {
		logger.LegacyPrintf("service.billing", "[Billing] credit mode group=%d has no consumed credits; actual_cost=0 (credit_price=%v)", group.ID, price)
	}
	charge := QuantizeUsageBillingAmount(credits * price)
	return &CostBreakdown{
		TotalCost:   charge,
		ActualCost:  charge,
		BillingMode: GroupBillingModeCredit,
		Credits:     credits,
		CreditPrice: price,
	}
}

func normalizeCreditQuantity(credits float64) float64 {
	if math.IsNaN(credits) || math.IsInf(credits, 0) || credits < 0 {
		return 0
	}
	return credits
}

// applyCreditBillingSnapshot records the credit charge on a usage log and
// forces the stored multiplier to 1. Token-mode logs are left unchanged.
func applyCreditBillingSnapshot(log *UsageLog, cost *CostBreakdown) {
	if log == nil || cost == nil || cost.BillingMode != GroupBillingModeCredit {
		return
	}
	mode := GroupBillingModeCredit
	log.BillingMode = &mode
	log.InputCost = 0
	log.OutputCost = 0
	log.ImageInputCost = 0
	log.ImageOutputCost = 0
	log.CacheCreationCost = 0
	log.CacheReadCost = 0
	log.TotalCost = cost.TotalCost
	log.ActualCost = cost.ActualCost
	log.LongContextBillingApplied = false
	log.RateMultiplier = 1
	credits := cost.Credits
	price := cost.CreditPrice
	log.Credits = &credits
	log.CreditPrice = &price
}

func absorbClaudeCredits(usage *ClaudeUsage, body []byte) {
	if usage == nil || len(body) == 0 {
		return
	}
	state := upstreamcredit.State{Credits: usage.Credits, Explicit: usage.creditsExplicit}
	state.Absorb(body)
	usage.Credits = state.Credits
	usage.creditsExplicit = state.Explicit
}

func absorbOpenAICredits(usage *OpenAIUsage, body []byte) {
	if usage == nil || len(body) == 0 {
		return
	}
	state := upstreamcredit.State{Credits: usage.Credits, Explicit: usage.CreditsExplicit}
	state.Absorb(body)
	usage.Credits = state.Credits
	usage.CreditsExplicit = state.Explicit
}

// assignOpenAIUsagePreserveCredits copies src onto dst. Credit deltas already
// observed on dst are kept when src does not carry an explicit snapshot, so a
// later token usage event does not drop a Kiro metering event.
func assignOpenAIUsagePreserveCredits(dst *OpenAIUsage, src OpenAIUsage) {
	if dst == nil {
		return
	}
	prev, prevExplicit := dst.Credits, dst.CreditsExplicit
	*dst = src
	if src.CreditsExplicit {
		return
	}
	if src.Credits > 0 && !prevExplicit {
		dst.Credits = prev + src.Credits
		return
	}
	if src.Credits == 0 && prev > 0 {
		dst.Credits = prev
		dst.CreditsExplicit = prevExplicit
	}
}
