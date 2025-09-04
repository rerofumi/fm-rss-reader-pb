package llm

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
)

const (
	openRouterAPI       = "https://openrouter.ai/api/v1/chat/completions"
	openRouterModelsAPI = "https://openrouter.ai/api/v1/models"
)

// ChatRequest represents the request body for the OpenRouter Chat Completions API.
type ChatRequest struct {
	Model    string    `json:"model"`
	Messages []Message `json:"messages"`
	Stream   bool      `json:"stream,omitempty"` // Add Stream field
}

// Message represents a single message in the chat history.
type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// ChatResponse represents the final response body from the OpenRouter Chat Completions API.
type ChatResponse struct {
	ID      string   `json:"id"`
	Model   string   `json:"model,omitempty"`
	Choices []Choice `json:"choices"`
	Usage   *Usage   `json:"usage,omitempty"`
}

type Usage struct {
	PromptTokens     int `json:"prompt_tokens,omitempty"`
	CompletionTokens int `json:"completion_tokens,omitempty"`
	TotalTokens      int `json:"total_tokens,omitempty"`
}

// Choice represents a single choice in the final response.
type Choice struct {
	Message Message `json:"message"`
}

// StreamChoice represents a single streamed choice from the API.
type StreamChoice struct {
	Delta        Message `json:"delta"`
	FinishReason string  `json:"finish_reason,omitempty"`
}

// StreamResponse represents a single streamed response from the API.
type StreamResponse struct {
	ID      string         `json:"id"`
	Model   string         `json:"model,omitempty"`
	Choices []StreamChoice `json:"choices"`
	Usage   *Usage         `json:"usage,omitempty"` // Usage is sent only in the last message
}

// StreamCallback defines the function signature for handling streamed responses.
type StreamCallback func(*StreamResponse) error

// SendChatRequest sends a request to the OpenRouter API and returns the response.
func SendChatRequest(request ChatRequest) (*ChatResponse, error) {
	apiKey := os.Getenv("OPENROUTER_API_KEY")
	if apiKey == "" {
		return nil, fmt.Errorf("OPENROUTER_API_KEY environment variable not set")
	}

	// Ensure Stream is false for non-streaming requests
	request.Stream = false
	body, err := json.Marshal(request)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequest("POST", openRouterAPI, bytes.NewBuffer(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		// Try to read the error message from the response body
		errorBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("received non-200 response: %d, body: %s", resp.StatusCode, string(errorBody))
	}

	var chatResponse ChatResponse
	if err := json.NewDecoder(resp.Body).Decode(&chatResponse); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &chatResponse, nil
}

// SendChatRequestStream sends a streaming request to the OpenRouter API and processes the response with a callback.
// The context can be used to cancel the request.
func SendChatRequestStream(ctx context.Context, request ChatRequest, callback StreamCallback) error {
	apiKey := os.Getenv("OPENROUTER_API_KEY")
	if apiKey == "" {
		return fmt.Errorf("OPENROUTER_API_KEY environment variable not set")
	}

	// Ensure Stream is true for streaming requests
	request.Stream = true
	body, err := json.Marshal(request)
	if err != nil {
		return fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", openRouterAPI, bytes.NewBuffer(body))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Accept", "text/event-stream")
	req.Header.Set("Cache-Control", "no-cache")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send request: %w", err)
	}
	defer func() {
		// Consume any remaining response body to allow connection reuse
		_, _ = io.Copy(io.Discard, resp.Body)
		resp.Body.Close()
	}()

	if resp.StatusCode != http.StatusOK {
		// Try to read the error message from the response body
		errorBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("received non-200 response: %d, body: %s", resp.StatusCode, string(errorBody))
	}

	scanner := bufio.NewScanner(resp.Body)
	for scanner.Scan() {
		line := scanner.Text()
		if line == "" {
			continue
		}
		// Check for SSE data lines
		if !strings.HasPrefix(line, "data: ") {
			// Handle other SSE events like "event:" or comments if needed, or ignore
			// For now, we only process "data:" lines
			continue
		}
		data := strings.TrimPrefix(line, "data: ")

		// Check for stream end
		if data == "[DONE]" {
			break
		}

		var streamResp StreamResponse
		if err := json.Unmarshal([]byte(data), &streamResp); err != nil {
			// Log the error but continue processing the stream if possible
			// Returning an error here would stop the entire stream processing
			// It might be better to just log and continue, depending on error tolerance
			// For now, let's return the error to stop the stream
			return fmt.Errorf("failed to decode stream data: %s, error: %w", data, err)
		}

		// Call the callback function with the parsed stream response
		if err := callback(&streamResp); err != nil {
			// If the callback returns an error (e.g., client disconnect), stop the stream
			return err
		}
	}

	if err := scanner.Err(); err != nil {
		return fmt.Errorf("error reading stream: %w", err)
	}

	return nil
}

// GetModels fetches available model IDs from OpenRouter.
func GetModels() ([]string, error) {
	apiKey := os.Getenv("OPENROUTER_API_KEY")
	if apiKey == "" {
		return nil, fmt.Errorf("OPENROUTER_API_KEY environment variable not set")
	}

	req, err := http.NewRequest("GET", openRouterModelsAPI, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		// Try to read the error message from the response body
		errorBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("received non-200 response: %d, body: %s", resp.StatusCode, string(errorBody))
	}

	var parsed struct {
		Data []struct {
			ID string `json:"id"`
			// Name string `json:"name"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}
	ids := make([]string, 0, len(parsed.Data))
	for _, m := range parsed.Data {
		if m.ID != "" {
			ids = append(ids, m.ID)
		}
	}
	return ids, nil
}


