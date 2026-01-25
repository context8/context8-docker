# Context8 API (FastAPI + Postgres)

内网部署版本：默认关闭邮件验证，支持 API Key 与 Bearer JWT。可见性为 private/team（无 public）。

## 环境变量
- `DATABASE_URL`：Postgres 连接（本地示例：`postgresql+asyncpg://user:pass@host:5432/context8`）。
- `JWT_SECRET`：签发/校验会话 JWT。
- `API_KEY_SECRET`：用户 API Key 派生密钥。
- `EMAIL_VERIFICATION_ENABLED`：是否启用邮件验证码（默认 false）。
- 可选：`API_KEY` 旧版全局 key（不推荐生产）；`EMBEDDING_DIM` 默认为 384。

## 初始化
```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

export DATABASE_URL="postgresql+asyncpg://user:pass@host:5432/context8"
export JWT_SECRET="replace_me"
export API_KEY_SECRET="replace_me"
export EMAIL_VERIFICATION_ENABLED="false"

# 迁移（需要 citext/vector 权限）
alembic upgrade head

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## 注册与登录（默认无邮件验证）
1. 直接登录（发送验证码接口会直接返回 token）：
   ```bash
   curl -X POST http://localhost:8000/auth/email/send-code \
     -H "Content-Type: application/json" \
     -d '{"email":"you@example.com"}'
   ```
   返回字段 `token` 与 `user.id`。

## 创建 API Key（可选）
```bash
curl -X POST http://localhost:8000/apikeys \
  -H "Authorization: Bearer <token>" \
  -d "name=default"
# 响应里取出 apiKey，后续请求用 X-API-Key
```
## 保存与搜索 Solution
说明：
- Solution 归属到 API Key（写入时会绑定 key）。
- 可见性为 `private` 或 `team`，无 public。
- 创建：
  ```bash
  curl -X POST http://localhost:8000/solutions \
    -H "X-API-Key: <apiKey>" \
    -H "Content-Type: application/json" \
    -d '{"title":"Example","errorMessage":"msg","errorType":"runtime","context":"ctx","rootCause":"cause","solution":"fix","tags":["demo"],"visibility":"private"}'
  ```
- 更新可见性：
  ```bash
  curl -X PATCH http://localhost:8000/solutions/<id>/visibility \
    -H "X-API-Key: <apiKey>" \
    -H "Content-Type: application/json" \
    -d '{"visibility":"team"}'
  ```
- 搜索（先向量，失败回退关键词）：
  ```bash
  curl -X POST http://localhost:8000/search \
    -H "X-API-Key: <apiKey>" \
    -H "Content-Type: application/json" \
    -d '{"query":"example","limit":10,"visibility":"team"}'
  ```
- 计数（精确返回当前用户总数）：
  ```bash
  curl -X GET http://localhost:8000/solutions/count \
    -H "X-API-Key: <apiKey>"
  ```

## 其他
- 启动会尝试创建 pgvector ivfflat 索引，不具备权限会告警但不会阻塞。
- 迁移脚本 `alembic/versions/da16b97d5c07_add_email_verification_system.py` 幂等建表/扩展，EMBEDDING_DIM 取 env 或默认 384。
- 嵌入为确定性占位实现，需替换为真实模型时只改 `app/embeddings.py`。
