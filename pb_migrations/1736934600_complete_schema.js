/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
    // Create genres collection
    app.save(new Collection({
        name: "genres",
        type: "base",
        listRule: "user = @request.auth.id",
        viewRule: "user = @request.auth.id", 
        createRule: "@request.auth.id != '' && user = @request.auth.id",
        updateRule: "user = @request.auth.id",
        deleteRule: "user = @request.auth.id",
        fields: [
            {
                name: "user",
                type: "relation",
                required: true,
                collectionId: "_pb_users_auth_",
                cascadeDelete: true,
                maxSelect: 1
            },
            {
                name: "name",
                type: "text",
                required: true,
                presentable: true,
                min: 1,
                max: 100
            },
            {
                name: "sort_order",
                type: "number",
                required: false,
                noDecimal: true
            },
            {
                name: "created",
                type: "date",
                required: true
            },
            {
                name: "updated",
                type: "date",
                required: true
            }
        ],
        indexes: [
            "CREATE UNIQUE INDEX idx_genres_user_name ON genres(user, name)"
        ]
    }))
    
    // Create feeds collection
    const genresCollection = app.findCollectionByNameOrId("genres")
    
    app.save(new Collection({
        name: "feeds",
        type: "base",
        listRule: "user = @request.auth.id",
        viewRule: "user = @request.auth.id",
        createRule: "@request.auth.id != '' && user = @request.auth.id",
        updateRule: "user = @request.auth.id",
        deleteRule: "user = @request.auth.id",
        fields: [
            {
                name: "user",
                type: "relation",
                required: true,
                collectionId: "_pb_users_auth_",
                cascadeDelete: true,
                maxSelect: 1
            },
            {
                name: "genre",
                type: "relation",
                required: true,
                collectionId: genresCollection.id,
                cascadeDelete: false,
                maxSelect: 1
            },
            {
                name: "url",
                type: "url",
                required: true,
                exceptDomains: [],
                onlyDomains: []
            },
            {
                name: "label",
                type: "text",
                required: false,
                presentable: true,
                max: 200
            },
            {
                name: "disabled",
                type: "bool",
                required: false
            },
            {
                name: "user_url_key",
                type: "text",
                required: false,
                unique: true,
                max: 500
            },
            {
                name: "created",
                type: "date",
                required: true
            },
            {
                name: "updated",
                type: "date",
                required: true
            }
        ],
        indexes: [
            "CREATE INDEX idx_feeds_user ON feeds(user)",
            "CREATE INDEX idx_feeds_genre ON feeds(genre)",
            "CREATE UNIQUE INDEX idx_feeds_user_url ON feeds(user, url)"
        ]
    }))
    
    // Create mcp_tokens collection
    app.save(new Collection({
        name: "mcp_tokens",
        type: "base",
        listRule: "user = @request.auth.id",
        viewRule: "user = @request.auth.id",
        createRule: "@request.auth.id != '' && user = @request.auth.id",
        updateRule: "user = @request.auth.id",
        deleteRule: "user = @request.auth.id",
        fields: [
            {
                name: "user",
                type: "relation",
                required: true,
                collectionId: "_pb_users_auth_",
                cascadeDelete: true,
                maxSelect: 1
            },
            {
                name: "key_prefix",
                type: "text",
                required: true,
                unique: true,
                min: 6,
                max: 64
            },
            {
                name: "token_hash",
                type: "text",
                required: true,
                hidden: true,
                min: 64,
                max: 128
            },
            {
                name: "scopes",
                type: "json",
                required: false,
                maxSize: 2000000
            },
            {
                name: "name",
                type: "text",
                required: false,
                max: 200
            },
            {
                name: "expires_at",
                type: "date",
                required: false
            },
            {
                name: "last_used_at",
                type: "date",
                required: false
            },
            {
                name: "created",
                type: "date",
                required: true
            },
            {
                name: "updated",
                type: "date",
                required: true
            }
        ],
        indexes: [
            "CREATE INDEX idx_mcp_tokens_user ON mcp_tokens(user)",
            "CREATE UNIQUE INDEX idx_mcp_tokens_key_prefix ON mcp_tokens(key_prefix)",
            "CREATE INDEX idx_mcp_tokens_token_hash ON mcp_tokens(token_hash)",
            "CREATE INDEX idx_mcp_tokens_expires_at ON mcp_tokens(expires_at)",
            "CREATE INDEX idx_mcp_tokens_last_used_at ON mcp_tokens(last_used_at)"
        ]
    }))
    
}, (app) => {
    // Rollback - delete all collections
    const collections = ["mcp_tokens", "feeds", "genres"]
    for (const name of collections) {
        const collection = app.findCollectionByNameOrId(name)
        if (collection) {
            app.delete(collection)
        }
    }
})
