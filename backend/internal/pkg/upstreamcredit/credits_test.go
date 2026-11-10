package upstreamcredit

import (
	"testing"
)

func TestSumMetering_KiroPayload(t *testing.T) {
	body := []byte(`{"unit":"credit","unitPlural":"credits","usage":0.0169543708291874}`)
	got := SumMetering(body)
	if got != 0.0169543708291874 {
		t.Fatalf("usage = %v", got)
	}
}

func TestSumMetering_AddsRepeatedCreditEvents(t *testing.T) {
	body := []byte(`{"type":"meteringEvent","unit":"credit","unitPlural":"credits","usage":0.2}{"type":"meteringEvent","unit":"credit","usage":0.344}`)
	got := SumMetering(body)
	if got < 0.543 || got > 0.545 {
		t.Fatalf("sum = %v, want 0.544", got)
	}
}

func TestSumMetering_IgnoresNonCreditUnits(t *testing.T) {
	body := []byte(`{"unit":"token","usage":10}{"unit":"credit","usage":0.544}`)
	got := SumMetering(body)
	if got != 0.544 {
		t.Fatalf("usage = %v", got)
	}
}

func TestExplicitSnapshot_WinsOverMetering(t *testing.T) {
	body := []byte(`{"usage":{"input_tokens":10,"credits":0.544},"events":[{"unit":"credit","usage":9}]}`)
	var state State
	state.Absorb(body)
	if !state.Explicit {
		t.Fatal("expected explicit snapshot")
	}
	if state.Credits != 0.544 {
		t.Fatalf("credits = %v", state.Credits)
	}
}

func TestAbsorb_SuperGPTDisplayQuantity(t *testing.T) {
	body := []byte("event: meteringEvent\ndata: {\"unit\":\"credit\",\"unitPlural\":\"credits\",\"usage\":0.544}\n")
	var state State
	state.Absorb(body)
	if state.Explicit {
		t.Fatal("metering usage is not an explicit snapshot")
	}
	if state.Credits != 0.544 {
		t.Fatalf("credits = %v", state.Credits)
	}
}

func TestExplicitSnapshot_IgnoresCreditBalanceObject(t *testing.T) {
	body := []byte(`{"credits":{"monthlyCredits":34.9,"purchasedCredits":0}}`)
	if _, ok := ExplicitSnapshot(body); ok {
		t.Fatal("balance object must not be treated as consumed credits")
	}
}

func TestAbsorb_ProviderUsageCredits(t *testing.T) {
	// Production Anthropic message body: tokens live on usage, consumed
	// credits live on provider_usage.credits.
	body := []byte(`{"id":"msg_smoke","type":"message","role":"assistant","model":"claude-haiku-4-5","content":[{"type":"text","text":"hi"}],"usage":{"input_tokens":12,"output_tokens":4},"provider_usage":{"provider":"kiro","credits":0.00428875}}`)
	var state State
	state.Absorb(body)
	if !state.Seen || !state.Explicit {
		t.Fatalf("seen=%v explicit=%v", state.Seen, state.Explicit)
	}
	if state.Credits != 0.00428875 {
		t.Fatalf("credits = %v", state.Credits)
	}
}

func TestExplicitSnapshot_UsageCreditsWinsOverProviderUsage(t *testing.T) {
	body := []byte(`{"usage":{"credits":0.544},"provider_usage":{"provider":"kiro","credits":0.00428875}}`)
	got, ok := ExplicitSnapshot(body)
	if !ok || got != 0.544 {
		t.Fatalf("credits = %v ok=%v", got, ok)
	}
}

func TestExplicitSnapshot_MessageProviderUsageCredits(t *testing.T) {
	body := []byte(`{"type":"message_start","message":{"usage":{"input_tokens":12},"provider_usage":{"provider":"kiro","credits":0.00428875}}}`)
	got, ok := ExplicitSnapshot(body)
	if !ok || got != 0.00428875 {
		t.Fatalf("credits = %v ok=%v", got, ok)
	}
}

func TestExplicitSnapshot_IgnoresProviderUsageCreditObject(t *testing.T) {
	body := []byte(`{"provider_usage":{"provider":"kiro","credits":{"monthlyCredits":34.9}}}`)
	if _, ok := ExplicitSnapshot(body); ok {
		t.Fatal("provider_usage.credits object must not be consumed credits")
	}
}

func TestAbsorb_StringCreditDoesNotDoubleCount(t *testing.T) {
	// Model text that mentions credits must not be parsed as a metering event
	// when it sits inside a JSON string.
	body := []byte(`{"output":"see {\"unit\":\"credit\",\"usage\":9}"}`)
	var state State
	state.Absorb(body)
	if state.Credits != 0 {
		t.Fatalf("credits = %v, want 0", state.Credits)
	}
}
