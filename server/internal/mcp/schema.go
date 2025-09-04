package mcp

// JSON-RPC 2.0 Request object
type JsonRpcRequest struct {
	Jsonrpc string      `json:"jsonrpc"`
	Method  string      `json:"method"`
	Params  interface{} `json:"params,omitempty"`
	ID      interface{} `json:"id,omitempty"`
}

// JSON-RPC 2.0 Response object
type JsonRpcResponse struct {
	Jsonrpc string      `json:"jsonrpc"`
	Result  interface{} `json:"result,omitempty"`
	Error   *JsonRpcError `json:"error,omitempty"`
	ID      interface{} `json:"id"`
}

// JSON-RPC 2.0 Error object
type JsonRpcError struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

func (e *JsonRpcError) Error() string {
	return e.Message
}

// Standard JSON-RPC 2.0 errors
var (
	ErrParse          = &JsonRpcError{-32700, "Parse error", nil}
	ErrInvalidRequest = &JsonRpcError{-32600, "Invalid Request", nil}
	ErrMethodNotFound = &JsonRpcError{-32601, "Method not found", nil}
	ErrInvalidParams  = &JsonRpcError{-32602, "Invalid params", nil}
	ErrInternal       = &JsonRpcError{-32603, "Internal error", nil}
)

