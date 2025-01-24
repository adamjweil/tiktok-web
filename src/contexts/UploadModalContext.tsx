import { createContext, useContext, useState, ReactNode } from 'react';
import UploadModal from '../components/UploadModal';

interface UploadModalContextType {
  openUploadModal: () => void;
  closeUploadModal: () => void;
}

const UploadModalContext = createContext<UploadModalContextType | undefined>(undefined);

export function UploadModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const openUploadModal = () => setIsOpen(true);
  const closeUploadModal = () => setIsOpen(false);

  return (
    <UploadModalContext.Provider value={{ openUploadModal, closeUploadModal }}>
      {children}
      <UploadModal
        isOpen={isOpen}
        onClose={closeUploadModal}
        onSuccess={() => {
          closeUploadModal();
          // You might want to add a callback here to refresh the videos
        }}
      />
    </UploadModalContext.Provider>
  );
}

export function useUploadModal() {
  const context = useContext(UploadModalContext);
  if (context === undefined) {
    throw new Error('useUploadModal must be used within a UploadModalProvider');
  }
  return context;
}
