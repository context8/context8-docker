# Context8 Docker (Private + Team)

全套内网部署：前端 + 后端 + Embedding + ES + Postgres + Redis。默认关闭邮件验证，只有私有和团队可见性。

## Quick Start

```bash
cp .env.example .env
docker compose up -d --build
```

访问：
- 前端：`http://<host>:3000`
- 后端：`http://<host>:8000/docs`

## 可见性规则
- `private`: 仅当前 API Key/用户可见
- `team`: 本部署内所有已认证用户与 API Key 可见

## 主要服务
- `frontend`: Vite + Nginx 静态站点
- `api`: FastAPI + Postgres + Redis
- `worker-embedding`: 向量生成任务
- `worker-es`: ES 同步任务
- `embedding`: sentence-transformers 模型服务
- `elasticsearch`: 搜索索引
- `postgres`: 业务数据库（pgvector）
- `redis`: 队列

## 配置说明
`.env` 里至少配置：
- `POSTGRES_PASSWORD`
- `JWT_SECRET`
- `API_KEY_SECRET`
- `VITE_API_BASE`（前端访问后端的地址）

如果要启用邮件验证码：
```
EMAIL_VERIFICATION_ENABLED=true
RESEND_API_KEY=...
RESEND_FROM=...
```

## 常用命令

```bash
# 查看日志
docker compose logs -f api

# 重新构建
docker compose up -d --build

# 停止
docker compose down
```
