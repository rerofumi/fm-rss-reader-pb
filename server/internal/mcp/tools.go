package mcp

import (
	"fm-rss-reader-pb/internal/llm"
	"fmt"
	"github.com/pocketbase/pocketbase/core"
)

// Tool represents a single tool that can be called by the MCP client.
type Tool struct {
	Name        string
	Description string
	InputSchema interface{}
	Execute     func(app core.App, args map[string]interface{}) (interface{}, error)
}

// GetTools returns the list of available tools.
func GetTools(app core.App) map[string]Tool {
	tools := map[string]Tool{}

	tools["llm.summarize"] = Tool{
		Name:        "llm.summarize",
		Description: "Summarize a given text.",
		InputSchema: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"text":      map[string]interface{}{"type": "string", "description": "The text to summarize."},
				"model":     map[string]interface{}{"type": "string", "description": "The model to use for summarization."},
			},
			"required": []string{"text"},
		},
		Execute: func(app core.App, args map[string]interface{}) (interface{}, error) {
			text, ok := args["text"].(string)
			if !ok || text == "" {
				return nil, fmt.Errorf("text argument is required and must be a string")
			}

			model := "openrouter/auto" // Default model
			if m, ok := args["model"].(string); ok && m != "" {
				model = m
			}

			req := llm.ChatRequest{
				Model: model,
				Messages: []llm.Message{
					{Role: "system", Content: "You are an expert summarizer. Please summarize the following text."},
					{Role: "user", Content: text},
				},
			}

			resp, err := llm.SendChatRequest(req)
			if err != nil {
				return nil, fmt.Errorf("failed to call OpenRouter API: %w", err)
			}

			if len(resp.Choices) == 0 {
				return nil, fmt.Errorf("no summary returned from API")
			}

			return resp.Choices[0].Message.Content, nil
		},
	}

	tools["llm.translate"] = Tool{
		Name:        "llm.translate",
		Description: "Translate a given text to a target language.",
		InputSchema: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"text":       map[string]interface{}{"type": "string", "description": "The text to translate."},
				"targetLang": map[string]interface{}{"type": "string", "description": "The target language."},
			},
			"required": []string{"text", "targetLang"},
		},
		Execute: func(app core.App, args map[string]interface{}) (interface{}, error) {
			text, _ := args["text"].(string)
			targetLang, _ := args["targetLang"].(string)
			if text == "" || targetLang == "" {
				return nil, fmt.Errorf("text and targetLang arguments are required")
			}

			model := "openrouter/auto"
			if m, ok := args["model"].(string); ok && m != "" {
				model = m
			}

			req := llm.ChatRequest{
				Model: model,
				Messages: []llm.Message{
					{Role: "system", Content: "You are an expert translator. Translate the following text to " + targetLang + "."},
					{Role: "user", Content: text},
				},
			}

			resp, err := llm.SendChatRequest(req)
			if err != nil {
				return nil, fmt.Errorf("failed to call OpenRouter API: %w", err)
			}

			if len(resp.Choices) == 0 {
				return nil, fmt.Errorf("no translation returned from API")
			}

			return resp.Choices[0].Message.Content, nil
		},
	}

	tools["llm.ask"] = Tool{
		Name:        "llm.ask",
		Description: "Ask a question with optional context.",
		InputSchema: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"question": map[string]interface{}{"type": "string", "description": "The question to ask."},
				"context":  map[string]interface{}{"type": "string", "description": "Optional context for the question."},
			},
			"required": []string{"question"},
		},
		Execute: func(app core.App, args map[string]interface{}) (interface{}, error) {
			question, _ := args["question"].(string)
			if question == "" {
				return nil, fmt.Errorf("question argument is required")
			}

			model := "openrouter/auto"
			if m, ok := args["model"].(string); ok && m != "" {
				model = m
			}

			// Prepare messages
			messages := []llm.Message{}
			systemPrompt := "You are a helpful assistant. Answer the user's question."
			if context, ok := args["context"].(string); ok && context != "" {
				systemPrompt += "\n\nPlease use the following context to answer:\n" + context
			}
			messages = append(messages, llm.Message{Role: "system", Content: systemPrompt})
			messages = append(messages, llm.Message{Role: "user", Content: question})

			req := llm.ChatRequest{
				Model:    model,
				Messages: messages,
			}

			resp, err := llm.SendChatRequest(req)
			if err != nil {
				return nil, fmt.Errorf("failed to call OpenRouter API: %w", err)
			}

			if len(resp.Choices) == 0 {
				return nil, fmt.Errorf("no answer returned from API")
			}

			return resp.Choices[0].Message.Content, nil
		},
	}

	return tools
}

