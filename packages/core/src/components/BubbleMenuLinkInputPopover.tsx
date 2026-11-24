import { useState, useEffect } from 'react';
import { isSafeUrl, normalizeLinkInput } from '../utils/url-safety';

export interface BubbleMenuLinkInputPopoverProps {
  initialUrl?: string;
  placeholder?: string;
  cancelLabel?: string;
  saveLabel?: string;
  invalidUrlLabel?: string;
  onSave: (url: string) => void;
  onCancel: () => void;
}

export function BubbleMenuLinkInputPopover({
  initialUrl = '',
  placeholder = 'https://example.com',
  cancelLabel = 'Cancel',
  saveLabel = 'Save',
  invalidUrlLabel = 'This URL is not allowed.',
  onSave,
  onCancel,
}: BubbleMenuLinkInputPopoverProps) {
  const [url, setUrl] = useState(initialUrl);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setUrl(initialUrl);
    setError(null);
  }, [initialUrl]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) {
      return;
    }
    // Block javascript:/data:/vbscript: payloads before they reach the document.
    if (!isSafeUrl(trimmed)) {
      setError(invalidUrlLabel);
      return;
    }
    setError(null);
    onSave(normalizeLinkInput(trimmed));
  };

  return (
    <div className="inkio-link-popover">
      <form onSubmit={handleSubmit} className="inkio-link-form">
        <input
          type="text"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            if (error) setError(null);
          }}
          placeholder={placeholder}
          className="inkio-link-input"
          autoComplete="off"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'inkio-link-url-error' : undefined}
        />
        {error && (
          <p id="inkio-link-url-error" role="alert" className="inkio-link-error">
            {error}
          </p>
        )}
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
