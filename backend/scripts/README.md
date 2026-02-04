# Scripts Directory

## Maintenance Scripts (`maintenance/`)

- **reindex_es.py**: 从数据库重建 ES 索引
  - 用途：重建 ES 索引（可选语义向量）
  - 用法：`python scripts/maintenance/reindex_es.py`
  - 注意：需要 `ES_URL` 与数据库连接

## 本地运行脚本

注意：`local_server.py` 保留在根目录，因为它被Docker和Makefile直接引用。

- **local_server.py** (根目录)：本地开发服务器

## 运行说明

从项目根目录运行脚本：

```bash
# 从根目录运行
cd /root/Desktop/context8/context8-docker/backend

# 运行维护脚本
python scripts/maintenance/reindex_es.py

# 或使用模块方式
python -m scripts.maintenance.reindex_es
```
