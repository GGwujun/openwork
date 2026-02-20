// automation/core/event-bus.ts
// 事件总线 - 用于自动化引擎的事件通信

/**
 * 事件处理器类型
 */
type EventHandler = (data?: unknown) => void;

/**
 * 事件总线
 * 提供发布-订阅模式的事件通信
 */
export class EventBus {
  private events: Map<string, Set<EventHandler>> = new Map();

  /**
   * 订阅事件
   * @param event 事件名称
   * @param handler 事件处理器
   * @returns 取消订阅函数
   */
  on(event: string, handler: EventHandler): () => void {
    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }
    this.events.get(event)!.add(handler);

    // 返回取消订阅函数
    return () => {
      this.off(event, handler);
    };
  }

  /**
   * 取消订阅事件
   * @param event 事件名称
   * @param handler 事件处理器
   */
  off(event: string, handler: EventHandler): void {
    const handlers = this.events.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  /**
   * 触发事件
   * @param event 事件名称
   * @param data 事件数据
   */
  emit(event: string, data?: unknown): void {
    const handlers = this.events.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (error) {
          console.error(`事件处理器错误 [${event}]:`, error);
        }
      });
    }
  }

  /**
   * 触发事件（异步版本）
   * @param event 事件名称
   * @param data 事件数据
   */
  async emitAsync(event: string, data?: unknown): Promise<void> {
    const handlers = this.events.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          await handler(data);
        } catch (error) {
          console.error(`异步事件处理器错误 [${event}]:`, error);
        }
      }
    }
  }

  /**
   * 订阅一次性事件
   * @param event 事件名称
   * @param handler 事件处理器
   */
  once(event: string, handler: EventHandler): void {
    const onceHandler = (data?: unknown) => {
      this.off(event, onceHandler);
      handler(data);
    };
    this.on(event, onceHandler);
  }

  /**
   * 获取事件订阅数量
   * @param event 事件名称
   * @returns 订阅数量
   */
  listenerCount(event: string): number {
    return this.events.get(event)?.size || 0;
  }

  /**
   * 移除所有事件订阅
   * @param event 可选，指定事件名称。如果不提供，清除所有事件
   */
  removeAllListeners(event?: string): void {
    if (event) {
      this.events.delete(event);
    } else {
      this.events.clear();
    }
  }
}

/**
 * 全局事件总线实例
 */
export const globalEventBus = new EventBus();

export default EventBus;
