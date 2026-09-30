/**
 * UploadTemplateCard — Thin shim around `<UploadTemplatePanel showTemplates={false} />`.
 *
 * Historically this component rendered only the upload half of the upload +
 * template picker. The unified `UploadTemplatePanel` now renders both
 * sections, so this wrapper exists purely for backwards-compatibility with
 * any caller that imports `UploadTemplateCard` directly.
 *
 * New code should mount `<UploadTemplatePanel />` instead.
 */

import UploadTemplatePanel, {
  type UploadTemplatePanelProps,
} from "./UploadTemplatePanel";

export type UploadTemplateCardProps = Pick<
  UploadTemplatePanelProps,
  "onUploaded" | "className"
>;

export default function UploadTemplateCard({
  onUploaded,
  className,
}: UploadTemplateCardProps) {
  return (
    <UploadTemplatePanel
      onUploaded={onUploaded}
      showTemplates={false}
      className={className}
    />
  );
}