/**
 * QuoteEditor Component
 * Inline editing of quote line items with:
 * - Add/remove line items
 * - Edit hours estimates
 * - Edit descriptions
 * - TipTap rich text editor for notes
 * - Auto-save functionality
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  Plus,
  Trash2,
  GripVertical,
  Check,
  Edit2,
  AlertCircle,
  Loader2,
  Bold,
  Italic,
  List,
  ListOrdered,
  Undo,
  Redo,
} from 'lucide-react';
import { cn, generateId, calculateExpectedHours } from '../../lib/utils';
import { useAutoSave } from '../../hooks/useAutoSave';
import type { Quote, Deliverable, QuoteContent } from '../../types/quote.types';

interface QuoteEditorProps {
  quote: Quote;
  onSave: (content: Partial<QuoteContent>) => Promise<void>;
  onCancel?: () => void;
  className?: string;
}

// Editable deliverable with local state
interface EditableDeliverable extends Deliverable {
  isEditing?: boolean;
  isNew?: boolean;
}

export const QuoteEditor: React.FC<QuoteEditorProps> = ({
  quote,
  onSave,
  onCancel,
  className,
}) => {
  // Local state for editing
  const [deliverables, setDeliverables] = useState<EditableDeliverable[]>(
    quote.content.deliverables.map((d) => ({ ...d }))
  );
  const [assumptions, setAssumptions] = useState<string[]>([...quote.content.assumptions]);
  const [executiveSummary, setExecutiveSummary] = useState(quote.content.executive_summary);
  const [hasChanges, setHasChanges] = useState(false);

  // Track which row is being edited
  const [editingRowId, setEditingRowId] = useState<string | null>(null);

  // Build the content object for saving
  const buildContent = useCallback((): Partial<QuoteContent> => {
    // Recalculate totals
    const totals = {
      ...quote.content.totals,
      total_optimistic_hours: deliverables.reduce((sum, d) => sum + d.estimate.optimistic_hours, 0),
      total_most_likely_hours: deliverables.reduce((sum, d) => sum + d.estimate.most_likely_hours, 0),
      total_pessimistic_hours: deliverables.reduce((sum, d) => sum + d.estimate.pessimistic_hours, 0),
      total_expected_hours: deliverables.reduce((sum, d) => sum + d.estimate.expected_hours, 0),
      total_cost: 0,
    };

    return {
      executive_summary: executiveSummary,
      deliverables: deliverables.map(({ isEditing: _isEditing, isNew: _isNew, ...d }) => ({
        ...d,
        estimate: {
          ...d.estimate,
          cost: d.estimate.cost ?? (d.estimate.expected_hours * (quote.content?.totals?.hourly_rate ?? 0)),
        },
      })),
      assumptions,
      totals,
    };
  }, [deliverables, assumptions, executiveSummary, quote.content?.totals?.hourly_rate]);

  // Auto-save hook
  const { status: saveStatus, lastSaved, error: saveError } = useAutoSave({
    data: buildContent(),
    onSave: async (content) => {
      await onSave(content);
      setHasChanges(false);
    },
    debounceMs: 2000,
    enabled: hasChanges,
  });

  /**
   * Mark content as changed
   */
  const markChanged = useCallback(() => {
    setHasChanges(true);
  }, []);

  /**
   * Handle deliverable field update
   */
  const updateDeliverable = useCallback(
    (id: string, updates: Partial<EditableDeliverable>) => {
      setDeliverables((prev) =>
        prev.map((d) => {
          if (d.id !== id) return d;

          const updated = { ...d, ...updates };

          // Recalculate expected hours if estimate changed
          if (updates.estimate) {
            updated.estimate = {
              ...d.estimate,
              ...updates.estimate,
              expected_hours: calculateExpectedHours(
                updates.estimate.optimistic_hours ?? d.estimate.optimistic_hours,
                updates.estimate.most_likely_hours ?? d.estimate.most_likely_hours,
                updates.estimate.pessimistic_hours ?? d.estimate.pessimistic_hours
              ),
            };
          }

          return updated;
        })
      );
      markChanged();
    },
    [markChanged]
  );

  /**
   * Add new deliverable
   */
  const addDeliverable = useCallback(() => {
    const newDeliverable: EditableDeliverable = {
      id: generateId(),
      name: 'New Item',
      description: 'Description...',
      category: '',
      estimate: {
        optimistic_hours: 0,
        most_likely_hours: 0,
        pessimistic_hours: 0,
        expected_hours: 0,
      },
      isEditing: true,
      isNew: true,
    };
    setDeliverables((prev) => [...prev, newDeliverable]);
    setEditingRowId(newDeliverable.id);
    markChanged();
  }, [markChanged]);

  /**
   * Remove deliverable
   */
  const removeDeliverable = useCallback(
    (id: string) => {
      setDeliverables((prev) => prev.filter((d) => d.id !== id));
      markChanged();
    },
    [markChanged]
  );

  /**
   * Add assumption
   */
  const addAssumption = useCallback(() => {
    setAssumptions((prev) => [...prev, '']);
    markChanged();
  }, [markChanged]);

  /**
   * Update assumption
   */
  const updateAssumption = useCallback(
    (index: number, value: string) => {
      setAssumptions((prev) => {
        const updated = [...prev];
        updated[index] = value;
        return updated;
      });
      markChanged();
    },
    [markChanged]
  );

  /**
   * Remove assumption
   */
  const removeAssumption = useCallback(
    (index: number) => {
      setAssumptions((prev) => prev.filter((_, i) => i !== index));
      markChanged();
    },
    [markChanged]
  );

  /**
   * Calculate totals
   */
  const totals = useMemo(() => {
    const optimistic = deliverables.reduce((sum, d) => sum + d.estimate.optimistic_hours, 0);
    const mostLikely = deliverables.reduce((sum, d) => sum + d.estimate.most_likely_hours, 0);
    const pessimistic = deliverables.reduce((sum, d) => sum + d.estimate.pessimistic_hours, 0);
    const expected = deliverables.reduce((sum, d) => sum + d.estimate.expected_hours, 0);
    const cost = expected * quote.content.totals.hourly_rate;

    return { optimistic, mostLikely, pessimistic, expected, cost };
  }, [deliverables, quote.content.totals.hourly_rate]);

  return (
    <div className={cn('bg-white rounded-lg border border-gray-200', className)}>
      {/* Editor Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 rounded-t-lg">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              Edit {quote.quote_number}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Make changes to the quote. Changes are auto-saved.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Save Status Indicator */}
            <SaveStatusIndicator
              status={saveStatus}
              lastSaved={lastSaved}
              error={saveError}
            />
            {onCancel && (
              <button
                onClick={onCancel}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Done Editing
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Executive Summary Editor */}
      <div className="px-6 py-4 border-b border-gray-200">
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Executive Summary
        </label>
        <RichTextEditor
          content={executiveSummary}
          onChange={(content) => {
            setExecutiveSummary(content);
            markChanged();
          }}
          placeholder="Enter executive summary..."
        />
      </div>

      {/* Deliverables Editor */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-700">Deliverables</h3>
          <button
            onClick={addDeliverable}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Item
          </button>
        </div>

        {/* Deliverables Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left py-3 px-2 font-semibold text-gray-600 w-8"></th>
                <th className="text-left py-3 px-2 font-semibold text-gray-600">Item</th>
                <th className="text-center py-3 px-2 font-semibold text-gray-600 w-20">Min</th>
                <th className="text-center py-3 px-2 font-semibold text-gray-600 w-20">Likely</th>
                <th className="text-center py-3 px-2 font-semibold text-gray-600 w-20">Max</th>
                <th className="text-center py-3 px-2 font-semibold text-gray-600 w-20">Exp.</th>
                <th className="text-right py-3 px-2 font-semibold text-gray-600 w-20">Actions</th>
              </tr>
            </thead>
            <tbody>
              {deliverables.map((item) => (
                <DeliverableRow
                  key={item.id}
                  deliverable={item}
                  isEditing={editingRowId === item.id}
                  onStartEdit={() => setEditingRowId(item.id)}
                  onEndEdit={() => setEditingRowId(null)}
                  onUpdate={(updates) => updateDeliverable(item.id, updates)}
                  onRemove={() => removeDeliverable(item.id)}
                />
              ))}
            </tbody>
            {/* Totals Row */}
            <tfoot>
              <tr className="border-t-2 border-gray-300 bg-blue-50 font-semibold">
                <td className="py-3 px-2"></td>
                <td className="py-3 px-2 text-gray-900">Total</td>
                <td className="py-3 px-2 text-center text-gray-700">{totals.optimistic}</td>
                <td className="py-3 px-2 text-center text-gray-700">{totals.mostLikely}</td>
                <td className="py-3 px-2 text-center text-gray-700">{totals.pessimistic}</td>
                <td className="py-3 px-2 text-center text-blue-700">{totals.expected}</td>
                <td className="py-3 px-2"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Assumptions Editor */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-700">Assumptions</h3>
          <button
            onClick={addAssumption}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Assumption
          </button>
        </div>
        <div className="space-y-2">
          {assumptions.map((assumption, index) => (
            <AssumptionRow
              key={index}
              value={assumption}
              onChange={(value) => updateAssumption(index, value)}
              onRemove={() => removeAssumption(index)}
            />
          ))}
          {assumptions.length === 0 && (
            <p className="text-sm text-gray-500 italic">No assumptions added yet.</p>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="px-6 py-4 bg-gray-50 rounded-b-lg">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">
            {deliverables.length} deliverable{deliverables.length !== 1 ? 's' : ''} |{' '}
            {assumptions.length} assumption{assumptions.length !== 1 ? 's' : ''}
          </span>
          <span className="font-medium text-gray-900">
            Estimated Cost: ${(totals.cost).toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
};

/**
 * Save status indicator component
 */
interface SaveStatusIndicatorProps {
  status: 'idle' | 'saving' | 'saved' | 'error';
  lastSaved: Date | null;
  error: string | null;
}

const SaveStatusIndicator: React.FC<SaveStatusIndicatorProps> = ({
  status,
  lastSaved,
  error: _error,
}) => {
  return (
    <div className="flex items-center gap-2 text-sm">
      {status === 'saving' && (
        <>
          <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
          <span className="text-blue-600">Saving...</span>
        </>
      )}
      {status === 'saved' && (
        <>
          <Check className="h-4 w-4 text-green-600" />
          <span className="text-green-600">Saved</span>
        </>
      )}
      {status === 'error' && (
        <>
          <AlertCircle className="h-4 w-4 text-red-600" />
          <span className="text-red-600">Failed to save</span>
        </>
      )}
      {status === 'idle' && lastSaved && (
        <span className="text-gray-500">
          Last saved: {lastSaved.toLocaleTimeString()}
        </span>
      )}
    </div>
  );
};

/**
 * Deliverable row component with inline editing
 */
interface DeliverableRowProps {
  deliverable: EditableDeliverable;
  isEditing: boolean;
  onStartEdit: () => void;
  onEndEdit: () => void;
  onUpdate: (updates: Partial<EditableDeliverable>) => void;
  onRemove: () => void;
}

const DeliverableRow: React.FC<DeliverableRowProps> = ({
  deliverable,
  isEditing,
  onStartEdit,
  onEndEdit,
  onUpdate,
  onRemove,
}) => {
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditing]);

  if (isEditing) {
    return (
      <tr className="border-b border-gray-100 bg-blue-50/50">
        <td className="py-3 px-2">
          <GripVertical className="h-4 w-4 text-gray-400 cursor-grab" />
        </td>
        <td className="py-3 px-2">
          <input
            ref={nameInputRef}
            type="text"
            value={deliverable.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Item name"
          />
          <input
            type="text"
            value={deliverable.description}
            onChange={(e) => onUpdate({ description: e.target.value })}
            className="w-full px-2 py-1 mt-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Description"
          />
        </td>
        <td className="py-3 px-2">
          <HoursInput
            value={deliverable.estimate.optimistic_hours}
            onChange={(val) =>
              onUpdate({ estimate: { ...deliverable.estimate, optimistic_hours: val } })
            }
          />
        </td>
        <td className="py-3 px-2">
          <HoursInput
            value={deliverable.estimate.most_likely_hours}
            onChange={(val) =>
              onUpdate({ estimate: { ...deliverable.estimate, most_likely_hours: val } })
            }
          />
        </td>
        <td className="py-3 px-2">
          <HoursInput
            value={deliverable.estimate.pessimistic_hours}
            onChange={(val) =>
              onUpdate({ estimate: { ...deliverable.estimate, pessimistic_hours: val } })
            }
          />
        </td>
        <td className="py-3 px-2 text-center font-medium text-blue-700">
          {deliverable.estimate.expected_hours}
        </td>
        <td className="py-3 px-2 text-right">
          <button
            onClick={onEndEdit}
            className="p-1 text-green-600 hover:bg-green-100 rounded transition-colors"
            title="Done"
          >
            <Check className="h-4 w-4" />
          </button>
        </td>
      </tr>
    );
  }

  return (
    <tr
      className="border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer group"
      onDoubleClick={onStartEdit}
    >
      <td className="py-3 px-2">
        <GripVertical className="h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100 cursor-grab transition-opacity" />
      </td>
      <td className="py-3 px-2">
        <div className="font-medium text-gray-900">{deliverable.name}</div>
        <div className="text-xs text-gray-500">{deliverable.description}</div>
      </td>
      <td className="py-3 px-2 text-center text-gray-600">
        {deliverable.estimate.optimistic_hours}
      </td>
      <td className="py-3 px-2 text-center text-gray-600">
        {deliverable.estimate.most_likely_hours}
      </td>
      <td className="py-3 px-2 text-center text-gray-600">
        {deliverable.estimate.pessimistic_hours}
      </td>
      <td className="py-3 px-2 text-center font-medium text-gray-900">
        {deliverable.estimate.expected_hours}
      </td>
      <td className="py-3 px-2 text-right">
        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onStartEdit}
            className="p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
            title="Edit"
          >
            <Edit2 className="h-4 w-4" />
          </button>
          <button
            onClick={onRemove}
            className="p-1 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
            title="Remove"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
  );
};

/**
 * Hours input component
 */
interface HoursInputProps {
  value: number;
  onChange: (value: number) => void;
}

const HoursInput: React.FC<HoursInputProps> = ({ value, onChange }) => {
  return (
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)}
      min={0}
      className="w-16 px-2 py-1 text-sm text-center border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
    />
  );
};

/**
 * Assumption row component
 */
interface AssumptionRowProps {
  value: string;
  onChange: (value: string) => void;
  onRemove: () => void;
}

const AssumptionRow: React.FC<AssumptionRowProps> = ({ value, onChange, onRemove }) => {
  return (
    <div className="flex items-start gap-2 group">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        placeholder="Enter assumption..."
      />
      <button
        onClick={onRemove}
        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
        title="Remove"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
};

/**
 * TipTap Rich Text Editor component
 */
interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({
  content,
  onChange,
  placeholder: _placeholder,
}) => {
  const editor = useEditor({
    extensions: [StarterKit],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          'prose prose-sm max-w-none min-h-[100px] px-4 py-3 focus:outline-none',
      },
    },
  });

  if (!editor) {
    return null;
  }

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={cn(
            'p-1.5 rounded hover:bg-gray-200 transition-colors',
            editor.isActive('bold') && 'bg-gray-200'
          )}
          title="Bold"
        >
          <Bold className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={cn(
            'p-1.5 rounded hover:bg-gray-200 transition-colors',
            editor.isActive('italic') && 'bg-gray-200'
          )}
          title="Italic"
        >
          <Italic className="h-4 w-4" />
        </button>
        <div className="w-px h-5 bg-gray-300 mx-1" />
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={cn(
            'p-1.5 rounded hover:bg-gray-200 transition-colors',
            editor.isActive('bulletList') && 'bg-gray-200'
          )}
          title="Bullet List"
        >
          <List className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={cn(
            'p-1.5 rounded hover:bg-gray-200 transition-colors',
            editor.isActive('orderedList') && 'bg-gray-200'
          )}
          title="Numbered List"
        >
          <ListOrdered className="h-4 w-4" />
        </button>
        <div className="w-px h-5 bg-gray-300 mx-1" />
        <button
          type="button"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          className="p-1.5 rounded hover:bg-gray-200 transition-colors disabled:opacity-50"
          title="Undo"
        >
          <Undo className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className="p-1.5 rounded hover:bg-gray-200 transition-colors disabled:opacity-50"
          title="Redo"
        >
          <Redo className="h-4 w-4" />
        </button>
      </div>

      {/* Editor Content */}
      <EditorContent editor={editor} />
    </div>
  );
};

export default QuoteEditor;
