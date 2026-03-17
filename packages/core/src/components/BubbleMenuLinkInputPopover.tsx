import { useState, useEffect, useRef } from 'react';

export interface BubbleMenuLinkInputPopoverProps {
  initialUrl?: string;
  placeholder?: string;
  cancelLabel?: string;
  saveLabel?: string;
  onSave: (url: string) => void;
  onCancel: () => void;
}

export function BubbleMenuLinkInputPopover({
  initialUrl = '',
  placeholder = 'https://example.com',
  cancelLabel = 'Cancel',
  saveLabel = 'Save',
  onSave,
  onCancel,
}: BubbleMenuLinkInputPopoverProps) {
  const [url, setUrl] = useState(initialUrl);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  useEffect(() => {
    setUrl(initialUrl);
  }, [initialUrl]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      onSave(url.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div className="inkio-link-popover">
      <form onSubmit={handleSubmit} className="inkio-link-form">
        <input
          ref={inputRef}
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="inkio-link-input"
          autoComplete="off"
        />
        <div className="inkio-link-actions">
          <button
            type="button"
            onClick={onCancel}
            className="inkio-link-btn-cancel"
          >
            {cancelLabel}
          </button>
          <button
            type="submit"
            disabled={!url.trim()}
            className="inkio-link-btn-save"
          >
            {saveLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
