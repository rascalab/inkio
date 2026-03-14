import { Extension } from '@tiptap/core';

/**
 * Enter 키를 누르면 모든 inline 마크(bold, italic 등)를 해제하는 extension
 * GitHub Markdown 스타일처럼 새 줄에서는 마크가 유지되지 않음
 */
export const ClearMarksOnEnter = Extension.create({
  name: 'clearMarksOnEnter',

  addStorage() {
    return {
      timeoutId: null as ReturnType<typeof setTimeout> | null,
    };
  },

  onDestroy() {
    if (this.storage.timeoutId !== null) {
      clearTimeout(this.storage.timeoutId);
      this.storage.timeoutId = null;
    }
  },

  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => {
        try {
          const { state } = editor;
          if (!state || !state.selection) {
            return false;
          }

          const { $from } = state.selection;
          if (!$from) {
            return false;
          }

          // storedMarks가 있거나 현재 위치에 마크가 있으면 해제
          const hasStoredMarks = state.storedMarks && state.storedMarks.length > 0;
          const marks = $from.marks?.();
          const hasCurrentMarks = marks && marks.length > 0;
          
          if (hasStoredMarks || hasCurrentMarks) {
            // Enter 처리 후 마크 해제 (이중 트랜잭션 방지)
            this.storage.timeoutId = setTimeout(() => {
              this.storage.timeoutId = null;
              if (!editor.isDestroyed) {
                editor.commands.unsetAllMarks();
              }
            }, 0);
          }
        } catch (e) {
          // 에러 발생 시 무시하고 기본 동작 수행
          console.warn('ClearMarksOnEnter error:', e);
        }
        
        // false를 반환하여 기본 Enter 동작(줄바꿈) 수행
        return false;
      },
    };
  },
});
