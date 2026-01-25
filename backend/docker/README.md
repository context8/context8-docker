# Docker Configuration

## 文件说明

- **init-db.sql**: PostgreSQL数据库初始化脚本
  - 自动启用 `citext` 和 `vector` 扩展
  - 在Docker容器首次启动时自动执行
  - 挂载位置：`/docker-entrypoint-initdb.d/init-db.sql`

## 相关文件

主Docker配置文件在项目根目录：

- **Dockerfile** - API服务容器构建配置
- **docker-compose.yml** - 多容器编排配置
- **.dockerignore** - Docker构建排除规则

## 使用说明

### 启动服务

```bash
# 从项目根目录
cd /root/Desktop/context8/Context8-CLI

# 启动所有服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f
```

### 数据库初始化

数据库首次启动时会自动执行 `init-db.sql`：

1. 创建 `citext` 扩展（不区分大小写的文本）
2. 创建 `vector` 扩展（pgvector，用于向量相似度搜索）

### 重新初始化数据库

如果需要重新初始化数据库：

```bash
# 停止并删除卷
docker-compose down -v

# 重新启动（会重新执行init-db.sql）
docker-compose up -d
```

### 手动执行SQL

```bash
# 连接到数据库容器
docker-compose exec postgres psql -U context8 -d context8

# 检查扩展
\dx

# 退出
\q
```

## 修改初始化脚本

如果需要修改 `init-db.sql`：

1. 编辑 `docker/init-db.sql`
2. 删除现有数据库卷：`docker-compose down -v`
3. 重新启动：`docker-compose up -d`

## 端口配置

在根目录的 `.env` 文件中配置端口：

```bash
POSTGRES_PORT=5432
API_PORT=8000
```

## 健康检查

服务包含健康检查：

- **postgres**: `pg_isready` 每10秒检查一次
- **api**: 访问 `/docs` 端点每30秒检查一次

查看健康状态：

```bash
docker-compose ps
```

## 故障排查

### 数据库扩展未安装

```bash
# 检查扩展
docker-compose exec postgres psql -U context8 -d context8 -c "\dx"

# 如果缺少扩展，检查日志
docker-compose logs postgres
```

### 初始化脚本未执行

原因：数据卷已存在，初始化脚本只在首次创建时执行。

解决：删除卷重新创建：

```bash
docker-compose down -v
docker-compose up -d
```

## 详细文档

更多信息见：

- [README.md](../README.md) - 项目主文档
- [docs/README_LOCAL.md](../docs/README_LOCAL.md) - 本地部署详细指南
