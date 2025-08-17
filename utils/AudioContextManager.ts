export class AudioContextManager {
  private static contexts = new Map<string, AudioContext>();
  private static refCounts = new Map<string, number>();

  static acquire(key: string = 'default'): AudioContext {
    let context = this.contexts.get(key);
    
    if (!context || context.state === 'closed') {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      context = new AudioContextClass();
      this.contexts.set(key, context);
      this.refCounts.set(key, 0);
    }
    
    this.refCounts.set(key, (this.refCounts.get(key) || 0) + 1);
    return context;
  }

  static release(key: string = 'default'): void {
    const count = (this.refCounts.get(key) || 0) - 1;
    this.refCounts.set(key, Math.max(0, count));
    
    if (count <= 0) {
      const context = this.contexts.get(key);
      if (context && context.state !== 'closed') {
        context.close().catch(console.error);
      }
      this.contexts.delete(key);
      this.refCounts.delete(key);
    }
  }

  static async suspend(key: string = 'default'): Promise<void> {
    const context = this.contexts.get(key);
    if (context && context.state === 'running') {
      await context.suspend();
    }
  }

  static async resume(key: string = 'default'): Promise<void> {
    const context = this.contexts.get(key);
    if (context && context.state === 'suspended') {
      await context.resume();
    }
  }
}
