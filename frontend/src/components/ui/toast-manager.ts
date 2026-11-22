import { Toast as ToastPrimitive } from "@base-ui/react/toast"

/** The app-wide toast manager (used by <Toaster> and `@/lib/toast`). */
export const toast = ToastPrimitive.createToastManager()
export const createToastManager = ToastPrimitive.createToastManager
export const useToastManager = ToastPrimitive.useToastManager
