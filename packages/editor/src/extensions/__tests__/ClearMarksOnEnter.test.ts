import { ClearMarksOnEnter } from '../ClearMarksOnEnter';

describe('ClearMarksOnEnter extension', () => {
  it('should have correct name', () => {
    expect(ClearMarksOnEnter.name).toBe('clearMarksOnEnter');
  });

  it('should define addStorage', () => {
    expect(ClearMarksOnEnter.config.addStorage).toBeDefined();
    const storage = ClearMarksOnEnter.config.addStorage!.call({} as any);
    expect(storage).toHaveProperty('timeoutId');
    expect(storage.timeoutId).toBeNull();
  });

  it('should define onDestroy', () => {
    expect(ClearMarksOnEnter.config.onDestroy).toBeDefined();
  });

  it('onDestroy should clear pending timeout', () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
    const fakeTimeoutId = setTimeout(() => {}, 10000);
    const context = {
      storage: { timeoutId: fakeTimeoutId },
    };
    ClearMarksOnEnter.config.onDestroy!.call(context as any);
    expect(clearTimeoutSpy).toHaveBeenCalledWith(fakeTimeoutId);
    expect(context.storage.timeoutId).toBeNull();
    clearTimeoutSpy.mockRestore();
  });
});
