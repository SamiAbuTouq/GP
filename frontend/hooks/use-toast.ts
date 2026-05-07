'use client'

import * as React from 'react'
import { toast as sonnerToast } from 'sonner'

import type { ToastActionElement, ToastProps } from '@/components/ui/toast'

const TOAST_LIMIT = 1
const TOAST_REMOVE_DELAY = 1000000

type ToasterToast = ToastProps & {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: ToastActionElement
}

const actionTypes = {
  ADD_TOAST: 'ADD_TOAST',
  UPDATE_TOAST: 'UPDATE_TOAST',
  DISMISS_TOAST: 'DISMISS_TOAST',
  REMOVE_TOAST: 'REMOVE_TOAST',
} as const

let count = 0

/** Stable string ids shared by legacy reducer state and Sonner (avoid collisions with Sonner’s numeric ids). */
function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER
  return `client-toast-${count}`
}

type ActionType = typeof actionTypes

type Action =
  | {
      type: ActionType['ADD_TOAST']
      toast: ToasterToast
    }
  | {
      type: ActionType['UPDATE_TOAST']
      toast: Partial<ToasterToast>
    }
  | {
      type: ActionType['DISMISS_TOAST']
      toastId?: ToasterToast['id']
    }
  | {
      type: ActionType['REMOVE_TOAST']
      toastId?: ToasterToast['id']
    }

interface State {
  toasts: ToasterToast[]
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

const addToRemoveQueue = (toastId: string) => {
  if (toastTimeouts.has(toastId)) {
    return
  }

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId)
    dispatch({
      type: 'REMOVE_TOAST',
      toastId: toastId,
    })
  }, TOAST_REMOVE_DELAY)
  toastTimeouts.set(toastId, timeout)
}

export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'ADD_TOAST':
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      }

    case 'UPDATE_TOAST':
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t,
        ),
      }

    case 'DISMISS_TOAST': {
      const { toastId } = action

      if (toastId) {
        addToRemoveQueue(toastId)
      } else {
        state.toasts.forEach((toast) => {
          addToRemoveQueue(toast.id)
        })
      }

      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined
            ? {
                ...t,
                open: false,
              }
            : t,
        ),
      }
    }
    case 'REMOVE_TOAST':
      if (action.toastId === undefined) {
        return {
          ...state,
          toasts: [],
        }
      }
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      }
  }
}

const listeners: Array<(state: State) => void> = []

let memoryState: State = { toasts: [] }

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action)
  listeners.forEach((listener) => {
    listener(memoryState)
  })
}

type Toast = Omit<ToasterToast, 'id'>

function nodeToText(n: React.ReactNode): string | undefined {
  if (n == null || typeof n === 'boolean') return undefined
  if (typeof n === 'string' || typeof n === 'number') return String(n)
  return undefined
}

/**
 * Shows a Sonner toast (success / error / warning) with project duration rules.
 * Legacy Radix toast state is still updated for callers that read `useToast().toasts`.
 */
function toast({ title, description, variant, ...props }: Toast) {
  const id = genId()
  const titleText = nodeToText(title) ?? 'Notice'
  const descText = nodeToText(description)

  const update = (p: ToasterToast) =>
    dispatch({
      type: 'UPDATE_TOAST',
      toast: { ...p, id },
    })

  /** Keep legacy reducer in sync whenever this Sonner toast is closed (X, swipe, programmatic dismiss). */
  const dismissLegacyForThisToast = () => dispatch({ type: 'DISMISS_TOAST', toastId: id })

  dispatch({
    type: 'ADD_TOAST',
    toast: {
      ...props,
      title,
      description,
      id,
      open: true,
      onOpenChange: (open) => {
        if (!open) dismissLegacyForThisToast()
      },
    },
  })

  const sonnerBase = {
    id,
    description: descText,
    closeButton: true,
    onDismiss: dismissLegacyForThisToast,
  } satisfies Parameters<typeof sonnerToast.success>[1]

  if (variant === 'destructive') {
    sonnerToast.error(titleText, {
      ...sonnerBase,
      duration: Number.POSITIVE_INFINITY,
    })
  } else {
    sonnerToast.success(titleText, {
      ...sonnerBase,
      duration: 3000,
    })
  }

  return {
    id,
    dismiss: () => {
      sonnerToast.dismiss(id)
      dismissLegacyForThisToast()
    },
    update,
  }
}

function useToast() {
  const [state, setState] = React.useState<State>(memoryState)

  React.useEffect(() => {
    listeners.push(setState)
    return () => {
      const index = listeners.indexOf(setState)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }, [state])

  return {
    ...state,
    toast,
    dismiss: (toastId?: string) => {
      if (toastId === undefined) {
        sonnerToast.dismiss()
      } else {
        sonnerToast.dismiss(toastId)
      }
      dispatch({ type: 'DISMISS_TOAST', toastId })
    },
  }
}

export { useToast, toast }
