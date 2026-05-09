# mprocs 使用指南

## 基础概念

mprocs 是 `multi-processes` 的缩写，用于在终端中同时运行和管理多个进程。

## 核心命令

```bash
mprocs                  # 使用默认配置文件 mprocs.yaml
mprocs -c <file.yaml>   # 指定配置文件
```

## 配置文件结构

```yaml
# ── 全局配置 ─────────────────────────────────────────
proc_log:
  dir: .mprocs-logs      # 日志保存目录
  mode: truncate          # truncate: 启动时清空 | append: 追加

scrollback: 5000          # 回滚缓冲区行数

procs:
  服务名:
    shell: "启动命令"
    stop: SIGINT          # 停止信号: SIGINT(推荐) | SIGTERM | SIGKILL
    autostart: true       # 是否自动启动
    log:
      mode: append        # append: 追加日志 | truncate: 清空
```

## 常用配置示例

```yaml
procs:
  gateway:
    shell: pnpm start:gateway
    stop: SIGINT
    autostart: true
    log:
      mode: append

  order-service:
    shell: pnpm start:order
    stop: SIGINT
    autostart: true
    log:
      mode: append
```

## TUI 操作

| 按键 | 操作 |
|------|------|
| `↑ ↓` | 选择进程 |
| `Enter` | 启动/重启选中的进程 |
| `r` | 重启选中的进程 |
| `s` | 停止选中的进程 |
| `q` | 退出 mprocs |
| `c` | 清屏（只留选中进程的输出） |
| `l` | 查看日志文件 |
| `?` | 快捷键帮助 |

## 与 package.json 集成

```json
{
  "scripts": {
    "dev": "LANG=zh_CN.UTF-8 mprocs -c mprocs.yaml"
  }
}
```

`LANG=zh_CN.UTF-8` 确保中文显示正常。

## 日志查看

日志保存在 `.mprocs-logs/` 目录，每个进程一个 `.log` 文件。
