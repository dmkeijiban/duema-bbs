import { createClient } from '@/lib/supabase-server'

export async function getSetting(key: string, fallback = ''): Promise<string> {
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', key)
      .single()
    return data?.value ?? fallback
  } catch {
    return fallback
  }
}

export async function getAllSettings(): Promise<Record<string, string>> {
  try {
    const supabase = await createClient()
    const { data } = await supabase.from('site_settings').select('key, value')
    if (!data) return {}
    return Object.fromEntries(data.map(r => [r.key, r.value]))
  } catch {
    return {}
  }
}
