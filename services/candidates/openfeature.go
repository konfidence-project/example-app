package main

import (
	"context"
	"log"
	"sync"

	"github.com/open-feature/go-sdk-contrib/providers/ofrep"
	"github.com/open-feature/go-sdk/openfeature"
)

func initOpenFeature(_ context.Context) error {
	url := envOr("VECTOR_CONFIG_URL",
		"http://vector-data-service")
	if err := openfeature.SetProviderAndWait(ofrep.NewProvider(url)); err != nil {
		return err
	}
	log.Printf("openfeature: OFREP provider ready at %s", url)
	return nil
}

// Vector data is immutable per vector-id, so caching per (vector-id, flag) is safe.
var flagCache sync.Map

type flagKey struct {
	vectorID string
	flag     string
}

func isEnabled(ctx context.Context, flag string, defaultValue bool) bool {
	vid := vectorIDFromContext(ctx)
	if vid == "" {
		return defaultValue
	}
	if cached, ok := flagCache.Load(flagKey{vid, flag}); ok {
		return cached.(bool)
	}
	client := openfeature.NewClient("candidates")
	value, err := client.BooleanValue(ctx, flag, defaultValue, openfeature.NewEvaluationContext(vid, nil))
	if err != nil {
		log.Printf("openfeature %q vector=%s: %v (default %v)", flag, vid, err, defaultValue)
		return defaultValue
	}
	flagCache.Store(flagKey{vid, flag}, value)
	return value
}
