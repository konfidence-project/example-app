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

// Vector data is immutable per routing key, so caching per (routingKey, flag) is safe.
var flagCache sync.Map

type flagKey struct {
	routingKey string
	flag       string
}

func isEnabled(ctx context.Context, flag string, defaultValue bool) bool {
	key := routingKeyFromContext(ctx)
	if key == "" {
		return defaultValue
	}
	if cached, ok := flagCache.Load(flagKey{key, flag}); ok {
		return cached.(bool)
	}
	client := openfeature.NewClient("candidates")
	value, err := client.BooleanValue(ctx, flag, defaultValue, openfeature.NewEvaluationContext(key, nil))
	if err != nil {
		log.Printf("openfeature %q routingKey=%s: %v (default %v)", flag, key, err, defaultValue)
		return defaultValue
	}
	flagCache.Store(flagKey{key, flag}, value)
	return value
}

// allFlags returns every feature flag the active vector carries by resolving the routing key as an object key against
// OFREP (the vector-data-service exposes the whole vector config under that key). Used only by /debug.
func allFlags(ctx context.Context) map[string]any {
	key := routingKeyFromContext(ctx)
	if key == "" {
		return map[string]any{}
	}
	client := openfeature.NewClient("candidates")
	obj, err := client.ObjectValue(ctx, key, map[string]any{}, openfeature.NewEvaluationContext(key, nil))
	if err != nil {
		log.Printf("openfeature allFlags routingKey=%s: %v", key, err)
		return map[string]any{}
	}
	cfg, _ := obj.(map[string]any)
	features, _ := cfg["features"].(map[string]any)
	if features == nil {
		return map[string]any{}
	}
	return features
}
