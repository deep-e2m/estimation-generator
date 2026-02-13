import * as React from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Dialog Component
 * 
 * Uses centralized CSS classes from styles/components.css
 */

interface DialogContextType {
  open: boolean
  setOpen: (open: boolean) => void
}

const DialogContext = React.createContext<DialogContextType | null>(null)

function useDialog() {
  const context = React.useContext(DialogContext)
  if (!context) {
    throw new Error('Dialog components must be used within a Dialog')
  }
  return context
}

interface DialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}

function Dialog({ open: controlledOpen, onOpenChange, children }: DialogProps) {
  const [internalOpen, setInternalOpen] = React.useState(false)
  
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen
  const setOpen = onOpenChange || setInternalOpen

  return (
    <DialogContext.Provider value={{ open, setOpen }}>
      {children}
    </DialogContext.Provider>
  )
}

interface DialogTriggerProps {
  children: React.ReactNode
  asChild?: boolean
}

function DialogTrigger({ children, asChild }: DialogTriggerProps) {
  const { setOpen } = useDialog()
  
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<{ onClick?: () => void }>, {
      onClick: () => setOpen(true),
    })
  }

  return (
    <button type="button" onClick={() => setOpen(true)}>
      {children}
    </button>
  )
}

interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

function DialogContent({ className, children, ...props }: DialogContentProps) {
  const { open, setOpen } = useDialog()

  // Handle escape key
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    if (open) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [open, setOpen])

  if (!open) return null

  return (
    <>
      {/* Overlay */}
      <div 
        className="dialog-overlay" 
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />
      
      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        className={cn('dialog', className)}
        {...props}
      >
        {children}
        
        {/* Close button */}
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="btn-ghost btn-icon-sm"
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
          }}
          aria-label="Close dialog"
        >
          <X style={{ width: 20, height: 20 }} />
        </button>
      </div>
    </>
  )
}

function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('dialog-header', className)} {...props} />
}

function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn('dialog-title', className)} {...props} />
}

function DialogDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('dialog-description', className)} {...props} />
}

function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('dialog-footer', className)} {...props} />
}

export {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
}