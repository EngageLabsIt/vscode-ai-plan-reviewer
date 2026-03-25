import React, { forwardRef, memo } from 'react';

/**
 * Renders pre-processed HTML from PlanMarkdownEngine.
 * The HTML contains .annotatable-block elements with data-line/data-line-end attributes
 * that the annotation layer hooks into.
 */
export const MarkdownBody = memo(
  forwardRef<HTMLDivElement, { html: string }>(({ html }, ref) => (
    <div
      ref={ref}
      className='markdown-body'
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )),
);

MarkdownBody.displayName = 'MarkdownBody';
