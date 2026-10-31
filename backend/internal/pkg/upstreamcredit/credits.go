// Package upstreamcredit reads consumed credits from an upstream response.
//
// Kiro (and SuperGPT's Kiro groups) meter a request with an event payload
// {"unit":"credit","unitPlural":"credits","usage":<float>}. That usage value is
// the credits consumed by the request. It is not a token count and it is not a
// dollar amount. Official Kiro CLI aggregates repeated credit events in one
// response by summing them. An explicit numeric usage.credits (or credits_used)
// field is a snapshot of the same quantity and wins over metering events in
// the same body so the two are not added together.
package upstreamcredit

import (
	"bytes"
	"math"
	"strings"

	"github.com/tidwall/gjson"
)

// State is the credits observed so far for one response.
// Explicit means a usage snapshot was seen and later metering deltas in the
// same body must not be added on top of it.
type State struct {
	Credits  float64
	Explicit bool
	// Seen is true when this body (or an earlier one) carried a credit snapshot
	// or a positive metering event. Absent credits stay Seen=false.
	Seen bool
}

// Absorb merges credits found in body into the state.
// A numeric usage snapshot replaces the current value. Metering events are
// summed only when no snapshot has been seen.
func (s *State) Absorb(body []byte) {
	if s == nil || len(body) == 0 || !bytes.Contains(body, []byte("credit")) {
		return
	}
	if snap, ok := ExplicitSnapshot(body); ok {
		s.Credits = normalizeQuantity(snap)
		s.Explicit = true
		s.Seen = true
		return
	}
	if s.Explicit {
		return
	}
	if sum := SumMetering(body); sum > 0 {
		s.Credits += sum
		s.Seen = true
	}
}

// ExplicitSnapshot returns a numeric consumed-credit snapshot from a usage
// object. Objects (for example a credit balance blob) are ignored.
func ExplicitSnapshot(body []byte) (float64, bool) {
	if len(body) == 0 || !gjson.ValidBytes(body) {
		return 0, false
	}
	for _, path := range []string{
		"usage.credits",
		"usage.credit",
		"usage.credits_used",
		"usage.consumed_credits",
		"response.usage.credits",
		"response.usage.credits_used",
		"message.usage.credits",
		"message.usage.credits_used",
		"data.usage.credits",
		"credits_used",
		"consumed_credits",
	} {
		if value, ok := numericResult(gjson.GetBytes(body, path)); ok {
			return value, true
		}
	}
	return 0, false
}

// SumMetering sums Kiro meteringEvent usage values whose unit is credit.
// Repeated events in one body are additive, matching the Kiro CLI aggregator.
func SumMetering(body []byte) float64 {
	if len(body) == 0 || !bytes.Contains(body, []byte("credit")) || !bytes.Contains(body, []byte(`"unit"`)) {
		return 0
	}
	var total float64
	searchFrom := 0
	for searchFrom < len(body) {
		rel := indexCreditUnit(body[searchFrom:])
		if rel < 0 {
			break
		}
		abs := searchFrom + rel
		start := bytes.LastIndex(body[:abs+1], []byte("{"))
		if start < 0 {
			searchFrom = abs + len(`"unit"`)
			continue
		}
		end := jsonObjectEnd(body, start)
		if end <= start {
			searchFrom = abs + len(`"unit"`)
			continue
		}
		if usage, ok := meteringUsage(body[start:end]); ok {
			total += usage
		}
		searchFrom = end
	}
	return total
}

func meteringUsage(obj []byte) (float64, bool) {
	unit := strings.ToLower(strings.TrimSpace(gjson.GetBytes(obj, "unit").String()))
	plural := strings.ToLower(strings.TrimSpace(gjson.GetBytes(obj, "unitPlural").String()))
	if unit != "credit" && plural != "credits" && plural != "credit" {
		return 0, false
	}
	usage, ok := numericResult(gjson.GetBytes(obj, "usage"))
	if !ok {
		return 0, false
	}
	usage = normalizeQuantity(usage)
	if usage <= 0 {
		return 0, false
	}
	return usage, true
}

func indexCreditUnit(body []byte) int {
	patterns := [][]byte{
		[]byte(`"unit":"credit"`),
		[]byte(`"unit": "credit"`),
		[]byte(`"unitPlural":"credits"`),
		[]byte(`"unitPlural": "credits"`),
	}
	best := -1
	for _, pattern := range patterns {
		idx := bytes.Index(body, pattern)
		if idx >= 0 && (best < 0 || idx < best) {
			best = idx
		}
	}
	return best
}

func numericResult(v gjson.Result) (float64, bool) {
	if !v.Exists() || v.Type == gjson.Null || v.Type == gjson.JSON {
		return 0, false
	}
	switch v.Type {
	case gjson.Number:
		return v.Float(), true
	case gjson.String:
		text := strings.TrimSpace(v.String())
		if text == "" {
			return 0, false
		}
		parsed := gjson.Parse(text)
		if parsed.Type != gjson.Number {
			return 0, false
		}
		return parsed.Float(), true
	default:
		return 0, false
	}
}

func normalizeQuantity(v float64) float64 {
	if math.IsNaN(v) || math.IsInf(v, 0) || v < 0 {
		return 0
	}
	return v
}

// jsonObjectEnd returns the index just past the object that starts at start.
func jsonObjectEnd(body []byte, start int) int {
	if start < 0 || start >= len(body) || body[start] != '{' {
		return -1
	}
	depth := 0
	inString := false
	escape := false
	for i := start; i < len(body); i++ {
		c := body[i]
		if inString {
			if escape {
				escape = false
				continue
			}
			if c == '\\' {
				escape = true
				continue
			}
			if c == '"' {
				inString = false
			}
			continue
		}
		switch c {
		case '"':
			inString = true
		case '{':
			depth++
		case '}':
			depth--
			if depth == 0 {
				return i + 1
			}
		}
	}
	return -1
}
