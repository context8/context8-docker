# Context8 Docker (Private + Team)

全套内网部署：前端 + 后端 + ES + Postgres（可选 Embedding）。首次访问需设置管理员账号与密码，默认关闭邮件验证，只有私有和团队可见性。

## Quick Start

```bash
cp .env.example .env
docker compose up -d --build
```

访问：
- 前端：`http://<host>:3000`
- 后端：`http://<host>:8000/docs`

首次登录：
- 打开前端登录页，按提示创建管理员账号与密码。
- 管理员登录后创建 API Key 分发给团队。

## 可见性规则
- `private`: 仅当前 API Key/用户可见
- `team`: 本部署内所有已认证用户与 API Key 可见

## 主要服务
- `frontend`: Vite + Nginx 静态站点
- `api`: FastAPI + Postgres（写入时同步更新 ES；搜索只走 ES）
- `embedding`: sentence-transformers 模型服务（可选；仅在启用 ES kNN 时使用，`docker compose --profile semantic up`）
- `elasticsearch`: 搜索索引
- `postgres`: 业务数据库（citext）

## 检索规则（重要）
- `/search` **只走 Elasticsearch**（无 DB/pgvector 回退）。ES 不可用时会直接报错。
- `ES_KNN_WEIGHT>0` 时启用向量检索（需要 `embedding` 服务可用且 ES 索引已写入 embedding 字段）；否则只用 BM25。

## 配置说明
`.env` 里至少配置：
- `POSTGRES_PASSWORD`
- `DATABASE_SSL`（本地 Postgres 建议 `false`；接云端 PG 可设 `true` 或在 `DATABASE_URL` 里加 `sslmode=require`）
- `JWT_SECRET`
- `API_KEY_SECRET`
- `VITE_API_BASE`（前端访问后端的地址）

安全默认值：
- `POSTGRES` 与 `ES` 默认只绑定到 `127.0.0.1`（通过 `POSTGRES_BIND` / `ES_BIND` 可调整）。
- `JWT_SECRET` / `API_KEY_SECRET` 不能使用占位值（如 `replace_me` / `changeme`）。
- CORS 默认仅放行本机前端地址（`localhost/127.0.0.1 + FRONTEND_PORT`）；如需跨域请显式设置 `CORS_ALLOW_ORIGINS`。
- API 容器默认 `nofile=65536`（`API_NOFILE_SOFT/HARD` 可调）。

如已有同名容器冲突，可在 `.env` 里设置 `CONTEXT8_*_NAME` 覆盖容器名（示例见 `.env.example`）。

## 远程互联（可选）
用于把 Docker 版当作 “互联入口”，查询远程 Context8（主系统或公网部署）。

在 `.env` 设置：
```
REMOTE_CONTEXT8_BASE=https://your-context8.example.com
REMOTE_CONTEXT8_API_KEY=...
REMOTE_CONTEXT8_ALLOW_OVERRIDE=false
# 可选：允许请求头覆盖的 host 白名单（逗号分隔）
REMOTE_CONTEXT8_ALLOWED_HOSTS=api.context8.org,localhost
```

调用 `/search` 时传 `source=remote` 或 `source=all`，即可走远程或本地+远程聚合搜索。
说明：若配置了 `REMOTE_CONTEXT8_ALLOWED_HOSTS`，无论是固定远端还是请求头覆盖，host 都必须命中白名单。

## API 契约（列表）
- `GET /v2/solutions`：统一分页返回 `{items,total,limit,offset}`（推荐前端/新客户端使用）。
- `GET /solutions`：兼容路由（API Key 仍返回数组，JWT 返回分页对象）。
- `GET /mcp/solutions`：稳定数组返回，供 MCP/兼容客户端使用。

## 健康检查
- `GET /status`：返回 `db/es/remote` 组件状态、版本、运行时长。
- `GET /status/summary`：状态页摘要。

## 常用命令

```bash
# 查看日志
docker compose logs -f api

# 重新构建
docker compose up -d --build

# 停止
docker compose down
```
