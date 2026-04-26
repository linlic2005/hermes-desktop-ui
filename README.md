# Hermes Desktop UI 🚀

[![CI](https://github.com/linlic2005/hermes-desktop-ui/actions/workflows/ci.yml/badge.svg)](https://github.com/linlic2005/hermes-desktop-ui/actions/workflows/ci.yml)
[![Releases](https://img.shields.io/github/v/release/linlic2005/hermes-desktop-ui)](https://github.com/linlic2005/hermes-desktop-ui/releases)

**Hermes Desktop UI** 是一款专为 Hermes Agent 设计的高性能桌面控制客户端。它基于 Tauri 2 + React + Vite 构建，旨在为用户提供一个安全、直观且跨平台的图形界面，用于管理和调度 Hermes 代理任务。

## ✨ 核心特性

- 🖥️ **跨平台支持**：原生支持 Windows 和 macOS，提供流畅的桌面体验。
- 🛡️ **安全隔离**：内置 FastAPI Gateway 作为安全边界，确保上游 Dashboard 保持在回环地址（127.0.0.1），通过带认证的网关暴露服务。
- ⚡ **极速响应**：基于 Rust 的 Tauri 框架，轻量级安装包，更低的内存占用。
- 🔌 **插件集成**：支持官方 Hermes 插件生态，由 Gateway 统一进行权限验证。
- 🛠️ **开发者友好**：完整的 PTY 终端支持，支持 TUI WebSocket 实时交互。

## 📦 安装指南

### 下载预编译包 (推荐)
请前往 [Releases](https://github.com/linlic2005/hermes-desktop-ui/releases) 页面下载适合您系统的安装程序：
- **Windows**: 下载 `.msi` 或 `.exe` 文件。
- **macOS**: 下载 `.dmg` 文件。

### 从源码构建

1. **克隆仓库**
   ```bash
   git clone https://github.com/linlic2005/hermes-desktop-ui.git
   cd hermes-desktop-ui
   ```

2. **安装前端依赖**
   ```bash
   npm install
   ```

3. **安装后端依赖 (Gateway)**
   ```bash
   cd backend
   python -m pip install -e .[test,pty]
   ```

4. **启动开发环境**
   ```bash
   # 终端 1: 启动后端网关
   cd backend
   uvicorn app.main:app --host 127.0.0.1 --port 9788

   # 终端 2: 启动 Tauri 桌面应用
   npm run tauri dev
   ```

## 🏗️ 架构设计

Hermes Desktop UI 采用“客户端-网关-核心”的三层架构：
1. **Frontend (UI)**: React 编写的单页应用，运行在 Tauri 的 WebView 中。
2. **Gateway (Backend)**: FastAPI 编写的中间层，处理身份认证、插件转发和 WebSocket 代理。
3. **Core (Hermes)**: 官方 Hermes Agent Dashboard，通常运行在 9119 端口并仅限本地访问。

## 📜 开源协议

本项目采用 [MIT License](LICENSE) 开源协议。

## 🤝 贡献指南

我们欢迎所有形式的贡献！无论是提交 Bug 反馈、功能建议，还是直接提交 Pull Request，您的帮助对我们至关重要。

---
*Powered by [Tauri](https://tauri.app/) and [Hermes Agent](https://github.com/google/hermes-agent).*
