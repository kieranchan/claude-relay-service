# 订单与支付 API

处理订单的创建、列表查询、支付请求和状态管。

## 基础路径

`POST /api/v1/orders`

## 认证

大部分接口需要 Bearer Token 认证，`GET /payment-methods` 为公开接口。

## 支付流程

1. **获取支付方式**: `GET /payment-methods`
2. **创建订单**: `POST /create` 获取 `orderId`
3. **发起支付**: `POST /{id}/pay` 获取支付参数（如二维码 URL 或跳转链接）
4. **用户支付**: 用户在第三方平台完成支付
5. **状态轮询**: 前端轮询 `GET /{id}/status` 检查支付结果
   - 后端通过 Webhook 接收支付结果通知

## 支付回调 (Webhook)

支持以下支付渠道的 Webhook 回调：

- `POST /api/v1/orders/payment/callback/alipay`
- `POST /api/v1/orders/payment/callback/wechat`
- `POST /api/v1/orders/payment/callback/stripe`

## 错误码

| 错误码 | 说明 |
|--------|------|
| `PENDING_ORDER_EXISTS` | 存在待支付的订单，限制创建新订单 |
| `ORDER_EXPIRED` | 订单已过期 |
| `UNSUPPORTED_PAYMENT_METHOD` | 支付方式不可用或未配置 |
| `INVALID_ORDER_STATUS` | 订单状态不允许当前操作 |
