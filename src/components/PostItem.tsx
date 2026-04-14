import { Post } from '@/types'
import { formatDateTime } from '@/lib/utils'
import Image from 'next/image'

interface Props {
  post: Post
  isOp?: boolean
}

export function PostItem({ post, isOp }: Props) {
  return (
    <div
      id={`post-${post.post_number}`}
      className="border-b border-gray-200 dark:border-gray-700 py-4 first:pt-0 last:border-0"
    >
      <div className="flex items-center gap-3 mb-2 text-sm flex-wrap">
        <span className="font-bold text-indigo-600 dark:text-indigo-400">
          {post.post_number}
        </span>
        {isOp && (
          <span className="px-1.5 py-0.5 bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 text-xs rounded font-bold">
            OP
          </span>
        )}
        <span className="font-medium text-gray-700 dark:text-gray-200">
          {post.author_name}
        </span>
        <span className="text-gray-400 dark:text-gray-500 text-xs">
          {formatDateTime(post.created_at)}
        </span>
        <a
          href={`#post-${post.post_number}`}
          className="text-gray-400 dark:text-gray-500 text-xs hover:text-indigo-500 transition-colors"
        >
          #{post.post_number}
        </a>
      </div>
      <div className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words text-sm leading-relaxed">
        {post.body}
      </div>
      {post.image_url && (
        <div className="mt-3">
          <a href={post.image_url} target="_blank" rel="noopener noreferrer">
            <img
              src={post.image_url}
              alt="添付画像"
              className="max-h-80 max-w-full rounded-lg border border-gray-200 dark:border-gray-600 object-contain hover:opacity-90 transition-opacity cursor-zoom-in"
            />
          </a>
        </div>
      )}
    </div>
  )
}
