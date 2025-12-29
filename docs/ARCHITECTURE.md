# 系统架构

## 核心架构

### 关键概念

- **统一调度系统**: 使用 `unifiedClaudeScheduler`、`unifiedGeminiScheduler`、`unifiedOpenAIScheduler` 和 `droidScheduler` 实现跨账户类型的智能调度。
- **多账户支持**: 支持 `claude-official`、`claude-console`、`bedrock`、`ccr`、`droid`、`gemini`、`openai-responses`、`azure-openai` 等账户类型。
- **代理认证流**: 客户端使用自建 API Key -> 验证 -> 调度器选择账户 -> 获取账户 Token -> 转发至 API。
- **Token 管理**: 自动监控 OAuth Token 过期并刷新（支持 10 秒提前刷新）。
- **代理支持**: 每个账户支持独立的代理配置；OAuth Token 交换也通过代理进行。
- **数据加密**: 敏感数据（`refreshToken`、`accessToken`、`credentials`）使用 AES 加密存储在 Redis 中。
- **粘性会话 (Sticky Sessions)**: 支持会话级别的账户绑定；同一会话使用同一账户，确保上下文连续性。
- **权限控制**: API Key 支持权限配置（`all`/`claude`/`gemini`/`openai`），控制可访问的服务类型。
- **客户端限制**: 基于 User-Agent 的客户端识别和限制（例如：ClaudeCode, Gemini-CLI）。
- **模型黑名单**: API Key 级别的模型访问控制。
- **并发队列**: 当 API Key 并发数超限时，请求进入队列等待，而不是立即返回 429。

### 服务组件

#### 核心转发服务 (Relay Services)
- **claudeRelayService.js**: Claude 官方 API 转发，处理 OAuth 认证和流式响应。
- **claudeConsoleRelayService.js**: Claude Console 账户转发服务。
- **geminiRelayService.js**: Gemini API 转发服务。
- **bedrockRelayService.js**: AWS Bedrock 转发服务。
- **azureOpenaiRelayService.js**: Azure OpenAI 转发服务。
- **droidRelayService.js**: Factory.ai API 转发服务。
- **ccrRelayService.js**: CCR 账户转发服务。
- **openaiResponsesRelayService.js**: OpenAI Responses (Codex) 转发服务。

#### 账户管理 (Account Management)
- **claudeAccountService.js**: Claude 官方账户管理。
- **claudeConsoleAccountService.js**: Claude Console 账户管理。
- **geminiAccountService.js**: Gemini 账户管理。
- **bedrockAccountService.js**: AWS Bedrock 账户管理。
- **azureOpenaiAccountService.js**: Azure OpenAI 账户管理。
- **droidAccountService.js**: Droid 账户管理。
- **ccrAccountService.js**: CCR 账户管理。
- **openaiResponsesAccountService.js**: OpenAI Responses 账户管理。
- **openaiAccountService.js**: OpenAI 兼容账户管理。
- **accountGroupService.js**: 账户分组和优先级管理。

#### 调度器 (Schedulers)
- **unifiedClaudeScheduler.js**: Claude 类型的统一调度器。
- **unifiedGeminiScheduler.js**: Gemini 的统一调度器。
- **unifiedOpenAIScheduler.js**: OpenAI 兼容服务的统一调度器。
- **droidScheduler.js**: Droid 账户调度器。

#### 核心功能服务
- **apiKeyService.js**: API Key 管理、验证、限流、使用统计、成本计算。
- **userService.js**: 用户管理系统。
- **userMessageQueueService.js**: 用户消息串行队列。
- **pricingService.js**: 定价管理和成本计算。
- **webhookService.js**: Webhook 通知。
- **ldapService.js**: LDAP 认证。
- **tokenRefreshService.js**: Token 自动刷新。
- **rateLimitCleanupService.js**: 速率限制清理。

#### 工具服务
- **oauthHelper.js**: PKCE 实现和代理支持。
- **workosOAuthHelper.js**: WorkOS 集成。
- **openaiToClaude.js**: 格式转换。

### 认证和代理流程

1. 客户端使用自定义 API Key（`cr_` 前缀）发送请求。
2. **authenticateApiKey 中间件** 验证有效性、限流、权限、客户端限制、模型黑名单。
3. **统一调度器** 根据模型、会话哈希、密钥权限选择最优账户。
4. 检查账户 Token 有效性；如果过期则自动刷新（使用代理）。
5. 根据账户类型调用相应的转发服务。
6. 移除客户端 API Key，注入账户凭证（OAuth Bearer Token/API Key）。
7. 通过账户配置的代理转发请求到目标 API。
8. 返回响应（流式/非流式），捕获真实使用数据 (usage)。
9. 记录使用统计并计算成本。
10. 更新速率限制计数器和并发控制。

### OAuth 集成

- **PKCE 流程**: 具有代理支持的完整 OAuth 2.0 PKCE 实现。
- **自动刷新**: 智能过期检测和自动刷新。
- **安全存储**: `claudeAiOauth` 数据在 Redis 中加密存储。

## 设计决策

- **统一调度**: 跨账户类型的智能调度，具备粘性会话和负载均衡。
- **加密**: Redis 中所有敏感凭证均采用 AES 加密。
- **独立代理**: 每个账户可配置独立的代理。
- **API Key 哈希**: 密钥使用 SHA-256 哈希存储。
- **请求流程**: 验证 -> 调度 -> 刷新 -> 转发 -> 使用量捕获 -> 成本计算。
- **流式支持**: 支持 SSE，具有实时使用量解析和中止处理 (Abort Handling)。
- **并发控制**: 基于 Redis Sorted Set 的计数，支持自动过期。
- **并发排队**: 采用 "先占后检" 模式，配合指数退避。
- **错误处理**: 自动处理 529 过载状态。

## 数据结构 (Redis)

- **API Keys**: `api_key:{id}`, `api_key_hash:{hash}`, `api_key_usage:{keyId}`, `api_key_cost:{keyId}`
- **Accounts**: `claude_account:{id}`, `gemini_account:{id}`, 等。
- **Users**: `user:{id}`, `user_email:{email}`, `user_session:{token}`
- **Sessions**: `session:{token}`, `sticky_session:{sessionHash}`
- **Usage**: `usage:daily:...`, `usage:account:...`, `usage:global:...`
- **Rate Limits**: `rate_limit:{keyId}:{window}`, `overload:{accountId}`
- **Concurrency**: `concurrency:{accountId}`, `concurrency:queue:{apiKeyId}`
