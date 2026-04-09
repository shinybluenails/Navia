import { useState, useCallback, useEffect } from 'react'
import type { Todo, TodoStatus, TodoPriority } from '../../../preload/index.d'

export type { Todo, TodoStatus, TodoPriority }

export function useTodos(): {
  todos: Todo[]
  loading: boolean
  createTodo: (data: Omit<Todo, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Todo>
  updateTodo: (id: string, changes: Partial<Omit<Todo, 'id' | 'createdAt'>>) => Promise<Todo>
  deleteTodo: (id: string) => Promise<void>
  refresh: () => Promise<void>
} {
  const [todos, setTodos] = useState<Todo[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const list = await window.todos.list()
    setTodos(list)
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
    // Re-fetch whenever the main process mutates todos (e.g. via AI tool calls)
    const cleanup = window.todos.onChanged(refresh)
    return cleanup
  }, [refresh])

  const createTodo = useCallback(
    async (data: Omit<Todo, 'id' | 'createdAt' | 'updatedAt'>) => {
      const todo = await window.todos.create(data)
      setTodos((prev) => [...prev, todo])
      return todo
    },
    []
  )

  const updateTodo = useCallback(
    async (id: string, changes: Partial<Omit<Todo, 'id' | 'createdAt'>>) => {
      const updated = await window.todos.update(id, changes)
      setTodos((prev) => prev.map((t) => (t.id === id ? updated : t)))
      return updated
    },
    []
  )

  const deleteTodo = useCallback(async (id: string) => {
    await window.todos.delete(id)
    setTodos((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return { todos, loading, createTodo, updateTodo, deleteTodo, refresh }
}
