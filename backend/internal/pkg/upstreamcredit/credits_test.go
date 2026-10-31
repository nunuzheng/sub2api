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
