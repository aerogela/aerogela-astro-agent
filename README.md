# aerogela-astro-agent — Agent 环境备份

本仓库是对 **aerogela.com 网站项目 + Agent 工作环境** 的完整备份,供后续 agent 接手工作使用。

## 概览

| 项 | 说明 |
| --- | --- |
| 网站 | https://aerogela.com — 气凝胶行业企业名录 / 目录站 |
| 技术栈 | Astro 5(静态生成)+ Pagefind 站内搜索 + Cloudflare Pages/Workers 部署 |
| 数据源 | 从 WordPress(aerogeldirectory)迁移,内容为结构化 JSON 内容集 |
| 涉及远程 | GitHub SSH `git@github.com:...` + Cloudflare API |

## 仓库结构

| 路径 | 内容 |
| --- | --- |
| `aerogela-astro/` | 网站源码,已升级为 `aerogela/aerogela-astro` 正式克隆(推送 `main` 即触发 Cloudflare 自动部署) |
| `.tools/` | 沙盒环境恢复工具脚本与系统库 `.deb` 备份 |
| `.credentials/` | 公钥 + 凭据恢复脚本(**不含私钥/Token**,见安全说明) |
| `.uploads/` | 迁移期的 CSV / ZIP / WordPress XML 原始数据 |
| `.screenshots/` | 工作过程截图留档 |
| `.trae-html-share-packages/` | SEO / 迁移 / 部署 HTML 报告包 |
| `AGENT_HANDOFF.md` | **接手必读** — 环境恢复 + 项目架构 + 部署 + 扩展指引 |

> 详细接手指引请先阅读 **[AGENT_HANDOFF.md](./AGENT_HANDOFF.md)**。