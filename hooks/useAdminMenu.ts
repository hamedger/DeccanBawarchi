import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchAdminMenuItems } from '../lib/admin/menuAdmin'

export function useAdminMenu() {
  return useQuery({
    queryKey: ['adminMenu'],
    queryFn: fetchAdminMenuItems,
    staleTime: 30 * 1000,
  })
}

export function useInvalidateAdminMenu() {
  const client = useQueryClient()
  return () => {
    client.invalidateQueries({ queryKey: ['adminMenu'] })
    client.invalidateQueries({ queryKey: ['menu'] })
  }
}
