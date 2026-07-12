'use server'
import { cookies } from 'next/headers'
import { ADMIN_COOKIE, verifyAdminCookie } from '@/lib/admin-auth'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { TIER_GROUPS } from '@/lib/maker'

export async function saveTierSubmission(payload: Record<string,string[]>) {
  if (process.env.VERCEL_ENV !== 'preview') return {ok:false,message:'Preview環境でのみ保存できます'}
  if (!verifyAdminCookie((await cookies()).get(ADMIN_COOKIE)?.value)) return {ok:false,message:'管理者認証が必要です'}
  const supabase = await createClient(); const {data:{user}} = await supabase.auth.getUser()
  if (!user) return {ok:false,message:'ログインが必要です'}
  const allowed = new Set(TIER_GROUPS.map(g=>g.key)), seen = new Set<string>()
  const items = Object.entries(payload).flatMap(([group,ids]) => allowed.has(group) ? ids.map((card_id,position)=>({card_id,group_key:group,position})) : [])
  if (items.some(i=>seen.has(i.card_id)||!seen.add(i.card_id))) return {ok:false,message:'同じカードは複数配置できません'}
  const admin=createAdminClient(); const {data:project}=await admin.from('maker_projects').select('id').eq('slug','dm26-ex2-charisma-best-tier').single()
  if(!project) return {ok:false,message:'企画が未準備です'}
  const {error}=await admin.rpc('save_maker_submission',{p_project_id:project.id,p_user_id:user.id,p_items:items})
  if(error) return {ok:false,message:error.message}
  return {ok:true,message:'Tier表を上書き保存しました'}
}
