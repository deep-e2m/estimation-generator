/**
 * Document List Component
 * Displays a list of documents for a project with options to create/open/delete
 */

import React, { useState, useEffect } from 'react';
import {
  FileText,
  Plus,
  Trash2,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { documentsService, type Document, type DocumentCreate } from '@/services/documents.service';
import { Button } from '@/components/ui/button';

interface DocumentListProps {
  projectId: string;
  onOpenDocument: (documentId: string) => void;
}

export function DocumentList({ projectId, onOpenDocument }: DocumentListProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newDocTitle, setNewDocTitle] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedType, setSelectedType] = useState<DocumentCreate['document_type']>('quote');

  // Load documents
  useEffect(() => {
    loadDocuments();
  }, [projectId]);

  const loadDocuments = async () => {
    try {
      setIsLoading(true);
      const docs = await documentsService.list(projectId);
      setDocuments(docs);
    } catch (error) {
      console.error('Failed to load documents:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateDocument = async () => {
    if (!newDocTitle.trim()) return;

    try {
      setIsCreating(true);
      const doc = await documentsService.create(projectId, {
        title: newDocTitle.trim(),
        document_type: selectedType,
        content: { html: '<p>Start writing your document...</p>' },
      });
      setDocuments([doc, ...documents]);
      setShowCreateModal(false);
      setNewDocTitle('');
      onOpenDocument(doc.id);
    } catch (error) {
      console.error('Failed to create document:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;

    try {
      await documentsService.delete(projectId, docId);
      setDocuments(documents.filter((d) => d.id !== docId));
    } catch (error) {
      console.error('Failed to delete document:', error);
    }
  };

  const getDocTypeIcon = (type: string) => {
    switch (type) {
      case 'quote':
        return '💰';
      case 'proposal':
        return '📋';
      case 'requirements':
        return '📝';
      case 'notes':
        return '🗒️';
      default:
        return '📄';
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Documents</h3>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Document
        </Button>
      </div>

      {/* Document Grid */}
      {documents.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h4 className="text-lg font-medium text-gray-900 mb-2">No documents yet</h4>
          <p className="text-gray-500 mb-4">
            Create your first document to start writing proposals and quotes.
          </p>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Document
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="group relative bg-white border border-gray-200 rounded-lg p-4 hover:border-primary-300 hover:shadow-md transition-all cursor-pointer"
              onClick={() => onOpenDocument(doc.id)}
            >
              {/* Document Preview */}
              <div className="aspect-[4/3] bg-gray-50 rounded-lg mb-3 flex items-center justify-center overflow-hidden">
                <div className="text-4xl">{getDocTypeIcon(doc.document_type)}</div>
              </div>

              {/* Document Info */}
              <div className="space-y-1">
                <h4 className="font-medium text-gray-900 truncate group-hover:text-primary-600">
                  {doc.title}
                </h4>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <span className="capitalize">{doc.document_type}</span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDate(doc.updated_at)}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteDocument(doc.id);
                  }}
                  className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"
                  title="Delete document"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Document Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-4">Create New Document</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Document Title
                </label>
                <input
                  type="text"
                  value={newDocTitle}
                  onChange={(e) => setNewDocTitle(e.target.value)}
                  placeholder="Enter document title..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Document Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'quote', label: 'Quote', icon: '💰' },
                    { value: 'proposal', label: 'Proposal', icon: '📋' },
                    { value: 'requirements', label: 'Requirements', icon: '📝' },
                    { value: 'notes', label: 'Notes', icon: '🗒️' },
                  ].map((type) => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setSelectedType(type.value as DocumentCreate['document_type'])}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2 rounded-lg border transition-all',
                        selectedType === type.value
                          ? 'border-primary-500 bg-primary-50 text-primary-700'
                          : 'border-gray-200 hover:border-gray-300'
                      )}
                    >
                      <span>{type.icon}</span>
                      <span>{type.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateModal(false);
                  setNewDocTitle('');
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateDocument}
                disabled={!newDocTitle.trim() || isCreating}
                isLoading={isCreating}
              >
                Create
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DocumentList;
