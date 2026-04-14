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
  image_url: string | null
  view_count: number
  post_count: number
  is_archived: boolean
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
  image_url: string | null
  created_at: string
}

export interface Favorite {
  id: number
  session_id: string
  thread_id: number
  created_at: string
}
