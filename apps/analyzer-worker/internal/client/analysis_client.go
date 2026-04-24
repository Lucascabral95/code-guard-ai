package client

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/codeguard-ai/codeguard/apps/analyzer-worker/pkg/contracts"
)

type AnalysisClient struct {
	baseURL        string
	internalSecret string
	httpClient     *http.Client
}

func NewAnalysisClient(baseURL, internalSecret string) *AnalysisClient {
	return &AnalysisClient{
		baseURL:        strings.TrimRight(baseURL, "/"),
		internalSecret: internalSecret,
		httpClient: &http.Client{
			Timeout: 15 * time.Second,
		},
	}
}

func (client *AnalysisClient) MarkStarted(ctx context.Context, analysisID string) error {
	return client.postJSON(ctx, fmt.Sprintf("/internal/analyses/%s/start", analysisID), nil)
}

func (client *AnalysisClient) SendResult(
	ctx context.Context,
	analysisID string,
	result contracts.AnalysisResult,
) error {
	return client.postJSON(ctx, fmt.Sprintf("/internal/analyses/%s/result", analysisID), result)
}

func (client *AnalysisClient) SendFailure(ctx context.Context, analysisID string, err error) error {
	return client.postJSON(
		ctx,
		fmt.Sprintf("/internal/analyses/%s/fail", analysisID),
		contracts.FailAnalysisRequest{ErrorMessage: err.Error()},
	)
}

func (client *AnalysisClient) postJSON(ctx context.Context, path string, body any) error {
	var payload bytes.Buffer
	if body != nil {
		if err := json.NewEncoder(&payload).Encode(body); err != nil {
			return err
		}
	}

	request, err := http.NewRequestWithContext(ctx, http.MethodPost, client.baseURL+path, &payload)
	if err != nil {
		return err
	}
	request.Header.Set("content-type", "application/json")
	request.Header.Set("x-internal-secret", client.internalSecret)

	response, err := client.httpClient.Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()

	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return fmt.Errorf("analysis service returned status %d for %s", response.StatusCode, path)
	}

	return nil
}
