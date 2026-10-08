# Superset 中文定制核心源码

基于 Apache Superset 6.1.0，包含图表控件、提示、日期格式、主题管理和中文语言包修复，以及嵌入页面与后台会话共存修复。

保留应用源码、前端插件、SDK、依赖与构建配置；不包含 AI/编辑器配置、本机部署目录、教学演示、运维报告、业务数据、账号或密钥。

源码来源：Apache Superset 6.1.0（上游提交 c83fb2bb1dcfac41ac51bcebd82471f4a7180d18），定制源码版本 7866b2b77de3a8cf6d2aeb03f972f166bc73221f。本仓库使用单独的精简源码快照，Apache LICENSE.txt、NOTICE 和源码版权声明保留。

主要目录：`superset/` 后端、`superset-frontend/` 前端与图表插件、`superset-core/` 核心库、`superset-embedded-sdk/` 嵌入 SDK、`superset-extensions-cli/` 扩展工具、`superset-websocket/` WebSocket 服务。`requirements/`、`docker/`、`scripts/` 为依赖与构建支持。

## 构建

```sh
docker build --build-arg BUILD_TRANSLATIONS=true -t fishery-port-superset:6.1.0-zh .
```

运行时通过环境变量或本地配置提供数据库连接和密钥，凭据不提交到 Git。完整安装与运行说明见 [Apache Superset 官方文档](https://superset.apache.org/)。
