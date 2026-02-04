# Context8 API (FastAPI + Postgres)

内网部署版本：首次启动需创建管理员账号，支持 API Key 与 Bearer JWT。可见性为 private/team（无 public）。

## 环境变量
- `DATABASE_URL`：Postgres 连接（本地示例：`postgresql+asyncpg://user:pass@host:5432/context8`）。
- `JWT_SECRET`：签发/校验会话 JWT。
- `API_KEY_SECRET`：用户 API Key 派生密钥。
- 可选：`API_KEY` 旧版全局 key（不推荐生产）。
- 可选：`ES_URL`/`ES_INDEX`/`ES_KNN_WEIGHT`/`ES_BM25_WEIGHT` 控制检索；`EMBEDDING_API_URL`/`EMBEDDING_DIM` 控制向量维度。
- 可选：`REMOTE_CONTEXT8_BASE` / `REMOTE_CONTEXT8_API_KEY` / `REMOTE_CONTEXT8_ALLOW_OVERRIDE` 用于远程互联搜索。

## 初始化
```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

export DATABASE_URL="postgresql+asyncpg://user:pass@host:5432/context8"
export JWT_SECRET="replace_me"
export API_KEY_SECRET="replace_me"

# 迁移（需要 citext 权限）
alembic upgrade head

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## 管理员初始化与登录
1. 检查是否已有管理员：
   ```bash
   curl http://localhost:8000/auth/status
   ```
2. 初始化管理员（仅首次）：
   ```bash
   curl -X POST http://localhost:8000/auth/setup \
     -H "Content-Type: application/json" \
     -d '{"username":"admin","password":"changeme123"}'
   ```
3. 登录：
   ```bash
   curl -X POST http://localhost:8000/auth/login \
     -H "Content-Type: application/json" \
     -d '{"identifier":"admin","password":"changeme123"}'
   ```

## 创建 API Key（管理员）
```bash
curl -X POST http://localhost:8000/apikeys \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name":"default","dailyLimit":1000,"monthlyLimit":20000}'
# 响应里取出 apiKey，后续请求用 X-API-Key
```
可选设置限额（为空表示不限）：
- `dailyLimit`: 每日写入上限
- `monthlyLimit`: 每月写入上限

更新已有 API Key 限额：
```bash
curl -X PATCH http://localhost:8000/apikeys/<id>/limits \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"dailyLimit":500,"monthlyLimit":10000}'
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
- 搜索（仅走 Elasticsearch；向量检索需 ES_KNN_WEIGHT>0）：
  ```bash
  curl -X POST http://localhost:8000/search \
    -H "X-API-Key: <apiKey>" \
    -H "Content-Type: application/json" \
    -d '{"query":"example","limit":10,"visibility":"team"}'
  ```
  远程搜索（联邦）：
  ```bash
  curl -X POST http://localhost:8000/search \
    -H "X-API-Key: <apiKey>" \
    -H "X-Remote-Base: https://remote.context8.example" \
    -H "X-Remote-Api-Key: <remoteKey>" \
    -H "Content-Type: application/json" \
    -d '{"query":"example","limit":10,"source":"remote"}'
  ```
- 计数（精确返回当前用户总数）：
  ```bash
  curl -X GET http://localhost:8000/solutions/count \
    -H "X-API-Key: <apiKey>"
  ```

## 其他
- 迁移脚本 `alembic/versions/da16b97d5c07_add_email_verification_system.py` 幂等建表/扩展，EMBEDDING_DIM 取 env 或默认 384。
- 嵌入为确定性占位实现，需替换为真实模型时只改 `app/embeddings.py`。
