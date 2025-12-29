---
description: 终端命令执行最佳实践
---

# 终端命令执行工作流

## 重要：命令执行方式

**由于 Windows cmd 环境下 `run_command` 工具可能存在命令丢失的问题，推荐使用以下两步执行方式：**

### 步骤 1：启动终端

使用 `run_command` 启动一个终端会话：
```
run_command(CommandLine="cmd", Cwd="<工作目录>", WaitMsBeforeAsync=1000)
```

### 步骤 2：发送命令

使用 `send_command_input` 发送实际命令：
```
send_command_input(CommandId="<上一步返回的ID>", Input="<命令>\n", WaitMs=3000)
```

## 示例

执行 `node --version`：

1. 先启动终端：
```
run_command(CommandLine="cmd", Cwd="F:\WorkSpace\WebStorm\claude-relay-service", WaitMsBeforeAsync=1000)
```

2. 发送命令：
```
send_command_input(CommandId="xxx", Input="node --version\n", WaitMs=3000)
```

## 为什么要这样做？

- `run_command` 在 Windows 环境下有时只打开终端窗口，但命令本身不会被执行
- 使用 `send_command_input` 可以确保命令被正确发送到终端
- 这种方式更可靠，尤其是对于交互式命令

## 交互式命令

对于需要用户输入的交互式命令（如 REPL、确认提示等），必须使用 `send_command_input`：

```
send_command_input(CommandId="xxx", Input="y\n", WaitMs=2000)  // 发送确认
```

## 检查命令状态

使用 `command_status` 检查后台命令的执行状态：
```
command_status(CommandId="xxx", WaitDurationSeconds=5, OutputCharacterCount=1000)
```
