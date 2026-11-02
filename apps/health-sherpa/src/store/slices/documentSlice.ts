import { StateCreator } from 'zustand';
import { HealthDocument, DocumentProcessingStatus } from '@/types/core';

export interface DocumentSlice {
  // State
  activeDocument: HealthDocument | null;
  uploadedDocuments: HealthDocument[];
  processingStatus: DocumentProcessingStatus;
  isUploading: boolean;
  uploadProgress: number;
  error: string | null;

  // Actions
  uploadDocument: (file: File) => Promise<string>;
  setActiveDocument: (documentId: string) => void;
  updateDocument: (
    documentId: string,
    updates: Partial<HealthDocument>
  ) => void;
  removeDocument: (documentId: string) => void;
  setProcessingStatus: (status: DocumentProcessingStatus) => void;
  setUploadProgress: (progress: number) => void;
  setUploading: (uploading: boolean) => void;
  setError: (error: string | null) => void;
  clearActiveDocument: () => void;

  // Document processing
  deidentifyDocument: (documentId: string) => Promise<void>;
  generateLineNumbers: (documentId: string) => void;
  markAnalysisComplete: (documentId: string) => void;
}

export const createDocumentSlice: StateCreator<
  DocumentSlice,
  [],
  [],
  DocumentSlice
> = (set, get) => ({
  // Initial state
  activeDocument: null,
  uploadedDocuments: [],
  processingStatus: 'uploaded',
  isUploading: false,
  uploadProgress: 0,
  error: null,

  // Actions
  uploadDocument: async (file: File) => {
    const documentId = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    set({
      isUploading: true,
      uploadProgress: 0,
      error: null,
      processingStatus: 'uploaded',
    });

    try {
      // Simulate file reading (in real implementation, this would handle PDF/text parsing)
      const content = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          set({ uploadProgress: 50 });
          resolve((e.target?.result as string) || '');
        };
        reader.onerror = reject;
        reader.readAsText(file);
      });

      const newDocument: HealthDocument = {
        id: documentId,
        filename: file.name,
        content: content,
        lineNumberedContent: '', // Will be generated later
        uploadedAt: new Date().toISOString(),
        deidentified: false,
        analysisComplete: false,
      };

      set((state) => ({
        uploadedDocuments: [...state.uploadedDocuments, newDocument],
        activeDocument: newDocument,
        uploadProgress: 75,
      }));

      // Auto-generate line numbers
      get().generateLineNumbers(documentId);

      // Set upload complete but don't auto-deidentify yet (privacy modal will handle this)
      set({
        uploadProgress: 100,
        isUploading: false,
        processingStatus: 'deidentified', // Ready for deidentification
      });

      return documentId;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Upload failed',
        isUploading: false,
        uploadProgress: 0,
      });
      throw error;
    }
  },

  setActiveDocument: (documentId: string) => {
    const document = get().uploadedDocuments.find(
      (doc) => doc.id === documentId
    );
    if (document) {
      set({ activeDocument: document });
    }
  },

  updateDocument: (documentId: string, updates: Partial<HealthDocument>) => {
    set((state) => {
      const updatedDocuments = state.uploadedDocuments.map((doc) =>
        doc.id === documentId ? { ...doc, ...updates } : doc
      );

      return {
        uploadedDocuments: updatedDocuments,
        activeDocument:
          state.activeDocument?.id === documentId
            ? { ...state.activeDocument, ...updates }
            : state.activeDocument,
      };
    });
  },

  removeDocument: (documentId: string) => {
    set((state) => ({
      uploadedDocuments: state.uploadedDocuments.filter(
        (doc) => doc.id !== documentId
      ),
      activeDocument:
        state.activeDocument?.id === documentId ? null : state.activeDocument,
    }));
  },

  setProcessingStatus: (status: DocumentProcessingStatus) => {
    set({ processingStatus: status });
  },

  setUploadProgress: (progress: number) => {
    set({ uploadProgress: Math.max(0, Math.min(100, progress)) });
  },

  setUploading: (uploading: boolean) => {
    set({ isUploading: uploading });
  },

  setError: (error: string | null) => {
    set({ error });
  },

  clearActiveDocument: () => {
    set({ activeDocument: null });
  },

  // Document processing methods
  deidentifyDocument: async (documentId: string) => {
    const document = get().uploadedDocuments.find(
      (doc) => doc.id === documentId
    );
    if (!document) return;

    set({ processingStatus: 'deidentified' });

    try {
      // Simulate the de-identification process
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Apply automatic de-identification patterns
      let deidentifiedContent = document.content;

      // Common PHI patterns to redact
      const phiPatterns = [
        { pattern: /\b\d{3}-\d{2}-\d{4}\b/g, label: 'SSN' },
        { pattern: /\b\d{3}-\d{3}-\d{4}\b/g, label: 'Phone' },
        {
          pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
          label: 'Email',
        },
        { pattern: /\b\d{1,2}\/\d{1,2}\/\d{4}\b/g, label: 'Dates' },
        { pattern: /\b\d{1,2}-\d{1,2}-\d{4}\b/g, label: 'Dates' },
        { pattern: /MRN:\s*\w+/g, label: 'MRN' },
        { pattern: /DOB:\s*[^\s,\n]+/g, label: 'DOB' },
        { pattern: /Phone:\s*[^\s,\n]+/g, label: 'Phone' },
        { pattern: /Patient:\s*[^\s,\n]+/g, label: 'Patient Name' },
        // Add more sophisticated patterns as needed
      ];

      phiPatterns.forEach(({ pattern }) => {
        deidentifiedContent = deidentifiedContent.replace(
          pattern,
          '[REDACTED]'
        );
      });

      get().updateDocument(documentId, {
        content: deidentifiedContent,
        deidentified: true,
        processedAt: new Date().toISOString(),
      });

      set({ processingStatus: 'analyzed' });
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : 'De-identification failed',
        processingStatus: 'uploaded',
      });
      throw error;
    }
  },

  generateLineNumbers: (documentId: string) => {
    const document = get().uploadedDocuments.find(
      (doc) => doc.id === documentId
    );
    if (!document) return;

    const lines = document.content.split('\n');
    const lineNumberedContent = lines
      .map(
        (line, index) => `${(index + 1).toString().padStart(3, ' ')}: ${line}`
      )
      .join('\n');

    get().updateDocument(documentId, {
      lineNumberedContent,
    });
  },

  markAnalysisComplete: (documentId: string) => {
    get().updateDocument(documentId, {
      analysisComplete: true,
      processedAt: new Date().toISOString(),
    });
    set({ processingStatus: 'ready' });
  },
});
