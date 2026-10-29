package domain

import "time"

// GroupCreditBilling is the group-level credit billing object.
// Enabled groups charge actual_cost = upstream credits × effective unit price.
// Token groups leave this disabled and keep the existing price-table path.
// CostPerCredit is an admin-only bookkeeping field and must not be shown to customers.
type GroupCreditBilling struct {
	Enabled       bool       `json:"enabled"`
	UnitPrice     float64    `json:"unit_price"`
	StartedAt     *time.Time `json:"started_at,omitempty"`
	CostPerCredit *float64   `json:"cost_per_credit,omitempty"`
}

// Public returns the customer-visible billing object. Cost is omitted.
func (b GroupCreditBilling) Public() GroupCreditBilling {
	b.CostPerCredit = nil
	return b
}
