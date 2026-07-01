export interface Category {
  id: number
  name: string
  slug: string
  description: string | null
  color: string
  sort_order: number
}

export interface Thread {
  id: number
  title: string
  body: string
  category_id: number | null
  author_name: string
  user_id?: string | null
  image_url: string | null
  view_count: number
  post_count: number
  is_archived: boolean
  comment_locked?: boolean
  created_at: string
  last_posted_at: string
  categories?: Category | null
}

export interface Post {
  id: number
  thread_id: number
  post_number: number
  body: string
  author_name: string
  user_id?: string | null
  image_url: string | null
  ip_hash?: string | null
  created_at: string
  is_deleted?: boolean | null
  deleted_by?: string | null
  deleted_at?: string | null
}

export interface PublicAuthorProfile {
  id: string
  display_name: string
  profile_slug: string
  avatar_url: string | null
}

export interface Favorite {
  id: number
  session_id: string
  thread_id: number
  created_at: string
}
