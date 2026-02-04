# Context8：Docker 开源轻量版 vs 主系统（Cloud Backend）

你现在维护两套东西：

- **主系统（`Context8-backend/`）**：面向云端/多租户/可扩展，默认带队列与 worker，搜索有多级回退与写回逻辑。
- **Docker 开源轻量版（`context8-docker/`）**：面向“内网一键部署”，把复杂性砍到能跑、好维护、可预测。

下面是逐项对比（按“有没有必要复杂”来分层）。

## 1) 目标与约束

| 维度 | Docker 开源轻量版 | 主系统 |
|---|---|---|
| 部署目标 | 一条 `docker compose up` 起全套（前端/后端/ES/DB） | 云端/多机/可扩展（组件可拆分到不同机器） |
| 复杂度取向 | **最少组件、最少隐式行为** | 允许复杂换吞吐/弹性/异步 |
| 搜索源 | **ES 作为唯一检索源** | ES 优先，失败回退 pgvector，再回退 DB 关键词 |
| 写入一致性 | 同步写 ES（不依赖队列） | 写入 DB 后入队（RQ/Redis），异步算 embedding + 同步 ES |
| 互联模式 | **可选远程联邦搜索**（`source=remote/all`） | 作为中心服务，默认不做跨实例聚合 |

## 2) 服务编排（docker compose）对比

### Docker 开源轻量版（`context8-docker/docker-compose.yml`）
- `frontend`：Vite 构建 + Nginx 静态站点（管理 UI）
- `api`：FastAPI（写入同步更新 ES；搜索只走 ES）
- `elasticsearch`：唯一检索源
- `postgres`：仅做业务数据（用户/API key/solutions/votes 等）
- `embedding`：可选（仅 ES kNN 用）

### 主系统（`Context8-backend/docker-compose.yml` + profiles）
- `api`：FastAPI（会把 ES/embedding/统计写回放到队列）
- `redis`：队列与异步任务中心
- `worker-*`：embedding / ES 同步 / ingest / search events / metrics（按 profile 扩展）
- `postgres`：业务数据 + pgvector（向量回退与存储）
- `elasticsearch`：通常是外部服务（或宿主机 ES），compose 里未必打包

结论：主系统的“可扩展”来自 **Redis + 多 worker + 异步链路**；轻量版把这些全砍掉，靠 **同步 + ES** 保持简单。

## 3) 数据模型与可见性

两者核心实体相同：
- `users`：管理员/用户
- `api_keys`：API Key 归属用户
- `solutions`：解决方案卡片
- `solution_votes`：投票

差异主要在“权限/可见性”：
- 主系统历史上有 `public` 模式（面向开放检索/曝光/增长逻辑）
- 轻量版定位内网，重点是 `private/team`（团队共享由部署边界定义）

## 4) 写入路径（Create/Update/Delete/Vote）

### Docker 开源轻量版
1. 写入 Postgres（事务）
2. **同步**把文档写入 ES（失败直接报错，避免产生“ES 查不到但 DB 有”的半残数据）
3. 若启用 kNN：写入前同步调用 embedding 服务拿向量（或标记 embedding 失败）

### 主系统
1. 写入 Postgres
2. 入队：embedding worker 计算向量、ES worker 同步文档、metrics/search worker 写回统计
3. 删除/投票等也走队列写回 ES（更抗峰值，但链路复杂）

## 5) 搜索路径（/search）

### Docker 开源轻量版
- `/search`：**只调用 ES**（ES 不可用就直接失败，不做“假成功”）
- 可选 kNN：`ES_KNN_WEIGHT>0` 时附带 `knn` 查询；否则 BM25

### 主系统
- `/search`：ES 优先；失败回退 pgvector；再失败回退 DB ILIKE
- 额外逻辑：traceId、曝光记录、搜索计数、（历史上）搜索结果 upvote 写回等
- “own quota + public quota” 的混合策略（带增长/曝光目标）

## 6) 为什么轻量版必须砍掉主系统的这些东西

主系统做的很多事不是“错”，但对一键部署是**纯负担**：
- **队列/worker**：部署多一个组件就多 10 倍排查面（redis、队列堆积、幂等、重试、死信等）
- **多级回退搜索**：看似“更稳定”，实际会让你误以为 ES 没问题（结果路径不透明）
- **搜索写回**：把读请求变成写请求，规模一大必炸（而且对内网部署几乎没价值）

轻量版的原则是：**读就是读，写就是写，ES 是唯一检索真相**。

## 7) 轻量版建议的“硬边界”

如果你要继续保持轻量：
- 不引入 Redis/RQ（除非明确需要异步吞吐）
- 不保留“ES 不可用时的假回退”（否则你永远不知道 ES 什么时候坏了）
- 不把“增长逻辑”（曝光、搜索写回、自动 upvote）塞进内网版

## 8) 远程互联（联邦搜索）

轻量版允许把 `/search` 作为联邦入口：
- 通过 `REMOTE_CONTEXT8_BASE/REMOTE_CONTEXT8_API_KEY` 配置远程 Context8
- 请求时用 `source=remote` 或 `source=all` 合并本地与远程结果
- 远端接口仍然是标准 `/search`（X-API-Key 认证）

主系统本身就是“远端”，默认不内置跨实例聚合逻辑。
