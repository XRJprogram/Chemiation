# AI 对话存储接入说明

本次基于上游 `main` 的 `d506a6b` 增加服务端存储接口，沿用原有账号认证、Upstash 连接和环境变量。现有用户、机理仓库、日志的数据库结构及连接代码均保持兼容。此提交只提供存储与检索能力，尚未把上游网页接成聊天界面；本地已有聊天体验版可按下面的接口单独接入。

## 数据如何组织

一个账号下可以有多个机理项目，每个项目下可以有多段独立对话。对话文档包含 `projectId`、项目名快照、标题、消息、未发送草稿、脚本版本、当前版本编号及同步修订号。消息可保存问题、选项、自由回答和回复关系；脚本版本可保存来源、状态、父版本和修改范围。

`projectId` 使用机理原有的稳定 ID，不能使用可能重名或变化的显示名称。项目名变化时可更新 `projectName`。项目 ID 是账号内的分组键，并非新增的共享项目权限系统；服务端始终从登录令牌确定账号，忽略请求里的所有者字段。删除对话不会删除机理仓库。每段已保存对话的项目归属不可更改，需要转移时以新 ID 复制，原对话保留。

兼容旧记录：未提供 `projectId` 时保存为 `""`，归入“未分组对话”。不按对话标题猜测归属，也不自动迁移旧记录。`projectName` 是保存时的名称快照，历史名称可在下次保存时更新。

## 原有 Upstash 可以直接使用

复用 `server/.env` 或环境中的以下配置：

```dotenv
UPSTASH_REDIS_REST_URL=https://your-database-name.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_upstash_rest_token_here
UPSTASH_REDIS_PREFIX=chemiation:
```

不需要第二个数据库、不需要建表或执行迁移。令牌须有这些命令的读写权限：`EVAL`、`HGET`、`HSET`、`HDEL`、`HLEN`、`HVALS`、`HMGET`、`ZADD`、`ZREM`、`ZREVRANGE`。不要改动已有 `UPSTASH_REDIS_PREFIX`，也不要清空数据库。

新增键使用原有前缀，每个账号共三个键：

| 键 | 类型 | 保存内容 |
| --- | --- | --- |
| `<prefix>studio:{<userId>}:sessions` | Hash | 对话完整 JSON，字段为对话 ID |
| `<prefix>studio:{<userId>}:index` | Sorted set | 按最后保存时间排列的对话索引 |
| `<prefix>studio:{<userId>}:metadata` | Hash | 项目、标题、数量及已保留脚本名称等摘要 |

同一账号的三个键使用同一个 Redis hash tag，可在一段 Lua 脚本中原子更新。正文保留 Node.js 序列化的 JSON，避免 Lua 将空数组变成对象。只增加 `studio:` 命名空间，不读写现有的用户、机理和日志键。

Upstash 的 Lua 执行接口见官方 [EVAL 文档](https://upstash.com/docs/redis/sdks/ts/commands/scripts/eval)。本实现使用已有适配器发送通用 REST 命令，不引入该文档示例中的 SDK。

配置了 Upstash 后，它就是对话存储的来源：云端失败会返回错误，不会偷偷写入本地并显示同步成功。未配置 Upstash，或 `NODE_ENV=test` 时，使用 `<CHEMIATION_DATA_DIR>/studio/<userId>/<sessionId>.json`，默认位于 `server/data/studio/`。本地文件方案适合单个 Node 服务进程；多进程部署应配置 Upstash。新增目录已加入 `.gitignore`，数据目录和密钥都不应提交到 GitHub。

浏览器现有的 IndexedDB/LocalStorage 历史不会因部署服务端自动上传；客户端需要在用户登录后显式调用接口。这里的版本是脚本内容和历史关系的存储能力；恢复后把哪个脚本应用到动画，仍由客户端控制。

## API

除公开机理检索外，请携带现有登录接口签发的 `Authorization: Bearer <token>`。聊天及检索响应设置 `Cache-Control: no-store`。新建对话由客户端生成一个 UUID，再调用 `PUT`。

| 请求 | 作用 |
| --- | --- |
| `GET /api/studio/sessions` | 当前账号全部对话的摘要列表 |
| `GET /api/studio/sessions?projectId=<id>&offset=0&limit=20` | 指定项目下的对话摘要；`projectId=` 只查旧的未分组记录 |
| `GET /api/studio/sessions/<sessionId>` | 读取当前账号的一段完整对话 |
| `PUT /api/studio/sessions/<sessionId>` | 新建或保存对话和脚本版本 |
| `DELETE /api/studio/sessions/<sessionId>` | 删除自己的对话及索引 |
| `GET /api/studio/matches?q=<关键词>` | 匹配公开机理、自己的机理和自己历史对话中已保留的脚本 |

列表返回 `{ "items": [...], "nextOffset": null }`，单页最多 30 条。提供项目条件时只从摘要筛选，最多扫描当前账号 100 条摘要，不加载脚本和消息正文。

首次保存示例：

```json
{
  "expectedRevision": 0,
  "session": {
    "id": "client-generated-uuid",
    "projectId": "original-mechanism-id",
    "projectName": "酯化反应",
    "title": "讨论催化条件",
    "draft": "",
    "messages": [],
    "versions": [],
    "activeVersionId": ""
  }
}
```

保存成功返回 `{ "session": {..., "revision": 1} }`，之后保存需使用上次服务端返回的 `revision` 作为 `expectedRevision`。同一旧修订号的并发请求仅允许一个成功；另一个返回 `409`，客户端应保留本地副本并让用户选择，而不是覆盖云端。服务端控制修订号和更新时间，不相信请求里自带的修订号。

常见错误：`400` 格式或参数错误、`401` 未登录、`404` 当前账号找不到这段对话、`409` 旧版本冲突或试图改项目归属、`413` 超出容量、`503` 存储暂不可用。删除不存在或其他账号的同名 ID 会返回成功，但不会影响其他账号的数据。

检索只给出名称/关键词相近的候选，不等同于机理科学正确或条件适用。自己的历史脚本仅检索 `accepted`、`restored` 版本，`candidate` 不进入检索；“已保留”也不等于专家审核。只返回最多四个候选脚本，不返回其他对话的消息。历史对话存储暂不可用时，检索仍可返回现有机理仓库的可见结果。

容量：每账号最多 100 段对话；每段最多 160 条消息、40 个脚本版本、240 万个序列化字符；单个脚本最多 20 万字符。超限不会自动清理旧记录，应由客户端提供导出、清理和新建操作。元数据/消息字段会按约定限制长度；脚本过长直接拒绝，不截断保存。模型密钥、连接配置和传入的账号字段不属于保存契约，会被忽略；用户主动写进消息或脚本里的文字仍会按正文保存。

## 审核、验证和部署

1. 优先审核 `server/studioStore.js` 的原子保存和账号隔离，再看 `server/server.js` 的新增路由及 `js/aiStudioCore.js` 的保存格式。
2. 运行 `npm test` 和 `npm run test:server`。只验证新增功能可运行 `npm run test:studio`。测试使用临时目录、本地 HTTP 服务及 Upstash REST 模拟器，不需要生产凭据或模型 Key。
3. 合并后部署服务端时，必须同时带上 `js/aiStudioCore.js` 和 `server/studioStore.js`，只复制旧的 `server` 文件夹会缺少共享契约文件。现有项目正常启动方式 `server.bat` / `npm start` 不变。
4. 队长在自己的测试环境配置现有 Upstash 后，验证新建两段对话、换设备读取、并发保存冲突和删除，再上线。该 PR 的自动测试验证了真实适配器的 HTTP 传输和 Redis 命令契约，模拟器不执行 Lua；生产 Upstash 权限、额度和真实 Lua 执行尚需环境验证。本次不连接或修改生产数据库。

此提交没有调整网页布局、模型调用或动画渲染，也没有新增 npm 运行依赖。接入聊天体验版后，客户端可继续用本地草稿保护，并在登录状态下同步这些文档。
