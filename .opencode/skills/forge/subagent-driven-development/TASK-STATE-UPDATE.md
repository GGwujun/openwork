# Task State Update Protocol

## 核心规则

**在执行任务过程中，必须实时更新 tasks.md 文件中的 checkbox 状态。**

## 执行步骤

### 1. Task Start
```
todowrite({
  todos: [{ content: "Task X: 具体任务名", status: "in_progress", priority: "high" }]
})
```

### 2. During Implementation (每完成一个子步骤)
```
edit({
  filePath: "forge/tracks/<change>/tasks.md",
  oldString: "- [ ] 子步骤描述",
  newString: "- [x] 子步骤描述"
})
```

### 3. Task Complete
```
// 更新 tasks.md 主任务状态
edit({
  filePath: "forge/tracks/<change>/tasks.md",
  oldString: "### Task X: 任务名\n- [ ]",
  newString: "### Task X: 任务名\n- [x]"
})

// 更新 TodoWrite
todowrite({
  todos: [{ content: "Task X: 具体任务名", status: "completed", priority: "high" }]
})
```

### 4. Batch Progress (每 2-3 个任务)
```
edit({
  filePath: "forge/tracks/<change>/tasks.md",
  oldString: "### Task 1\n- [ ] 步骤1\n- [ ] 步骤2",
  newString: "### Task 1\n- [x] 步骤1\n- [x] 步骤2"
})
```

## 禁止行为

- ❌ 只在 TodoWrite 中标记，不编辑 tasks.md
- ❌ 等所有任务完成后再统一更新
- ❌ 批量完成任务后不更新文件状态

## 验证

每次执行 edit 后，立即读取文件确认更新成功：
```
read({ filePath: "forge/tracks/<change>/tasks.md", offset: X, limit: 10 })
```

## 为什么重要

1. **审计追踪** - tasks.md 是永久记录，TodoWrite 是临时状态
2. **断点续传** - 下次会话可以从 tasks.md 恢复进度
3. **人工审查** - 用户可以通过 git diff 看到实时进度
4. **问责制** - 明确记录哪些任务已完成，哪些还在进行中
