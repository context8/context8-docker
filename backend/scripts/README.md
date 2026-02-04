# Scripts Directory

## Deployment Scripts (`deployment/`)

- **modal_app.py**: Modal平台部署脚本
  - 用于在Modal.com上部署Context8 API
  - 不用于本地开发
  - 使用方法：参考Modal平台文档

## Maintenance Scripts (`maintenance/`)

- **rebuild_embeddings.py**: 重建向量嵌入
  - 用途：重建或更新数据库中的向量嵌入
  - 用法：`python scripts/maintenance/rebuild_embeddings.py`
  - 注意：需要配置数据库连接

- **fetch_secrets.py**: 获取密钥配置
  - 用途：从密钥管理系统获取配置
  - 用法：`python scripts/maintenance/fetch_secrets.py`
  - 注意：需要适当的访问权限

- **reconcile_es.py**: 对账 ES 与数据库并自动补偿
  - 用途：找出 ES 缺失或孤儿文档，并写入补偿队列
  - 用法：`python scripts/maintenance/reconcile_es.py --fix-missing --delete-orphans`
  - 注意：依赖 ES_URL 与 Redis 队列

## 本地运行脚本

注意：`local_server.py` 和 `local_cleanup.py` 保留在根目录，因为它们被Docker和Makefile直接引用。

- **local_server.py** (根目录)：本地开发服务器
- **local_cleanup.py** (根目录)：定期清理任务

## 运行说明

从项目根目录运行脚本：

```bash
# 从根目录运行
cd /root/Desktop/context8/context8-docker/backend

# 运行维护脚本
python scripts/maintenance/rebuild_embeddings.py
python scripts/maintenance/fetch_secrets.py
python scripts/maintenance/reconcile_es.py --fix-missing --delete-orphans

# 或使用模块方式
python -m scripts.maintenance.rebuild_embeddings
python -m scripts.maintenance.fetch_secrets
python -m scripts.maintenance.reconcile_es --fix-missing --delete-orphans
```
