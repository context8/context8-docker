# Tests Directory

## 数据库测试

- **test_app_database.py**: 使用app/database.py配置测试数据库连接
  - 测试应用级别的数据库操作
  - 验证 SQLAlchemy 配置是否正确

- **test_asyncpg_direct.py**: 直接使用asyncpg测试数据库
  - 绕过 SQLAlchemy，直接测试 asyncpg 连接
  - 用于诊断低级别连接问题

- **test_db_connection.py**: 数据库连接测试
  - 全面的连接和配置测试
  - 验证 SSL、URL 解析等

## 运行测试

### 使用pytest (推荐)

```bash
# 安装pytest
pip install pytest pytest-asyncio

# 运行所有测试
pytest tests/

# 运行特定测试文件
pytest tests/test_app_database.py

# 显示详细输出
pytest tests/ -v
```

### 直接运行测试脚本

```bash
# 从项目根目录运行
cd /root/Desktop/context8/context8-docker/backend

python tests/test_app_database.py
python tests/test_asyncpg_direct.py
python tests/test_db_connection.py
```

## 环境要求

确保已设置 `.env` 文件中的 `DATABASE_URL`：

```bash
# .env 示例
DATABASE_URL=postgresql+asyncpg://context8:changeme@localhost:5432/context8
```

或者使用环境变量：

```bash
export DATABASE_URL="postgresql+asyncpg://..."
python tests/test_app_database.py
```

## 添加新测试

1. 在 `tests/` 目录创建新的测试文件，命名为 `test_*.py`
2. 确保测试函数以 `test_` 开头
3. 使用 `async def` 定义异步测试
4. 运行 `pytest tests/` 验证

## 注意事项

- 测试会连接到真实的数据库，请使用测试数据库
- 某些测试可能需要特定的数据库扩展（如 citext, vector）
- 测试执行前确保数据库服务正在运行
