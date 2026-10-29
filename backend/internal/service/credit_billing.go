package service

import (
	"context"
	"fmt"
	"math"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/domain"
	"github.com/Wei-Shaw/sub2api/internal/pkg/logger"
	"github.com/Wei-Shaw/sub2api/internal/pkg/upstreamcredit"
)

const (
	// Usage billing_mode values for credit-enabled groups. Token and the other
	// existing modes are unchanged.
	BillingModeKiroCredit        = "kiro_credit"
	BillingModeKiroCreditMissing = "kiro_credit_missing"
	BillingModeKiroCreditError   = "kiro_credit_error"

	creditUnitPriceMin = 1e-8
	creditUnitPriceMax = 1000
)

// GroupCreditBilling is the public group object. CostPerCredit is admin-only.
type GroupCreditBilling = domain.GroupCreditBilling

// UsesCreditBilling reports whether customer charges use upstream credits.
// Disabled and zero-value groups stay on the token path.
func (g *Group) UsesCreditBilling() bool {
	return g != nil && g.CreditBilling.Enabled
}

// ValidCreditUnitPrice is the admin range $1e-8..$1000.
func ValidCreditUnitPrice(price float64) bool {
	return !math.IsNaN(price) && !math.IsInf(price, 0) && price >= creditUnitPriceMin && price <= creditUnitPriceMax
}

func normalizeCreditQuantity(credits float64) float64 {
	if math.IsNaN(credits) || math.IsInf(credits, 0) || credits < 0 {
		return 0
	}
	return credits
}

// applyGroupCreditBillingUpdate merges an admin credit_billing payload.
// Once enabled, the group stays enabled and started_at is preserved.
func applyGroupCreditBillingUpdate(current GroupCreditBilling, input *GroupCreditBilling) (GroupCreditBilling, error) {
	if input == nil {
		return current, nil
	}
	if current.Enabled {
		if !ValidCreditUnitPrice(input.UnitPrice) {
			return current, fmt.Errorf("credit unit_price must be between 1e-8 and 1000")
		}
		next := current
		next.Enabled = true
		next.UnitPrice = input.UnitPrice
		if input.CostPerCredit != nil {
			if *input.CostPerCredit < 0 {
				return current, fmt.Errorf("cost_per_credit must be >= 0")
			}
			cost := *input.CostPerCredit
			next.CostPerCredit = &cost
		}
		return next, nil
	}
	if !input.Enabled {
		return current, nil
	}
	if !ValidCreditUnitPrice(input.UnitPrice) {
		return current, fmt.Errorf("credit unit_price must be between 1e-8 and 1000")
	}
	now := time.Now().UTC()
	next := GroupCreditBilling{
		Enabled:   true,
		UnitPrice: input.UnitPrice,
		StartedAt: &now,
	}
	if input.CostPerCredit != nil {
		if *input.CostPerCredit < 0 {
			return current, fmt.Errorf("cost_per_credit must be >= 0")
		}
		cost := *input.CostPerCredit
		next.CostPerCredit = &cost
	}
	return next, nil
}

// creditBillingCost is the customer charge for a credit-enabled group.
// It returns nil when the group is not credit-enabled, so token billing is unchanged.
// actual_cost = credits × unitPrice. rate_multiplier, peak rate, and token prices are not applied.
func creditBillingCost(group *Group, unitPrice, credits float64, seen bool) *CostBreakdown {
	if group == nil || !group.UsesCreditBilling() {
		return nil
	}
	credits = normalizeCreditQuantity(credits)
	if !seen {
		logger.LegacyPrintf("service.billing", "[Billing] credit group=%d has no upstream credits; billing_mode=%s actual_cost=0", group.ID, BillingModeKiroCreditMissing)
		return &CostBreakdown{
			BillingMode: BillingModeKiroCreditMissing,
			CreditPrice: unitPrice,
		}
	}
	if !ValidCreditUnitPrice(unitPrice) {
		logger.LegacyPrintf("service.billing", "[Billing] credit group=%d unit price %v is outside 1e-8..1000; billing_mode=%s actual_cost=0", group.ID, unitPrice, BillingModeKiroCreditError)
		return &CostBreakdown{
			BillingMode: BillingModeKiroCreditError,
			Credits:     credits,
			CreditPrice: unitPrice,
		}
	}
	charge := QuantizeUsageBillingAmount(credits * unitPrice)
	return &CostBreakdown{
		TotalCost:   charge,
		ActualCost:  charge,
		BillingMode: BillingModeKiroCredit,
		Credits:     credits,
		CreditPrice: unitPrice,
	}
}

func isKiroCreditBillingMode(mode string) bool {
	switch mode {
	case BillingModeKiroCredit, BillingModeKiroCreditMissing, BillingModeKiroCreditError:
		return true
	default:
		return false
	}
}

// applyCreditBillingSnapshot records the credit charge. Token logs are unchanged.
// The stored unit price is the price used for this request, so a later group
// price change does not rewrite the historical row.
func applyCreditBillingSnapshot(log *UsageLog, cost *CostBreakdown) {
	if log == nil || cost == nil || !isKiroCreditBillingMode(cost.BillingMode) {
		return
	}
	mode := cost.BillingMode
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
	if cost.BillingMode == BillingModeKiroCredit || cost.BillingMode == BillingModeKiroCreditError {
		credits := cost.Credits
		log.Credits = &credits
	}
	if cost.CreditPrice > 0 || cost.BillingMode == BillingModeKiroCredit {
		price := cost.CreditPrice
		log.CreditPrice = &price
	}
}

// UserGroupCreditPriceRepository is the per-user $/credit override store.
// Implementations may be the same concrete repo as user group rates.
type UserGroupCreditPriceRepository interface {
	GetCreditUnitPrice(ctx context.Context, userID, groupID int64) (*float64, error)
	ListCreditUnitPricesByUser(ctx context.Context, userID int64) (map[int64]float64, error)
	ListCreditUnitPrices(ctx context.Context, groupID int64) ([]UserGroupCreditPriceEntry, error)
	ReplaceCreditUnitPrices(ctx context.Context, groupID int64, entries []GroupCreditPriceInput) error
}

// UserGroupCreditPriceEntry is one user's override inside a credit group.
type UserGroupCreditPriceEntry struct {
	UserID          int64   `json:"user_id"`
	UserName        string  `json:"user_name"`
	UserEmail       string  `json:"user_email"`
	CreditUnitPrice float64 `json:"credit_unit_price"`
}

// GroupCreditPriceInput is one PUT /admin/groups/{id}/credit-prices entry.
type GroupCreditPriceInput struct {
	UserID          int64   `json:"user_id"`
	CreditUnitPrice float64 `json:"credit_unit_price"`
}

func effectiveCreditUnitPrice(ctx context.Context, repo UserGroupRateRepository, group *Group, userID int64) float64 {
	if group == nil {
		return 0
	}
	price := group.CreditBilling.UnitPrice
	store, ok := repo.(UserGroupCreditPriceRepository)
	if !ok || store == nil || userID <= 0 || group.ID <= 0 {
		return price
	}
	override, err := store.GetCreditUnitPrice(ctx, userID, group.ID)
	if err != nil || override == nil {
		return price
	}
	return *override
}

func absorbClaudeCredits(usage *ClaudeUsage, body []byte) {
	if usage == nil || len(body) == 0 {
		return
	}
	state := upstreamcredit.State{Credits: usage.Credits, Explicit: usage.creditsExplicit, Seen: usage.CreditsSeen}
	state.Absorb(body)
	usage.Credits = state.Credits
	usage.creditsExplicit = state.Explicit
	usage.CreditsSeen = state.Seen
}

func absorbOpenAICredits(usage *OpenAIUsage, body []byte) {
	if usage == nil || len(body) == 0 {
		return
	}
	state := upstreamcredit.State{Credits: usage.Credits, Explicit: usage.CreditsExplicit, Seen: usage.CreditsSeen}
	state.Absorb(body)
	usage.Credits = state.Credits
	usage.CreditsExplicit = state.Explicit
	usage.CreditsSeen = state.Seen
}

func assignOpenAIUsagePreserveCredits(dst *OpenAIUsage, src OpenAIUsage) {
	if dst == nil {
		return
	}
	prev, prevExplicit, prevSeen := dst.Credits, dst.CreditsExplicit, dst.CreditsSeen
	*dst = src
	if src.CreditsExplicit || src.CreditsSeen {
		return
	}
	if prevSeen {
		dst.Credits = prev
		dst.CreditsExplicit = prevExplicit
		dst.CreditsSeen = true
	}
}
