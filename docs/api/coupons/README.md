# 优惠券系统 API 文档

优惠券系统提供创建、分发、领取、验证和使用优惠券的功能。

## 概览

- **基础路径**: `/api/v1/coupons` (用户端)
- **管理路径**: `/admin/coupons` (管理端)

## 数据模型

### Coupon (优惠券模板)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 唯一标识符 |
| name | String | 优惠券名称 |
| code | String | 优惠码（可选） |
| type | String | 类型: `fixed_amount`(直减), `percentage`(折扣), `full_reduction`(满减) |
| value | Decimal | 面值（金额或折扣比率） |
| minPurchaseAmount | Decimal | 最低消费金额 |
| maxDiscountAmount | Decimal | 最大抵扣金额（仅百分比折扣有效） |
| startTime | DateTime | 开始时间 |
| endTime | DateTime | 结束时间 |
| distributionType | String | 分发类型: `public`(公开领取), `private`(定向分发), `code`(兑换码) |
| status | String | 状态: `active`, `inactive`, `expired` |

## 用户端 API

### 1. 获取可领取的优惠券

获取当前用户可以领取的公开优惠券列表。

- **URL**: `/api/v1/coupons/available`
- **Method**: `GET`
- **Auth**: Required

**响应示例**:
```json
[
  {
    "id": "coupon_123",
    "name": "新用户立减券",
    "value": 10,
    "can_receive": true,
    "received": false
  }
]
```

### 2. 获取我的优惠券

获取当前用户已领取的优惠券。

- **URL**: `/api/v1/coupons/my`
- **Method**: `GET`
- **Params**: `status` (可选，过滤状态: `available`, `used`, `expired`)
- **Auth**: Required

### 3. 领取优惠券

- **URL**: `/api/v1/coupons/receive/:id`
- **Method**: `POST`
- **Auth**: Required

### 4. 兑换优惠码

- **URL**: `/api/v1/coupons/exchange`
- **Method**: `POST`
- **Body**: `{ "code": "SAVE10" }`
- **Auth**: Required

### 5. 验证优惠券

在下单前验证优惠券是否适用。

- **URL**: `/api/v1/coupons/validate`
- **Method**: `POST`
- **Body**:
  ```json
  {
    "code": "coupon_id_or_code",
    "plan_id": "plan_123",
    "amount": 100.00
  }
  ```
- **Auth**: Required

**响应示例**:
```json
{
  "valid": true,
  "discount_amount": 10.00,
  "final_amount": 90.00
}
```

## 管理端 API

### 1. 优惠券 CRUD

- **List**: `GET /admin/coupons`
- **Create**: `POST /admin/coupons`
- **Update**: `PUT /admin/coupons/:id`
- **Delete**: `DELETE /admin/coupons/:id`

### 2. 获取统计

- **URL**: `/admin/coupons/:id/stats`
- **Method**: `GET`

### 3. 批量分发

- **URL**: `/admin/coupons/:id/distribute`
- **Method**: `POST`
- **Body**:
  ```json
  {
    "target_type": "user_ids", // 或 'user_filter'
    "targets": ["user_1", "user_2"],
    "expire_days": 7
  }
  ```
