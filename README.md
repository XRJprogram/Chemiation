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

## Branch Architecture

This repository maintains a clean, decoupled dual-branch architecture:

- **`main` (Current Branch — Pure Static Web Edition)**:
  - 100% serverless, zero backend dependencies.
  - Can be run directly from local disk or hosted on static services (GitHub Pages, Vercel, Cloudflare Pages).
  - Includes full 3D mechanism visualizer, CCPL IDE, and client-side AI Chemical Copilot.
- **`cloud-platform` (Fullstack Cloud Platform Edition)**:
  - Built-in lightweight Node.js server (`server/`), JSON database, and REST APIs.
  - User registration & JWT authentication (`js/auth.js`, `js/api.js`).
  - Community reaction repository for cloud saving, sharing, starring, and forking (`js/repo.js`).
  - Server administration & audit inspection dashboard ([`admin.html`](admin.html)).
  - To switch to the cloud platform branch: `git checkout cloud-platform`

---

## Project Structure

| File | Description |
| :--- | :--- |
| [`package.json`](package.json) | npm package configuration, metadata, scripts, and exports |
| [`index.js`](index.js) | npm entry point exporting `Pseudo3DRenderer`, `ReactionScriptEngine`, and `REACTION_PRESETS` |
| [`index.html`](index.html) | Main application entry: 3D viewport, step timeline track, AI Copilot, and CCPL script editor |
| [`docs.html`](docs.html) | CCPL Syntax & Reference Manual (Chinese) |
| [`docs_en.html`](docs_en.html) | CCPL Syntax & Reference Manual (English) |
| [`css/chemiation.css`](css/chemiation.css) | Core styles, responsive layout, and code editor theme |
| [`css/modal.css`](css/modal.css) | Dialog overlay and AI Copilot modal styles |
| [`js/pseudo3DRenderer.js`](js/pseudo3DRenderer.js) | Pseudo-3D canvas renderer, lighting/shading, in-flight transition interpolation, and polymer bracket projection |
| [`js/reactionData.js`](js/reactionData.js) | Pre-baked reaction mechanism presets, element properties, and bond topology datasets |
| [`js/scriptParser.js`](js/scriptParser.js) | CCPL parser, 3D automatic spatial layout solver, and serializer |
| [`js/aiAssistant.js`](js/aiAssistant.js) | Pure client-side AI Chemical Copilot (natural language generation, smart syntax debugging, BYOK multi-provider support) |
| [`js/reactionApp.js`](js/reactionApp.js) | Main application orchestrator, event bus, timeline manager, and i18n controller |

---

## Quick Start

Chemiation can be run directly or managed via npm:

1. **Direct Launch**: Open [`index.html`](index.html) directly in any modern web browser.
2. **Via npm**:
   ```bash
   npm start   # Launch local preview server (npx serve)
   npm test    # Run module & preset integrity verification tests
   ```
3. **Local Static Server (Alternative)**:
   ```bash
   python -m http.server 8080
   ```
4. **Deployment**: Host effortlessly on GitHub Pages, Cloudflare Pages, Vercel, or any static hosting service.

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

## 双分支架构说明

本项目采用清晰解耦的双分支管理策略：

- **`main`（当前主分支 · 纯前端单机版）**：
  - 100% 纯静态无后端，开箱即用，双击即可运行。
  - 完美适配 GitHub Pages、Vercel 等静态托管平台。
  - 完整集成三维机理动画、CCPL 脚本 IDE 与纯前端 AI 推演助手（BYOK 本地直连）。
- **`cloud-platform`（全栈云端平台分支）**：
  - 内置 Node.js 标准库 REST API 服务端与原子 JSON 数据库（`server/`）。
  - 用户注册登录认证与 JWT 令牌管理（`js/auth.js`、`js/api.js`）。
  - 云端机理作品社区仓库（发布、分享、点赞收藏、在线复刻 Fork，`js/repo.js`）。
  - 服务器运维监控与作品审计后台控制台（[`admin.html`](admin.html)）。
  - 切换至云端平台分支：`git checkout cloud-platform`

---

## 项目结构

| 文件 | 说明 |
| :--- | :--- |
| [`package.json`](package.json) | npm 包配置文件、元数据、脚本与导出定义 |
| [`index.js`](index.js) | npm 入口文件，导出 `Pseudo3DRenderer`、`ReactionScriptEngine` 及 `REACTION_PRESETS` |
| [`index.html`](index.html) | 主界面，包含三维视口、步骤时序轨道、AI 助手与 CCPL 脚本编辑器 |
| [`docs.html`](docs.html) | CCPL 语法手册（中文版） |
| [`docs_en.html`](docs_en.html) | CCPL 语法手册（英文版） |
| [`css/chemiation.css`](css/chemiation.css) | 界面样式、布局与代码编辑器主题 |
| [`css/modal.css`](css/modal.css) | 弹窗对话框与 AI Copilot 交互模态框样式 |
| [`js/pseudo3DRenderer.js`](js/pseudo3DRenderer.js) | 空间伪 3D 渲染器、化学键光影、过渡动画与聚合物括号绘制 |
| [`js/reactionData.js`](js/reactionData.js) | 内置机理数据、元素参数与反应拓扑 |
| [`js/scriptParser.js`](js/scriptParser.js) | CCPL 语法解析器、自动空间排布算法与序列化工具 |
| [`js/aiAssistant.js`](js/aiAssistant.js) | 纯前端 AI 反应机理助手（自然语言推演、智能排错、多模型直连） |
| [`js/reactionApp.js`](js/reactionApp.js) | 主控制器、交互事件与多语言中枢 |

---

## 快速开始

本项目既可直接静态运行，也可通过 npm 进行管理与调试：

1. **直接运行**：用现代浏览器打开 [`index.html`](index.html) 即可。
2. **通过 npm 启动与测试**：
   ```bash
   npm start   # 启动本地静态预览服务器 (npx serve)
   npm test    # 运行模块完整性与预设机理验证测试
   ```
3. **本地静态服务（备选）**：
   ```bash
   python -m http.server 8080
   ```
4. **部署**：可直接托管于 GitHub Pages 等任意静态站点服务。
