<div align="center">

# Chemiation · Chemical Reaction Principle & Mechanism Studio
### 化学反应机理推演工坊

<p align="center">
  <a href="#english"><b>English</b></a> &nbsp;|&nbsp; <a href="#chinese"><b>简体中文</b></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Language-English%20%7C%20%E7%AE%80%E4%BD%93%E4%B8%AD%E6%96%87-blue" alt="Language">
  <img src="https://img.shields.io/badge/Canvas-Pure%20HTML5-success" alt="HTML5 Canvas">
  <img src="https://img.shields.io/badge/License-MIT-orange" alt="License">
</p>

---

</div>

<div id="english"></div>

# English

## Overview

> **Chemiation** is an interactive, lightweight chemical reaction mechanism simulation and dynamic visualization platform built on pure HTML5 Canvas. It renders elementary reaction dynamics in a pseudo-3D perspective—molecular approach, bond dissociation and coordination, transition state and reactive intermediate evolution, as well as polymer stereocenter backbone elongation.

---

## Key Features

1. **Interactive 3D Mechanism Animations**:
   - Free 360° orbital rotation, smooth zooming, pan controls, and instant viewpoint reset.
   - Continuous playback without redundant pause intervals, smoothly linking elementary reaction steps.
   - Seamless **in-flight transition redirection**: switching steps mid-animation smoothly takes over from the instantaneous 3D atom coordinates without visual snapbacks.

2. **Refined Typography & Chemical Bonding**:
   - Standard CPK element color palette with depth-cue shading; bonds dynamically contour atom radii with crisp spatial hierarchy.
   - Standardized notation supporting single bonds, double bonds, triple bonds, radical unpaired electrons (`·`), and formal charges (`⊕` / `⊖`).

3. **Strict Mass & Element Conservation**:
   - Every reaction step strictly obeys atom conservation. Fully traces hydrogen transfers and small-molecule byproducts, eliminating floating or missing atoms.

4. **Polymer Bracket & Monomer View**:
   - Native support for repeating unit `[ ]ₙ` annotations. Polymer backbones dynamically extend toward the nearest viewport margins during rotation, preventing crossed or distorted bond lines.
   - Ability to designate backbone atoms and exclude condensation byproducts (such as $H_2O$).

5. **CCPL Scripting Engine & Automatic 3D Coordinate Solver**:
   - Built-in declarative Chemical Coordinate & Process Language (CCPL). Automatically computes 3D molecular conformations from bond connectivity without requiring manual Cartesian coordinates.
   - Supports LaTeX-style chemical notations (e.g., `CH_3COOH`, `CO_2`, `N_2 + 3H_2 <=> 2NH_3`, `[C_6H_{10}O_5]_n`).
   - Integrated in-browser editor with syntax highlighting, line numbers, error diagnostics, and full-screen workspace mode.

6. **Bilingual Support & Interactive Documentation**:
   - Instant one-click English/Chinese interface toggle with persistent local preference storage.
   - Interactive syntax manual button automatically links to the corresponding language documentation ([`docs_en.html`](docs_en.html) / [`docs.html`](docs.html)).

7. **AI Chemical Mechanism Assistant (Pure Client-Side Copilot)**:
   - **Natural Language to CCPL**: Describe any reaction mechanism in plain text (e.g., "SN2 Walden inversion with OH- attacking CH3Br"), and the AI generates full multi-step CCPL scripts with one-click injection into the editor.
   - **In-Editor Intelligent Auto-Fix**: When script syntax errors occur, click `[AI Auto-Fix]` to automatically diagnose and repair CCPL code.
   - **100% Serverless & Private**: Direct browser-to-API calls to OpenAI-compatible endpoints (DeepSeek, Qwen, SiliconFlow, OpenAI, Ollama, custom URL). API keys are strictly saved in local browser `localStorage` with zero server logging.

---

## Built-in Reaction Mechanisms

- **Fischer Esterification (Acetic Acid & Ethanol)**: Nucleophilic acyl addition, tetrahedral intermediate, and water elimination.
- **Artificial Synthesis of Starch from CO₂ (ASAP Mechanism)**: Catalytic hydrogenation, C-C bond coupling, triose isomerization, and glycosidic condensation.
- **NBS Allylic Free-Radical Bromination**: Radical initiation, delocalized allylic resonance intermediates, and chain propagation.
- **Haber-Bosch Ammonia Synthesis**: High-barrier triple-bond dissociation, surface adsorption, and step-wise catalytic hydrogenation.
- **Diels-Alder [4+2] Cycloaddition**: Concerted pericyclic cycloaddition of cyclopentadiene and ethylene into a rigid bicyclo[2.2.1]heptene (norbornene) scaffold.
- **Electrophilic Aromatic Substitution (Benzene Nitration)**: Generation of nitronium electrophile ($NO_2^+$), Wheland $\sigma$-complex intermediate formation, and proton elimination restoring aromaticity.

---

## Architecture & Dynamic Online Detection

Chemiation adopts a unified architecture on the `main` branch with seamless static and fullstack modes:

- **Static / Offline Mode (Default)**:
  - 100% serverless with zero backend requirements. Can be launched directly from disk (`file://`) or hosted on GitHub Pages, Cloudflare Pages, or Vercel.
  - When the server is not detected, all cloud actions (login, registration, mechanism repository, and cloud save) are automatically hidden from the interface.
  - Core 3D visualization, CCPL scripting IDE, and client-side AI Copilot work out of the box.

- **Optional Fullstack Cloud Platform (`server/`)**:
  - The repository includes a lightweight, zero-dependency Node.js backend under [`server/`](server/) using native Node.js standard libraries (`http`, `crypto`, `fs`).
  - When the server is started (`npm start` or double-clicking `server/start-server.bat`), the client dynamically detects connectivity via `/api/health` heartbeat.
  - The UI automatically reveals the Cloud Mechanism Repository, User Authentication, Star/Fork community system, and Cloud Save buttons.
  - Includes PBKDF2 password hashing, HMAC-SHA256 session tokens, role-based access control (RBAC), community reaction repository, and an administrative inspection dashboard ([`server/admin.html`](server/admin.html)).

---

## Project Structure

| File / Folder | Description |
| :--- | :--- |
| [`package.json`](package.json) | npm package configuration, metadata, scripts, and exports |
| [`index.js`](index.js) | npm entry point exporting `Pseudo3DRenderer`, `ReactionScriptEngine`, and `REACTION_PRESETS` |
| [`index.html`](index.html) | Main application entry: 3D viewport, step timeline track, AI Copilot, and CCPL script editor |
| [`docs.html`](docs.html) | CCPL Syntax & Reference Manual (Chinese) |
| [`docs_en.html`](docs_en.html) | CCPL Syntax & Reference Manual (English) |
| [`css/chemiation.css`](css/chemiation.css) | Core styles, responsive layout, dynamic online detection classes, and editor theme |
| [`css/modal.css`](css/modal.css) | Dialog overlay, authentication, repository, and AI Copilot modal styles |
| [`js/pseudo3DRenderer.js`](js/pseudo3DRenderer.js) | Pseudo-3D canvas renderer, lighting/shading, in-flight transition interpolation, and polymer bracket projection |
| [`js/reactionData.js`](js/reactionData.js) | Pre-baked reaction mechanism presets, element properties, and bond topology datasets |
| [`js/scriptParser.js`](js/scriptParser.js) | CCPL parser, 3D automatic spatial layout solver, and serializer |
| [`js/aiAssistant.js`](js/aiAssistant.js) | Pure client-side AI Chemical Copilot (natural language generation, smart syntax debugging, BYOK multi-provider support) |
| [`js/api.js`](js/api.js) | Client API SDK with automatic `/api/health` detection and online state dispatch |
| [`js/auth.js`](js/auth.js) | Client authentication controller and user profile dialog management |
| [`js/repo.js`](js/repo.js) | Community mechanism repository controller (cloud save, explore, star, fork) |
| [`js/reactionApp.js`](js/reactionApp.js) | Main application orchestrator, event bus, timeline manager, and i18n controller |
| [`server/`](server/) | Self-contained fullstack Node.js server, JSON database, REST API, test suite, and admin console |
| [`server/admin.html`](server/admin.html) | Server administration dashboard for user management, reaction moderation, and audit inspection |

---

## Quick Start

Chemiation supports both pure static usage and fullstack cloud capabilities:

1. **Static / Offline Mode**:
   - Double-click [`index.html`](index.html) in any modern browser, or host on GitHub Pages / Vercel.
   - Cloud buttons are automatically hidden. 3D mechanism simulation, CCPL IDE, and AI Copilot work offline.

2. **Fullstack Cloud Mode (Node.js)**:
   - Start the built-in server:
     ```bash
     npm start
     # or: node server/server.js
     # or double-click server/start-server.bat
     ```
   - Open `http://localhost:3000` in your browser.
   - Cloud repository, user accounts, and mechanism saving automatically activate.
   - Access the admin panel at `http://localhost:3000/admin.html` (default credentials: `admin` / `Admin123!`).

3. **Running Tests**:
   ```bash
   npm test            # Run client-side presets and module integrity tests
   npm run test:server # Run fullstack server test suite (23 integration tests)
   ```

---

<div id="chinese"></div>

# 简体中文

## 概述

> **Chemiation** 是一个基于原生 Canvas 的化学反应机理推演与动态可视化工具，通过三维视角直观呈现分子靠近、化学键断裂与重组、中间体演化及高分子聚合的全流程。

---

## 核心特性

1. **三维机理动画**：
   - 支持 360° 自由旋转、平滑缩放与视角复位，直观展现断键、成键与原子迁移过程。
   - 连续播放无等待间隔，流畅衔接各基元反应步骤。
   - 支持**瞬时空中过渡接管**：动画中途切换步骤时，直接从空中瞬时坐标平滑转向新目标，杜绝视觉回跳。

2. **清晰的符号与化学键排印**：
   - 采用标准元素符号与景深色阶，化学键自动贴合原子轮廓，层次分明。
   - 包含单键、双键、三键、自由基单电子（`·`）与形式电荷（`⊕` / `⊖`）等规范标注。

3. **严格质量与元素守恒**：
   - 反应过程始终遵循原子守恒，完整展现氢原子与小分子副产物的转移，消除原子悬空或缺失。

4. **高分子聚合大括号视图**：
   - 支持高分子最简重复单元 `[ ]ₙ` 标注，主链根据旋转视角自动就近向两侧延伸，避免键线交叉错位。
   - 支持指定主链骨架原子并排除脱水等副产物分子。

5. **CCPL 推演脚本与自动空间排布**：
   - 内置简洁声明式语法（CCPL），无需手动编写三维空间坐标，声明连接关系后即可自动解算分子三维构型。
   - 支持 LaTeX 风格化学式（如 `CH_3COOH`、`CO_2`、`N_2 + 3H_2 <=> 2NH_3`、`[C_6H_{10}O_5]_n`）。
   - 提供代码高亮、行号对齐、错误定位提示与全屏编写模式。

6. **中英双语与文档**：
   - 界面文字支持中英文一键切换，点击语法手册自动打开对应语言的完整文档（[`docs.html`](docs.html) / [`docs_en.html`](docs_en.html)）。

7. **AI 反应机理推演助手（纯前端客户端 Copilot）**：
   - **自然语言一键生成机理**：输入任意自然语言提示词（如“设计 SN2 亲核取代反应机理，体现背部进攻与瓦尔登翻转”），AI 即时推导并输出多步骤 CCPL 脚本，支持一键注入编辑器。
   - **编辑器智能语法排错**：脚本解析拦截错误时，一键点击 `[AI 智能排错]`，AI 自动定位错误行并重写修复。
   - **纯客户端无服务架构 & 隐私安全**：直连 OpenAI 标准兼容接口（支持 DeepSeek、通义千问 Qwen、SiliconFlow 硅基流动、OpenAI、本地 Ollama 或自定义兼容端点）。API Key 仅安全保存在浏览器本地 `localStorage`，无任何后端转存与隐私泄漏风险。

---

## 内置反应机理

- **乙酸与乙醇费歇尔酯化反应**：亲核加成、四面体中间体与脱水消除
- **二氧化碳人工合成淀粉 (ASAP机理)**：还原加氢、C-C 偶联、三碳糖异构、成环至糖苷键缩聚
- **NBS 烯丙基自由基溴代**：引发生成溴自由基、离域烯丙基共振体与链传递
- **哈伯-博施法合成氨**：高键能分子解离活化与催化加氢
- **环戊二烯与乙烯狄尔斯-阿尔德加成**：$[4+2]$ 协同环加成与双环降冰片烯立体桥环构型
- **苯的亲电芳香取代硝化反应**：亲电试剂产生、Wheland 络合物（芳基碳正离子中间体）形成与质子消除恢复芳香性

---

## 架构与动态服务端集成

本项目在 `main` 主分支上统一管理，支持静态单机与全栈云端两种模式无缝平滑切换：

- **静态单机模式（默认）**：
  - 100% 纯前端静态无后端依赖，支持本地双击运行（`file://`）或直接部署到 GitHub Pages、Vercel 等静态托管服务。
  - 当未启动或未连接服务端时，界面自动完全隐藏云端仓库、登录注册、个人中心及云端保存按钮，零干扰。
  - 三维机理动画、CCPL 推演 IDE、纯前端 AI 机理助手（BYOK 本地直连）完全可用。

- **可选全栈云端平台（`server/` 独立目录）**：
  - 所有服务端文件统一收敛至 [`server/`](server/) 目录，采用 Node.js 原生标准库（`http`、`crypto`、`fs`）开发，零第三方 npm 依赖。
  - 启动服务端（`npm start` 或双击 `server/start-server.bat`）后，前端通过 `/api/health` 探针自动感知服务在线状态。
  - 界面自动唤醒并展示云端机理社区仓库、用户注册登录、点赞收藏、在线复刻与云端保存功能。
  - 内置基于 PBKDF2 的加盐密码哈希、HMAC-SHA256 签名会话、角色权限控制（RBAC）、审计日志及独立运维管理后台（[`server/admin.html`](server/admin.html)）。

---

## 项目结构

| 文件 / 目录 | 说明 |
| :--- | :--- |
| [`package.json`](package.json) | npm 包配置文件、元数据、脚本与导出定义 |
| [`index.js`](index.js) | npm 入口文件，导出 `Pseudo3DRenderer`、`ReactionScriptEngine` 及 `REACTION_PRESETS` |
| [`index.html`](index.html) | 主界面，包含三维视口、步骤时序轨道、AI 助手与 CCPL 脚本编辑器 |
| [`docs.html`](docs.html) | CCPL 语法手册（中文版） |
| [`docs_en.html`](docs_en.html) | CCPL 语法手册（英文版） |
| [`css/chemiation.css`](css/chemiation.css) | 界面样式、布局、动态在线感知类与代码编辑器主题 |
| [`css/modal.css`](css/modal.css) | 弹窗对话框、认证模态框、作品社区与 AI 助手样式 |
| [`js/pseudo3DRenderer.js`](js/pseudo3DRenderer.js) | 空间伪 3D 渲染器、化学键光影、过渡动画与聚合物括号绘制 |
| [`js/reactionData.js`](js/reactionData.js) | 内置机理数据、元素参数与反应拓扑 |
| [`js/scriptParser.js`](js/scriptParser.js) | CCPL 语法解析器、自动空间排布算法与序列化工具 |
| [`js/aiAssistant.js`](js/aiAssistant.js) | 纯前端 AI 反应机理助手（自然语言推演、智能排错、多模型直连） |
| [`js/api.js`](js/api.js) | 客户端 API SDK，支持自动 `/api/health` 探针检测与在线状态调度 |
| [`js/auth.js`](js/auth.js) | 客户端用户认证控制器与个人中心弹窗管理 |
| [`js/repo.js`](js/repo.js) | 云端机理社区仓库控制器（云端保存、探索广场、点赞、复刻） |
| [`js/reactionApp.js`](js/reactionApp.js) | 主控制器、交互事件与多语言中枢 |
| [`server/`](server/) | 独立全栈 Node.js 服务端、原子 JSON 数据库、REST API、测试套件与运维后台 |
| [`server/admin.html`](server/admin.html) | 服务端运维管理后台（用户管理、机理审核与审计日志） |

---

## 快速开始

本项目既可纯静态离线运行，也可体验完整的全栈云端功能：

1. **静态离线运行**：
   - 现代浏览器直接双击打开 [`index.html`](index.html)，或部署至 GitHub Pages 等静态托管环境。
   - 云端交互元素自动隐藏，三维动画、CCPL 编写与 AI 助手正常工作。

2. **全栈云端模式（Node.js）**：
   - 启动内置服务端：
     ```bash
     npm start
     # 或执行: node server/server.js
     # 或双击 server/start-server.bat
     ```
   - 在浏览器中访问 `http://localhost:3000`。
   - 云端作品仓库、用户系统与云端保存功能自动激活。
   - 访问管理后台：`http://localhost:3000/admin.html`（默认管理员账号：`admin` / `Admin123!`）。

3. **运行测试**：
   ```bash
   npm test            # 运行前端模块与预设机理验证测试
   npm run test:server # 运行服务端全栈集成测试套件（23 项测试）
   ```
