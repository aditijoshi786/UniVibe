import { useEffect, useCallback, useState, useRef } from 'react'
import { X, ChevronLeft, ChevronRight, Download, Heart, Tag, MessageCircle, Bookmark, Share2, Send, AtSign } from 'lucide-react'
import { format } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { downloadWithWatermark, type WatermarkOptions } from '../lib/watermark'
import toast from 'react-hot-toast'

type MediaItem = {
  id: string; url: string; thumbnail_url: string | null
  type: string; title: string | null; tags: string[]
  caption?: string | null
  uploaded_by: string; like_count: number; created_at: string
  event_id: string; album_id: string
  profiles: { full_name: string; avatar_url: string | null } | null
}

type Comment = {
  id: string; content: string; created_at: string
  profiles: { full_name: string } | null
}

type UserProfile = {
  id: string; full_name: string
}

type Props = {
  media: MediaItem[]
  index: number
  onClose: () => void
  onIndexChange: (i: number) => void
  eventName?: string
  clubName?: string
}

function mentionToken(fullName: string) {
  return fullName.split(' ')[0]
}

function CommentText({ text }: { text: string }) {
  const parts = text.split(/(@\w+)/g)
  return (
    <p className="text-xs text-white/60 break-words">
      {parts.map((part, i) =>
        part.startsWith('@')
          ? <span key={i} className="text-college-amber font-medium">{part}</span>
          : part
      )}
    </p>
  )
}

export default function MediaLightbox({ media, index, onClose, onIndexChange, eventName = '', clubName = '' }: Props) {
  const { profile } = useAuth()
  const item = media[index]

  const [liked,       setLiked]       = useState(false)
  const [likeCount,   setLikeCount]   = useState(item?.like_count ?? 0)
  const [favourited,  setFavourited]  = useState(false)
  const [comments,    setComments]    = useState<Comment[]>([])
  const [commentText, setCommentText] = useState('')
  const [posting,     setPosting]     = useState(false)
  const [activeTab,   setActiveTab]   = useState<'info' | 'comments'>('info')
  const [localTags,     setLocalTags]     = useState<string[]>(item?.tags ?? [])
  const [addingTag,     setAddingTag]     = useState(false)
  const [newTag,        setNewTag]        = useState('')
  const [localCaption,   setLocalCaption]   = useState<string | null>(item?.caption ?? null)
  const [editingCaption, setEditingCaption] = useState(false)
  const [captionDraft,   setCaptionDraft]   = useState('')

  const [clubMemberIds, setClubMemberIds] = useState<string[]>([])
  const [allProfiles,     setAllProfiles]     = useState<UserProfile[]>([])
  const [mentionDropdown, setMentionDropdown] = useState<UserProfile[]>([])
  const [, setMentionQuery] = useState<string | null>(null)

  const commentInputRef  = useRef<HTMLInputElement>(null)
  const commentsEndRef   = useRef<HTMLDivElement>(null)
  const skipLikeRefresh = useRef(false)

  const prev = useCallback(() => onIndexChange(Math.max(0, index - 1)), [index, onIndexChange])
  const next = useCallback(() => onIndexChange(Math.min(media.length - 1, index + 1)), [index, media.length, onIndexChange])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { if (mentionDropdown.length > 0) setMentionDropdown([]); else onClose() }
      if (e.key === 'ArrowLeft'  && mentionDropdown.length === 0) prev()
      if (e.key === 'ArrowRight' && mentionDropdown.length === 0) next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, prev, next, mentionDropdown])

  useEffect(() => {
    supabase.from('profiles').select('id, full_name').then(({ data }) => {
      if (data) setAllProfiles(data as UserProfile[])
    })
  }, [])

  useEffect(() => {
    if (!item || !profile) return
    setComments([])
    setCommentText('')
    setMentionDropdown([])
    setClubMemberIds([])
    setLocalTags(item.tags ?? [])
    setAddingTag(false)
    setNewTag('')
    setLocalCaption(item.caption ?? null)
    setEditingCaption(false)
    setCaptionDraft('')

    async function load() {
      const [likeRes, favRes, commentRes, mediaRes, eventRes] = await Promise.all([
        supabase.from('likes').select('id').eq('media_id', item.id).eq('user_id', profile!.id).single(),
        supabase.from('favourites').select('id').eq('media_id', item.id).eq('user_id', profile!.id).single(),
        supabase.from('comments')
          .select('id, content, created_at, profiles(full_name)')
          .eq('media_id', item.id)
          .order('created_at', { ascending: true }),
        supabase.from('media').select('like_count').eq('id', item.id).single(),
        supabase.from('events').select('club_id').eq('id', item.event_id).single(),
      ])

      setLiked(!!likeRes.data)
      setFavourited(!!favRes.data)
      setComments((commentRes.data ?? []) as unknown as Comment[])
      if (mediaRes.data) setLikeCount(mediaRes.data.like_count)

      const clubId = eventRes.data?.club_id
      if (clubId) {
        const { data: memberships } = await supabase
          .from('club_memberships')
          .select('user_id')
          .eq('club_id', clubId)
        if (memberships) {
          setClubMemberIds(memberships.map((m: { user_id: string }) => m.user_id))
        }
      }
    }
    load()
  }, [item?.id, profile])

  // Scroll to bottom when comments update
  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [comments])

  // Real-time like_count sync — fetch fresh count when any like row changes for this photo
  useEffect(() => {
    if (!item) return
    const mediaId = item.id
    async function refreshCount() {
      const { data } = await supabase.from('media').select('like_count').eq('id', mediaId).single()
      if (data && typeof data.like_count === 'number') setLikeCount(data.like_count)
    }
    const channel = supabase
      .channel(`likes_rt:${mediaId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'likes', filter: `media_id=eq.${mediaId}` }, refreshCount)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'likes', filter: `media_id=eq.${mediaId}` }, refreshCount)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [item?.id])

  // Real-time comments subscription
  useEffect(() => {
    if (!item) return
    const channel = supabase
      .channel(`comments:${item.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comments', filter: `media_id=eq.${item.id}` },
        async (payload) => {
          const { data } = await supabase
            .from('comments')
            .select('id, content, created_at, profiles(full_name)')
            .eq('id', payload.new.id)
            .single()
          if (data) setComments(prev => [...prev, data as unknown as Comment])
        })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [item?.id])

  // Canonical link to the photo — lands on album page and auto-opens that photo
  function photoLink(m: MediaItem) {
    return `/events/${m.event_id}/albums/${m.album_id}?photo=${m.id}`
  }

  // Send a notification — fire and forget
  async function pushNotification(userId: string, type: string, message: string, link: string) {
    if (!userId || userId === profile?.id) return
    await supabase.from('notifications').insert({ user_id: userId, type, message, link })
  }

  // Notify all club members of the event's club (excluding self)
  async function notifyClubMembers(type: string, message: string, link: string) {
    const targets = clubMemberIds.filter(id => id !== profile?.id)
    if (targets.length === 0) return
    const rows = targets.map(id => ({ user_id: id, type, message, link, is_read: false }))
    await supabase.from('notifications').insert(rows)
  }

  async function toggleLike() {
    if (!profile) return

    if (liked) {
      setLiked(false)
      setLikeCount(c => Math.max(0, c - 1))
      // SECURITY DEFINER RPC bypasses RLS so any user can update like_count
      const { data: newCount, error: rpcErr } = await supabase.rpc('decrement_like_count', { p_media_id: item.id })
      if (rpcErr) console.error('decrement_like_count failed:', rpcErr)
      else if (typeof newCount === 'number') setLikeCount(newCount)
      await supabase.from('likes').delete().eq('media_id', item.id).eq('user_id', profile.id)
    } else {
      setLiked(true)
      setLikeCount(c => c + 1)
      const { data: newCount, error: rpcErr } = await supabase.rpc('increment_like_count', { p_media_id: item.id })
      if (rpcErr) console.error('increment_like_count failed:', rpcErr)
      else if (typeof newCount === 'number') setLikeCount(newCount)
      await supabase.from('likes').insert({ media_id: item.id, user_id: profile.id })
      notifyClubMembers('like', `${profile.full_name} liked a photo "${item.title ?? 'Untitled'}"`, photoLink(item))
    }
  }

  async function toggleFavourite() {
    if (!profile) return
    if (favourited) {
      await supabase.from('favourites').delete().eq('media_id', item.id).eq('user_id', profile.id)
      setFavourited(false)
      toast.success('Removed from favourites')
    } else {
      await supabase.from('favourites').insert({ media_id: item.id, user_id: profile.id })
      setFavourited(true)
      toast.success('Saved to favourites')
    }
  }

  // @mention detection as user types
  function handleCommentInput(e: React.ChangeEvent<HTMLInputElement>) {
    const val    = e.target.value
    setCommentText(val)
    const cursor = e.target.selectionStart ?? val.length
    const before = val.slice(0, cursor)
    const match  = before.match(/@(\w*)$/)
    if (match) {
      const query   = match[1].toLowerCase()
      setMentionQuery(query)
      const filtered = allProfiles
        .filter(p => p.id !== profile?.id && mentionToken(p.full_name).toLowerCase().startsWith(query))
        .slice(0, 6)
      setMentionDropdown(filtered)
    } else {
      setMentionQuery(null)
      setMentionDropdown([])
    }
  }

  function insertMention(user: UserProfile) {
    const token  = mentionToken(user.full_name)
    const cursor = commentInputRef.current?.selectionStart ?? commentText.length
    const before = commentText.slice(0, cursor)
    const after  = commentText.slice(cursor)
    setCommentText(before.replace(/@(\w*)$/, `@${token} `) + after)
    setMentionDropdown([])
    setMentionQuery(null)
    commentInputRef.current?.focus()
  }

  async function postComment(e: React.FormEvent) {
    e.preventDefault()
    const text = commentText.trim()
    if (!text || !profile) return
    setPosting(true)
    setMentionDropdown([])

    const { error } = await supabase.from('comments').insert({
      media_id: item.id,
      user_id:  profile.id,
      content:  text,
    })

    if (error) { toast.error('Failed to post comment'); setPosting(false); return }
    setCommentText('')

    // Notify club members of the event's club (like/comment go to club members)
    const link    = photoLink(item)
    const preview = `"${text.slice(0, 60)}${text.length > 60 ? '…' : ''}"`
    notifyClubMembers('comment', `${profile.full_name} commented on a photo: ${preview}`, link)

    // @mentions → notify the tagged person regardless of their role
    const tokens = [...new Set(text.match(/@(\w+)/g) ?? [])]
    for (const token of tokens) {
      const firstName = token.slice(1).toLowerCase()
      const tagged = allProfiles.find(
        p => mentionToken(p.full_name).toLowerCase() === firstName && p.id !== profile.id
      )
      if (tagged) {
        // Mention notification goes to anyone; link points to the exact comment's photo
        pushNotification(tagged.id, 'mention', `${profile.full_name} mentioned you in a comment: ${preview}`, link)
      }
    }

    setPosting(false)
  }

  async function addTag(e: React.FormEvent) {
    e.preventDefault()
    const tag = newTag.trim().toLowerCase().replace(/\s+/g, '-')
    if (!tag || localTags.includes(tag)) { setNewTag(''); setAddingTag(false); return }
    const updated = [...localTags, tag]
    setLocalTags(updated)
    setNewTag('')
    setAddingTag(false)
    await supabase.from('media').update({ tags: updated }).eq('id', item.id)
  }

  async function removeTag(tag: string) {
    const updated = localTags.filter(t => t !== tag)
    setLocalTags(updated)
    await supabase.from('media').update({ tags: updated }).eq('id', item.id)
  }

  async function saveCaption() {
    const trimmed = captionDraft.trim() || null
    const { error } = await supabase.from('media').update({ caption: trimmed }).eq('id', item.id)
    if (error) { toast.error('Failed to save caption'); return }
    setLocalCaption(trimmed)
    setEditingCaption(false)
    toast.success('Caption updated')
  }

  const canEditCaption = profile?.role === 'admin' || profile?.role === 'club_member'

  async function handleDownload() {
    const ext      = item.url.split('.').pop()?.split('?')[0] ?? 'jpg'
    const filename = `${item.title ?? 'media'}.${ext}`
    const isVideo  = item.type === 'video'

    const wmOpts: WatermarkOptions = {
      clubName,
      eventName,
      uploaderName : item.profiles?.full_name ?? '',
      uploaderRole : profile?.role ?? 'student',
      takenAt      : item.created_at,
    }

    try {
      await downloadWithWatermark(item.url, filename, wmOpts, isVideo)
    } catch {
      window.open(item.url, '_blank')
    }
  }

  if (!item) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm">
      <button onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors z-10">
        <X size={20} />
      </button>

      <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/40 text-white text-sm px-3 py-1 rounded-full backdrop-blur-sm">
        {index + 1} / {media.length}
      </div>

      {index > 0 && (
        <button onClick={prev}
          className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors z-10">
          <ChevronLeft size={24} />
        </button>
      )}
      {index < media.length - 1 && (
        <button onClick={next}
          className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors z-10">
          <ChevronRight size={24} />
        </button>
      )}

      <div className="flex flex-col lg:flex-row w-full h-full max-w-6xl mx-auto p-16 gap-4 items-center justify-center">
        {/* Media */}
        <div className="flex-1 flex items-center justify-center min-h-0">
          {item.type === 'video' ? (
            <video src={item.url} controls className="max-h-[70vh] max-w-full rounded-xl" />
          ) : (
            <img src={item.url} alt={item.title ?? ''}
              className="max-h-[70vh] max-w-full object-contain rounded-xl shadow-2xl" />
          )}
        </div>

        {/* Sidebar */}
        <div className="lg:w-72 shrink-0 flex flex-col bg-white/5 backdrop-blur-sm rounded-xl text-white overflow-hidden" style={{ maxHeight: '70vh' }}>

          {/* Action bar */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <div className="flex items-center gap-1">
              <button onClick={toggleLike}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${liked ? 'bg-red-500 text-white' : 'hover:bg-white/10 text-white/70'}`}>
                <Heart size={13} fill={liked ? 'currentColor' : 'none'} />
                {likeCount}
              </button>
              <button onClick={() => { setActiveTab('comments'); setTimeout(() => commentInputRef.current?.focus(), 50) }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium hover:bg-white/10 text-white/70 transition-all">
                <MessageCircle size={13} />
                {comments.length}
              </button>
              <button onClick={toggleFavourite}
                className={`p-1.5 rounded-lg text-xs transition-all ${favourited ? 'text-college-amber' : 'hover:bg-white/10 text-white/70'}`}>
                <Bookmark size={13} fill={favourited ? 'currentColor' : 'none'} />
              </button>
              <button onClick={() => { navigator.clipboard.writeText(item.url); toast.success('Link copied!') }}
                className="p-1.5 rounded-lg text-xs hover:bg-white/10 text-white/70 transition-all">
                <Share2 size={13} />
              </button>
            </div>
            <button onClick={handleDownload}
              className="flex items-center gap-1 bg-college-amber hover:bg-college-gold text-white text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors">
              <Download size={12} /> Save
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-white/10 shrink-0">
            {(['info', 'comments'] as const).map(t => (
              <button key={t} onClick={() => setActiveTab(t)}
                className={`flex-1 py-2 text-xs font-medium capitalize transition-colors ${activeTab === t ? 'text-college-amber border-b-2 border-college-amber' : 'text-white/50 hover:text-white/80'}`}>
                {t}{t === 'comments' && comments.length > 0 ? ` (${comments.length})` : ''}
              </button>
            ))}
          </div>

          {/* Info tab */}
          {activeTab === 'info' && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div>
                <p className="font-semibold text-sm">{item.title ?? 'Untitled'}</p>
                <p className="text-white/50 text-xs mt-1">Uploaded by {item.profiles?.full_name ?? 'Unknown'}</p>
                <p className="text-white/50 text-xs">{format(new Date(item.created_at), 'dd MMM yyyy, h:mm a')}</p>
                {/* Caption — editable for admin / club_member */}
                {editingCaption ? (
                  <div className="mt-2 space-y-1.5">
                    <textarea
                      autoFocus
                      rows={3}
                      value={captionDraft}
                      onChange={e => setCaptionDraft(e.target.value)}
                      placeholder="Write a caption…"
                      className="w-full bg-white/10 text-white text-xs rounded-lg px-2.5 py-2 resize-none outline-none border border-white/20 focus:border-college-amber/60 placeholder-white/30 leading-relaxed"
                    />
                    <div className="flex gap-1.5">
                      <button
                        onClick={saveCaption}
                        className="flex-1 bg-college-amber text-white text-xs font-medium py-1.5 rounded-lg hover:bg-college-gold transition-colors">
                        Save
                      </button>
                      <button
                        onClick={() => setEditingCaption(false)}
                        className="flex-1 bg-white/10 text-white/70 text-xs py-1.5 rounded-lg hover:bg-white/20 transition-colors">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 group/caption flex items-start gap-1.5">
                    {localCaption ? (
                      <p className="flex-1 text-college-amber/80 text-xs italic leading-relaxed border-l-2 border-college-amber/30 pl-2">
                        "{localCaption}"
                      </p>
                    ) : canEditCaption ? (
                      <p className="flex-1 text-white/25 text-xs italic pl-2">No caption yet</p>
                    ) : null}
                    {canEditCaption && (
                      <button
                        onClick={() => { setCaptionDraft(localCaption ?? ''); setEditingCaption(true) }}
                        className="shrink-0 opacity-0 group-hover/caption:opacity-100 text-white/40 hover:text-college-amber transition-all p-0.5 rounded"
                        title="Edit caption">
                        <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg>
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-white/50 text-xs flex items-center gap-1"><Tag size={11} /> Tags</p>
                  <button onClick={() => setAddingTag(true)}
                    className="text-xs text-college-amber hover:text-college-gold transition-colors">+ Add</button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {localTags.map(tag => (
                    <span key={tag} className="group flex items-center gap-1 text-xs bg-white/10 hover:bg-white/20 px-2 py-0.5 rounded-full transition-colors">
                      {tag}
                      <button onClick={() => removeTag(tag)}
                        className="opacity-0 group-hover:opacity-100 text-white/40 hover:text-red-400 transition-all">
                        <X size={9} />
                      </button>
                    </span>
                  ))}
                  {localTags.length === 0 && !addingTag && (
                    <p className="text-white/30 text-xs italic">No tags yet — add some or re-upload to auto-tag</p>
                  )}
                </div>
                {addingTag && (
                  <form onSubmit={addTag} className="flex gap-1.5 mt-2">
                    <input
                      autoFocus
                      type="text"
                      value={newTag}
                      onChange={e => setNewTag(e.target.value)}
                      placeholder="e.g. sports"
                      className="flex-1 bg-white/10 text-white placeholder-white/30 text-xs rounded-lg px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-college-amber"
                    />
                    <button type="submit" className="text-xs bg-college-amber text-white px-2.5 py-1.5 rounded-lg">Add</button>
                    <button type="button" onClick={() => { setAddingTag(false); setNewTag('') }}
                      className="text-xs text-white/40 hover:text-white px-1.5 py-1.5 rounded-lg">
                      <X size={12} />
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}

          {/* Comments tab */}
          {activeTab === 'comments' && (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {comments.length === 0 ? (
                  <p className="text-white/40 text-xs text-center py-6">No comments yet. Be the first!</p>
                ) : (
                  comments.map(c => (
                    <div key={c.id} className="flex gap-2">
                      <div className="w-6 h-6 rounded-full bg-college-amber/40 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-white text-xs font-bold">{c.profiles?.full_name?.charAt(0).toUpperCase() ?? '?'}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-white/80">{c.profiles?.full_name ?? 'Unknown'}</p>
                        <CommentText text={c.content} />
                        <p className="text-xs text-white/30 mt-0.5">{format(new Date(c.created_at), 'dd MMM, h:mm a')}</p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={commentsEndRef} />
              </div>

              {/* Input with @mention dropdown */}
              {profile && (
                <div className="border-t border-white/10 p-3 relative">
                  {mentionDropdown.length > 0 && (
                    <div className="absolute bottom-full left-3 right-3 mb-1 bg-gray-900 rounded-xl overflow-hidden shadow-2xl border border-white/10 z-10">
                      {mentionDropdown.map(u => (
                        <button key={u.id} type="button"
                          onMouseDown={e => { e.preventDefault(); insertMention(u) }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/10 transition-colors text-left">
                          <div className="w-6 h-6 rounded-full bg-college-amber/40 flex items-center justify-center shrink-0">
                            <span className="text-white text-xs font-bold">{u.full_name.charAt(0).toUpperCase()}</span>
                          </div>
                          <div>
                            <p className="text-white text-xs font-medium">{u.full_name}</p>
                            <p className="text-white/40 text-xs">@{mentionToken(u.full_name)}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  <form onSubmit={postComment} className="flex gap-2 items-center">
                    <div className="flex-1 relative">
                      <input
                        ref={commentInputRef}
                        type="text"
                        value={commentText}
                        onChange={handleCommentInput}
                        placeholder="Comment… type @ to mention"
                        className="w-full bg-white/10 text-white placeholder-white/30 text-xs rounded-lg pl-3 pr-7 py-2 outline-none focus:ring-1 focus:ring-college-amber"
                      />
                      <AtSign size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/20 pointer-events-none" />
                    </div>
                    <button type="submit" disabled={posting || !commentText.trim()}
                      className="p-2 rounded-lg bg-college-amber hover:bg-college-gold text-white transition-colors disabled:opacity-40 shrink-0">
                      <Send size={13} />
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
