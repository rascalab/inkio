import { mapEditorUiToCoreProps, mergeImageBlockOptions } from '../editor-wrapper';

describe('editor wrapper mappers', () => {
  it('applies visibility defaults only when ui leaves them unset', () => {
    const defaults = { showToolbar: true, showBubbleMenu: false, showFloatingMenu: false, showTableMenu: true };
    expect(mapEditorUiToCoreProps(undefined, defaults)).toMatchObject(defaults);
    expect(mapEditorUiToCoreProps({ toolbar: false, bubbleMenu: {}, floatingMenu: true, tableMenu: false, className: 'x' }, defaults)).toMatchObject({
      ...defaults,
      showToolbar: false,
      showBubbleMenu: true,
      showFloatingMenu: true,
      showTableMenu: false,
      bubbleMenu: {},
      floatingMenu: undefined,
      className: 'x',
    });
  });

  it('merges upload/error handlers into image block options', () => {
    const onUpload = async () => 'src';
    const onError = () => {};
    expect(mergeImageBlockOptions(undefined, {})).toBeUndefined();
    expect(mergeImageBlockOptions({ maxFileSize: 5 }, {})).toEqual({ maxFileSize: 5 });
    expect(mergeImageBlockOptions({ maxFileSize: 5 }, { onUpload, onError })).toEqual({
      maxFileSize: 5,
      onUpload,
      onError,
    });
    expect(mergeImageBlockOptions(undefined, { onUpload })).toEqual({ onUpload });
  });

  it('preserves image cleanup options when merging preset upload handlers', () => {
    const onUpload = async () => 'src';
    const onDelete = () => {};
    expect(mergeImageBlockOptions({ cleanup: 'manual', onDelete }, { onUpload })).toEqual({
      cleanup: 'manual',
      onDelete,
      onUpload,
    });
  });
});
