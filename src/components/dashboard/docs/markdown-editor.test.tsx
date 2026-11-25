import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MarkdownEditor } from './markdown-editor'

afterEach(() => {
  cleanup()
})

describe('MarkdownEditor review date', () => {
  it('sends the selected review date with the document', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(
      <MarkdownEditor
        isNew
        initialTitle="Runbook"
        initialContent="Steps"
        onSave={onSave}
        onCancel={vi.fn()}
      />
    )

    fireEvent.change(screen.getByLabelText('Next review'), { target: { value: '2027-03-04' } })
    fireEvent.click(screen.getByRole('button', { name: /create doc/i }))

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ reviewDate: '2027-03-04T00:00:00.000Z' })
    )
  })

  it('clears an existing review date', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(
      <MarkdownEditor
        initialTitle="Runbook"
        initialContent="Steps"
        initialReviewDate="2027-03-04"
        onSave={onSave}
        onCancel={vi.fn()}
      />
    )

    fireEvent.change(screen.getByLabelText('Next review'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ reviewDate: null }))
  })
})
