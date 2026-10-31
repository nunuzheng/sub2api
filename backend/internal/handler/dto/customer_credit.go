package dto

// sanitizeCustomerCreditGroup removes markup and token prices from a user-facing
// group. AdminGroup is built from groupFromServiceBase and keeps those fields.
// Credit groups bill credits × unit_price, so a leftover rate or token price
// would reveal the markup.
func sanitizeCustomerCreditGroup(g *Group) {
	if g == nil || g.CreditBilling == nil || !g.CreditBilling.Enabled {
		return
	}
	pub := g.CreditBilling.Public()
	g.CreditBilling = &pub
	g.RateMultiplier = 0
	g.ImageRateIndependent = false
	g.ImageRateMultiplier = 0
	g.BatchImageDiscountMultiplier = 0
	g.BatchImageHoldMultiplier = 0
	g.VideoRateIndependent = false
	g.VideoRateMultiplier = 0
	g.PeakRateEnabled = false
	g.PeakStart = ""
	g.PeakEnd = ""
	g.PeakRateMultiplier = 0
	g.ImagePrice1K = nil
	g.ImagePrice2K = nil
	g.ImagePrice4K = nil
	g.VideoPrice480P = nil
	g.VideoPrice720P = nil
	g.VideoPrice1080P = nil
	g.VideoModelPrices = nil
	g.WebSearchPricePerCall = nil
	g.SearchPricePer1k = nil
	g.AudioRealtimePricePerMin = nil
	g.AudioTtsPricePerMillionChars = nil
	g.AudioSttPricePerHour = nil
	g.LongContextPricingEnabled = false
}

func isCustomerCreditUsageMode(mode string) bool {
	switch mode {
	case "kiro_credit", "kiro_credit_missing", "kiro_credit_error":
		return true
	default:
		return false
	}
}
