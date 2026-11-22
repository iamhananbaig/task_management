import { useSearchParams } from "react-router-dom"

/** Opens a task in the page's TaskSheet (?task=<id>), keeping the other query params. */
export function useOpenTask() {
  const [params, setParams] = useSearchParams()
  return (taskId: number) => {
    const next = new URLSearchParams(params)
    next.set("task", String(taskId))
    setParams(next)
  }
}
