import { parseTasks } from "../../app/lib/tasks-parser";
import type { TaskCenterPlanDocs } from "../../app/lib/task-center-artifacts";

export type PlanDocsValidationResult =
  | { ok: true }
  | { ok: false; errors: string[]; message: string };

const buildMessage = (errors: string[]) => errors.join("；");

export class PlanDocsValidator {
  validate(docs: TaskCenterPlanDocs | null): PlanDocsValidationResult {
    const errors: string[] = [];

    if (!docs) {
      errors.push("未找到计划文档，请先生成执行计划");
      return { ok: false, errors, message: buildMessage(errors) };
    }

    if (!docs.intent?.trim()) {
      errors.push("intent.md 不存在或为空");
    }

    if (!docs.design?.trim()) {
      errors.push("design.md 不存在或为空");
    }

    if (!docs.tasks?.trim()) {
      errors.push("tasks.md 不存在或为空");
    } else {
      const parsed = parseTasks(docs.tasks);
      if (parsed.length === 0) {
        errors.push("tasks.md 格式不正确，无法解析任务列表");
      }
    }

    if (errors.length > 0) {
      return { ok: false, errors, message: buildMessage(errors) };
    }

    return { ok: true };
  }
}
