import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  ArrowLeft,
  Plus,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Heart,
  MessageCircle,
  Share2,
  Eye,
  MoreHorizontal,
  Search,
  Sparkles,
  Layers,
  LayoutGrid,
  List,
  Flame,
  CheckCircle,
  Clock,
  Music,
  Send,
  Trash2,
  Maximize2,
  RefreshCw,
  SlidersHorizontal,
  X,
  UserPlus,
  UserCheck,
} from 'lucide-react';
import { Story, User } from '../types';

interface StoryFeedsProps {
  currentUser: User | null;
  users?: User[];
  stories?: Story[];
  onCreateStory?: () => void;
  onViewStory?: (storyId: number) => void;
  onProfileClick?: (id: number) => void;
  onReact?: (storyId: number, type: string) => void | Promise<void>;
  onReply?: (storyId: number, text: string) => void | Promise<void>;
  onComment?: (storyId: number) => void;
  onShare?: (story: any) => void;
  onDeleteStory?: (storyId: number) => void | Promise<void>;
  onFollow?: (id: number) => void;
  checkIsFollowing?: (id: number) => boolean;
  followLoading?: boolean | Record<number, boolean>;
  onBack?: () => void;
  onLoginClick?: () => void;
}

type FilterTab = 'all' | 'image' | 'video' | 'text' | 'my-stories';
type ViewMode = 'stream' | 'grid';
type SortOption = 'recent' | 'popular' | 'unviewed';

const REACTION_ICONS: Record<string, { emoji: string; label: string; color: string }> = {
  like: { emoji: '👍', label: 'Like', color: '#38BDF8' },
  love: { emoji: '❤️', label: 'Love', color: '#EF4444' },
  fire: { emoji: '🔥', label: 'Fire', color: '#F97316' },
  haha: { emoji: '😂', label: 'Haha', color: '#FBBF24' },
  wow: { emoji: '😮', label: 'Wow', color: '#A855F7' },
  sad: { emoji: '😢', label: 'Sad', color: '#60A5FA' },
  angry: { emoji: '😡', label: 'Angry', color: '#F87171' },
};

const formatTimeAgo = (dateStr?: string): string => {
  if (!dateStr) return 'Just now';
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);

    if (diffSec < 60) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return `${Math.floor(diffSec / 86400)}d ago`;
  } catch {
    return 'Recently';
  }
};

const formatExpiryTime = (createdAt?: string): string => {
  if (!createdAt) return '24h story';
  try {
    const created = new Date(createdAt).getTime();
    const expires = created + 24 * 60 * 60 * 1000;
    const remaining = expires - Date.now();
    if (remaining <= 0) return 'Expiring soon';
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    if (hours > 0) return `Expires in ${hours}h`;
    const minutes = Math.floor(remaining / (1000 * 60));
    return `Expires in ${minutes}m`;
  } catch {
    return 'Active';
  }
};

export default function StoryFeeds({
  currentUser,
  users = [],
  stories = [],
  onCreateStory,
  onViewStory,
  onProfileClick,
  onReact,
  onReply,
  onComment,
  onShare,
  onDeleteStory,
  onFollow,
  checkIsFollowing,
  followLoading,
  onBack,
  onLoginClick,
}: StoryFeedsProps) {
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('stream');
  const [sortOption, setSortOption] = useState<SortOption>('recent');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCreatorId, setSelectedCreatorId] = useState<number | null>(null);

  // Group stories by creator for top reel
  const creatorsMap = useMemo(() => {
    const map = new Map<number, { user: Partial<User>; stories: Story[] }>();

    for (const story of stories) {
      const authorId = Number(story.user_id || story.user?.id || 0);
      if (!authorId) continue;

      const matchedUser = users.find((u) => Number(u.id) === authorId);
      const userObj: Partial<User> = {
        id: authorId,
        name: story.author_name || story.user?.name || matchedUser?.name || 'Creator',
        username:
          story.author_username ||
          story.username ||
          story.user?.username ||
          matchedUser?.username ||
          'creator',
        profile_image_url:
          story.author_image ||
          story.user?.profile_image_url ||
          matchedUser?.profile_image_url ||
          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
        is_verified:
          story.user?.is_verified ||
          matchedUser?.is_verified ||
          (matchedUser as any)?.verified ||
          false,
      };

      if (!map.has(authorId)) {
        map.set(authorId, { user: userObj, stories: [] });
      }
      map.get(authorId)!.stories.push(story);
    }

    return map;
  }, [stories, users]);

  const creatorsList = useMemo(() => {
    return Array.from(creatorsMap.values());
  }, [creatorsMap]);

  // Filter & sort stories
  const filteredStories = useMemo(() => {
    let list = [...stories];

    // Creator focus filter
    if (selectedCreatorId !== null) {
      list = list.filter((s) => Number(s.user_id || s.user?.id) === selectedCreatorId);
    }

    // Type filter
    if (filterTab === 'image') {
      list = list.filter((s) => s.type === 'image');
    } else if (filterTab === 'video') {
      list = list.filter((s) => s.type === 'video');
    } else if (filterTab === 'text') {
      list = list.filter((s) => s.type === 'text');
    } else if (filterTab === 'my-stories' && currentUser) {
      list = list.filter((s) => Number(s.user_id || s.user?.id) === Number(currentUser.id));
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((s) => {
        const text = (s.text_content || s.text || '').toLowerCase();
        const author = (s.author_name || s.user?.name || '').toLowerCase();
        const username = (s.author_username || s.username || '').toLowerCase();
        const music = (s.music_title || '').toLowerCase();
        return (
          text.includes(q) ||
          author.includes(q) ||
          username.includes(q) ||
          music.includes(q)
        );
      });
    }

    // Sorting
    if (sortOption === 'recent') {
      list.sort((a, b) => {
        const timeA = new Date(a.created_at || (a as any).createdAt || 0).getTime();
        const timeB = new Date(b.created_at || (b as any).createdAt || 0).getTime();
        return timeB - timeA;
      });
    } else if (sortOption === 'popular') {
      list.sort((a, b) => {
        const reactsA = a.reactions_count || a.reactions?.length || 0;
        const reactsB = b.reactions_count || b.reactions?.length || 0;
        return reactsB - reactsA;
      });
    } else if (sortOption === 'unviewed') {
      list.sort((a, b) => {
        const seenA = a.seen || a.viewed_by_me ? 1 : 0;
        const seenB = b.seen || b.viewed_by_me ? 1 : 0;
        return seenA - seenB;
      });
    }

    return list;
  }, [stories, filterTab, searchQuery, sortOption, selectedCreatorId, currentUser]);

  // Counts for pills
  const counts = useMemo(() => {
    const total = stories.length;
    const images = stories.filter((s) => s.type === 'image').length;
    const videos = stories.filter((s) => s.type === 'video').length;
    const texts = stories.filter((s) => s.type === 'text').length;
    const my = currentUser
      ? stories.filter((s) => Number(s.user_id || s.user?.id) === Number(currentUser.id)).length
      : 0;
    return { total, images, videos, texts, my };
  }, [stories, currentUser]);

  return (
    <div className="w-full min-h-screen bg-[#050B18] text-[#F8FAFC]">
      {/* Top Sticky Header */}
      <div className="sticky top-0 z-30 bg-[#0B1120]/95 backdrop-blur-md border-b border-[#1E293B] px-4 py-3 sm:px-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                aria-label="Go back"
                className="w-10 h-10 rounded-xl bg-[#141E33] hover:bg-[#1E293B] border border-[#1E293B] flex items-center justify-center text-[#94A3B8] hover:text-white transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}

            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
                  <span>Story Feed</span>
                </h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  LIVE
                </span>
              </div>
              <p className="text-xs sm:text-sm text-[#94A3B8] truncate">
                {counts.total} active stories from friends & community
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {onCreateStory && (
              <button
                type="button"
                onClick={onCreateStory}
                className="flex items-center gap-1.5 px-3.5 py-2 sm:px-4 sm:py-2 rounded-xl bg-gradient-to-r from-[#1877F2] to-[#2563EB] hover:from-[#166FE5] hover:to-[#1D4ED8] text-white font-bold text-xs sm:text-sm shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden xs:inline">Add Story</span>
              </button>
            )}

            <div className="flex items-center p-1 rounded-xl bg-[#141E33] border border-[#1E293B]">
              <button
                type="button"
                onClick={() => setViewMode('stream')}
                aria-label="Feed stream view"
                className={`p-1.5 rounded-lg transition-all ${
                  viewMode === 'stream'
                    ? 'bg-[#1877F2] text-white shadow-sm'
                    : 'text-[#94A3B8] hover:text-white'
                }`}
                title="Feed Stream (like Feeds)"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                aria-label="Grid view"
                className={`p-1.5 rounded-lg transition-all ${
                  viewMode === 'grid'
                    ? 'bg-[#1877F2] text-white shadow-sm'
                    : 'text-[#94A3B8] hover:text-white'
                }`}
                title="Visual Grid"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-2 sm:px-4 py-4 sm:py-6 space-y-6">
        {/* Top Story Creators Carousel */}
        <div className="bg-[#0B1120] border border-[#1E293B] rounded-2xl p-3 sm:p-4 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between mb-3 px-1">
            <span className="text-xs font-bold uppercase tracking-wider text-[#94A3B8] flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[#38BDF8]" />
              Story Creators
            </span>
            {selectedCreatorId !== null && (
              <button
                type="button"
                onClick={() => setSelectedCreatorId(null)}
                className="text-xs text-[#38BDF8] hover:underline flex items-center gap-1"
              >
                Clear creator filter
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-3.5 overflow-x-auto pb-2 pt-1 scrollbar-thin scrollbar-thumb-[#1E293B] scrollbar-track-transparent">
            {/* Create Story Button Card */}
            {onCreateStory && (
              <button
                type="button"
                onClick={onCreateStory}
                className="flex flex-col items-center gap-1.5 flex-shrink-0 group cursor-pointer"
              >
                <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-full p-[2px] bg-gradient-to-tr from-blue-500 via-indigo-500 to-cyan-400 group-hover:scale-105 transition-transform">
                  <div className="w-full h-full rounded-full bg-[#0F172A] flex items-center justify-center overflow-hidden border-2 border-[#0B1120]">
                    {currentUser?.profile_image_url ? (
                      <img
                        src={currentUser.profile_image_url}
                        alt="Your story"
                        className="w-full h-full object-cover opacity-75 group-hover:opacity-100 transition-opacity"
                      />
                    ) : (
                      <div className="w-full h-full bg-[#1E293B] flex items-center justify-center text-white font-bold">
                        You
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                      <div className="w-6 h-6 rounded-full bg-[#1877F2] text-white flex items-center justify-center shadow-md">
                        <Plus className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </div>
                </div>
                <span className="text-[11px] font-medium text-[#94A3B8] group-hover:text-white max-w-[64px] truncate text-center">
                  Your Story
                </span>
              </button>
            )}

            {/* Creator Rings */}
            {creatorsList.map(({ user, stories: userStories }) => {
              const isSelected = selectedCreatorId === user.id;
              const hasUnviewed = userStories.some((s) => !s.seen && !s.viewed_by_me);

              return (
                <button
                  key={`creator-${user.id}`}
                  type="button"
                  onClick={() => {
                    if (isSelected) {
                      setSelectedCreatorId(null);
                    } else {
                      setSelectedCreatorId(Number(user.id));
                    }
                  }}
                  className={`flex flex-col items-center gap-1.5 flex-shrink-0 group transition-all ${
                    isSelected ? 'scale-105' : 'hover:opacity-95'
                  }`}
                >
                  <div
                    className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-full p-[2.5px] transition-all ${
                      isSelected
                        ? 'bg-gradient-to-tr from-blue-500 via-indigo-500 to-cyan-400 shadow-md shadow-blue-500/30'
                        : hasUnviewed
                        ? 'bg-gradient-to-tr from-emerald-400 via-cyan-400 to-blue-500'
                        : 'bg-[#1E293B]'
                    }`}
                  >
                    <img
                      src={
                        user.profile_image_url ||
                        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'
                      }
                      alt={user.name || 'User'}
                      className="w-full h-full rounded-full object-cover border-2 border-[#0B1120]"
                    />
                    <span className="absolute -bottom-1 -right-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-[#1877F2] text-white border-2 border-[#0B1120]">
                      {userStories.length}
                    </span>
                  </div>
                  <span
                    className={`text-[11px] max-w-[68px] truncate text-center ${
                      isSelected ? 'text-[#38BDF8] font-bold' : 'text-[#94A3B8] group-hover:text-white'
                    }`}
                  >
                    {user.name?.split(' ')[0] || 'User'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Filter Tabs & Search Bar */}
        <div className="bg-[#0B1120] border border-[#1E293B] rounded-2xl p-3 sm:p-4 space-y-3 shadow-sm">
          {/* Search bar */}
          <div className="flex items-center gap-2 bg-[#050B18] border border-[#1E293B] rounded-xl px-3 py-2 text-sm focus-within:border-[#1877F2] transition-colors">
            <Search className="w-4 h-4 text-[#64748B]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search stories by caption, creator, or music..."
              className="bg-transparent text-white placeholder-[#64748B] text-sm focus:outline-none w-full"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-[#64748B] hover:text-white p-0.5"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filter pills & sort select */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setFilterTab('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  filterTab === 'all'
                    ? 'bg-[#1877F2] text-white shadow-sm'
                    : 'bg-[#141E33] text-[#94A3B8] hover:text-white hover:bg-[#1E293B]'
                }`}
              >
                All Stories ({counts.total})
              </button>

              <button
                type="button"
                onClick={() => setFilterTab('video')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                  filterTab === 'video'
                    ? 'bg-[#1877F2] text-white shadow-sm'
                    : 'bg-[#141E33] text-[#94A3B8] hover:text-white hover:bg-[#1E293B]'
                }`}
              >
                <span>🎬 Videos</span>
                <span className="opacity-75">({counts.videos})</span>
              </button>

              <button
                type="button"
                onClick={() => setFilterTab('image')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                  filterTab === 'image'
                    ? 'bg-[#1877F2] text-white shadow-sm'
                    : 'bg-[#141E33] text-[#94A3B8] hover:text-white hover:bg-[#1E293B]'
                }`}
              >
                <span>📷 Photos</span>
                <span className="opacity-75">({counts.images})</span>
              </button>

              <button
                type="button"
                onClick={() => setFilterTab('text')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                  filterTab === 'text'
                    ? 'bg-[#1877F2] text-white shadow-sm'
                    : 'bg-[#141E33] text-[#94A3B8] hover:text-white hover:bg-[#1E293B]'
                }`}
              >
                <span>✍️ Text</span>
                <span className="opacity-75">({counts.texts})</span>
              </button>

              {currentUser && (
                <button
                  type="button"
                  onClick={() => setFilterTab('my-stories')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                    filterTab === 'my-stories'
                      ? 'bg-[#1877F2] text-white shadow-sm'
                      : 'bg-[#141E33] text-[#94A3B8] hover:text-white hover:bg-[#1E293B]'
                  }`}
                >
                  <span>👤 My Stories</span>
                  <span className="opacity-75">({counts.my})</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[#64748B] uppercase font-bold flex items-center gap-1">
                <SlidersHorizontal className="w-3 h-3" />
                Sort:
              </span>
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as SortOption)}
                className="bg-[#141E33] text-[#F8FAFC] border border-[#1E293B] rounded-xl px-2.5 py-1 text-xs focus:outline-none focus:border-[#1877F2]"
              >
                <option value="recent">Recent First</option>
                <option value="popular">Most Reacted</option>
                <option value="unviewed">Unviewed First</option>
              </select>
            </div>
          </div>
        </div>

        {/* Story Feed Content */}
        {filteredStories.length === 0 ? (
          <div className="bg-[#0B1120] border border-[#1E293B] rounded-2xl p-10 text-center flex flex-col items-center justify-center space-y-4 shadow-sm">
            <div className="w-16 h-16 rounded-2xl bg-[#141E33] border border-[#1E293B] flex items-center justify-center text-[#38BDF8]">
              <Layers className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-white">No stories found</h3>
              <p className="text-sm text-[#94A3B8] max-w-sm">
                {searchQuery
                  ? `No stories matched "${searchQuery}". Try clearing search filters.`
                  : filterTab === 'my-stories'
                  ? "You haven't posted any stories yet. Share a photo, video or message!"
                  : 'Be the first to post a story today for your community!'}
              </p>
            </div>
            {onCreateStory && (
              <button
                type="button"
                onClick={onCreateStory}
                className="px-5 py-2.5 rounded-xl bg-[#1877F2] hover:bg-[#166FE5] text-white font-bold text-sm shadow-md transition-all active:scale-95 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Create Story
              </button>
            )}
          </div>
        ) : viewMode === 'stream' ? (
          /* Stream Mode (Like Feeds.tsx) */
          <div className="space-y-6">
            {filteredStories.map((story) => (
              <StoryFeedCard
                key={`story-feed-card-${story.id}`}
                story={story}
                currentUser={currentUser}
                users={users}
                onViewStory={onViewStory}
                onProfileClick={onProfileClick}
                onReact={onReact}
                onReply={onReply}
                onComment={onComment}
                onShare={onShare}
                onDeleteStory={onDeleteStory}
                onFollow={onFollow}
                checkIsFollowing={checkIsFollowing}
                followLoading={followLoading}
                onLoginClick={onLoginClick}
              />
            ))}
          </div>
        ) : (
          /* Grid Mode */
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 gap-3 sm:gap-4">
            {filteredStories.map((story) => (
              <StoryGridCard
                key={`story-grid-card-${story.id}`}
                story={story}
                currentUser={currentUser}
                users={users}
                onViewStory={onViewStory}
                onProfileClick={onProfileClick}
                onReact={onReact}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * StoryFeedCard: High-fidelity feed-style card component designed like Feeds.tsx
 * Supports:
 * - Text stories (rich gradient backgrounds, custom quotes, typography)
 * - Image stories (high resolution, full frame, zoom)
 * - Video stories (interactive HTML5 player with play/pause, mute, timeline)
 * - Full Feeds-like interaction bar (reactions, discussions, shares, quick replies)
 */
interface StoryFeedCardProps {
  key?: React.Key;
  story: Story;
  currentUser: User | null;
  users?: User[];
  onViewStory?: (storyId: number) => void;
  onProfileClick?: (id: number) => void;
  onReact?: (storyId: number, type: string) => void | Promise<void>;
  onReply?: (storyId: number, text: string) => void | Promise<void>;
  onComment?: (storyId: number) => void;
  onShare?: (story: any) => void;
  onDeleteStory?: (storyId: number) => void | Promise<void>;
  onFollow?: (id: number) => void;
  checkIsFollowing?: (id: number) => boolean;
  followLoading?: boolean | Record<number, boolean>;
  onLoginClick?: () => void;
}

function StoryFeedCard({
  story,
  currentUser,
  users = [],
  onViewStory,
  onProfileClick,
  onReact,
  onReply,
  onComment,
  onShare,
  onDeleteStory,
  onFollow,
  checkIsFollowing,
  followLoading,
  onLoginClick,
}: StoryFeedCardProps) {
  const authorId = Number(story.user_id || story.user?.id || 0);
  const matchedUser = users.find((u) => Number(u.id) === authorId);

  const authorName =
    story.author_name || story.user?.name || matchedUser?.name || 'Creator';
  const authorUsername =
    story.author_username ||
    story.username ||
    story.user?.username ||
    matchedUser?.username ||
    'creator';
  const authorImage =
    story.author_image ||
    story.user?.profile_image_url ||
    matchedUser?.profile_image_url ||
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80';
  const isVerified =
    story.user?.is_verified ||
    matchedUser?.is_verified ||
    (matchedUser as any)?.verified ||
    false;

  const isAuthor = currentUser && Number(currentUser.id) === authorId;
  const isFollowing = checkIsFollowing ? checkIsFollowing(authorId) : false;
  const isFollowPending =
    typeof followLoading === 'object' && followLoading !== null
      ? Boolean((followLoading as Record<number, boolean>)[authorId])
      : Boolean(followLoading);

  // Media determination
  const storyType = story.type || 'text';
  const isVideo = storyType === 'video' || !!(story.media_url && story.media_url.endsWith('.mp4'));
  const isImage = storyType === 'image';
  const isText = storyType === 'text';

  // Video state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [videoProgress, setVideoProgress] = useState(0);

  // Quick reply state
  const [replyText, setReplyText] = useState('');
  const [isReplying, setIsReplying] = useState(false);
  const [replySuccess, setReplySuccess] = useState(false);

  // Reaction state
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [currentReaction, setCurrentReaction] = useState<string | null>(
    story.my_reaction || (story.liked_by_me ? 'like' : null)
  );
  const [reactionCount, setReactionCount] = useState<number>(
    story.reactions_count || story.reactions?.length || 0
  );

  // Dropdown options
  const [showMenu, setShowMenu] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Best media URL
  const mediaUrl =
    story.media_url ||
    (story.media_urls && story.media_urls[0]) ||
    story.mediaUrl ||
    '';

  const handleTogglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const handleToggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleVideoTimeUpdate = () => {
    if (!videoRef.current) return;
    const { currentTime, duration } = videoRef.current;
    if (duration > 0) {
      setVideoProgress((currentTime / duration) * 100);
    }
  };

  const handleSelectReaction = async (rKey: string) => {
    setShowReactionPicker(false);
    if (!currentUser) {
      onLoginClick?.();
      return;
    }

    const previousReaction = currentReaction;
    const isSame = currentReaction === rKey;
    const nextReaction = isSame ? null : rKey;

    setCurrentReaction(nextReaction);
    setReactionCount((prev) => (isSame ? Math.max(0, prev - 1) : previousReaction ? prev : prev + 1));

    if (onReact) {
      await onReact(story.id, rKey);
    }
  };

  const handleSendReply = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!replyText.trim()) return;

    if (!currentUser) {
      onLoginClick?.();
      return;
    }

    setIsReplying(true);
    try {
      if (onReply) {
        await onReply(story.id, replyText.trim());
      }
      setReplyText('');
      setReplySuccess(true);
      setTimeout(() => setReplySuccess(false), 2500);
    } catch (err) {
      console.error('Failed to send reply:', err);
    } finally {
      setIsReplying(false);
    }
  };

  const handleQuickEmoji = (emoji: string) => {
    if (!currentUser) {
      onLoginClick?.();
      return;
    }
    if (onReply) {
      onReply(story.id, emoji);
      setReplySuccess(true);
      setTimeout(() => setReplySuccess(false), 2500);
    }
  };

  const handleDelete = async () => {
    if (!onDeleteStory) return;
    if (window.confirm('Are you sure you want to delete this story?')) {
      setIsDeleting(true);
      try {
        await onDeleteStory(story.id);
      } catch (err) {
        console.error('Delete failed:', err);
      } finally {
        setIsDeleting(false);
        setShowMenu(false);
      }
    }
  };

  return (
    <article className="w-full relative bg-[#0F172A] border-b-[8px] border-[#050B18] sm:rounded-2xl sm:border sm:border-[#1E293B] sm:mb-6 overflow-hidden shadow-xl transition-all">
      {/* Top Header Row (Author & Context) */}
      <div className="p-3.5 sm:p-4 flex items-center justify-between gap-3 border-b border-[#1E293B]/60">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => onProfileClick?.(authorId)}
            className="relative flex-shrink-0 group cursor-pointer"
          >
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full p-[2px] bg-gradient-to-tr from-blue-500 via-indigo-500 to-cyan-400">
              <img
                src={authorImage}
                alt={authorName}
                className="w-full h-full rounded-full object-cover border-2 border-[#0F172A]"
              />
            </div>
          </button>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => onProfileClick?.(authorId)}
                className="text-white font-bold text-sm sm:text-base hover:text-[#38BDF8] transition-colors truncate text-left"
              >
                {authorName}
              </button>
              {isVerified && (
                <CheckCircle className="w-4 h-4 text-[#1877F2] fill-[#1877F2]" />
              )}
              <span className="text-xs text-[#64748B] hidden xs:inline">
                @{authorUsername}
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs text-[#94A3B8] mt-0.5">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-[#64748B]" />
                {formatTimeAgo(story.created_at || (story as any).createdAt)}
              </span>
              <span>·</span>
              <span className="text-amber-400/90 font-medium">
                {formatExpiryTime(story.created_at || (story as any).createdAt)}
              </span>
              <span>·</span>
              <span className="px-1.5 py-0.2 rounded-md bg-[#1E293B] text-[10px] font-bold text-[#38BDF8] uppercase tracking-wider">
                {isVideo ? '🎬 Video Story' : isImage ? '📷 Photo Story' : '✍️ Text Story'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {!isAuthor && currentUser && onFollow && (
            <button
              type="button"
              onClick={() => onFollow(authorId)}
              disabled={isFollowPending}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1 ${
                isFollowing
                  ? 'bg-[#1E293B] text-[#94A3B8] hover:bg-[#334155] hover:text-white'
                  : 'bg-[#1877F2] text-white hover:bg-[#166FE5] shadow-sm'
              }`}
            >
              {isFollowing ? (
                <>
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Following</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Follow</span>
                </>
              )}
            </button>
          )}

          {/* Options Menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowMenu((prev) => !prev)}
              aria-label="Story options"
              className="w-8 h-8 rounded-full flex items-center justify-center text-[#94A3B8] hover:text-white hover:bg-[#1E293B] transition-colors"
            >
              <MoreHorizontal className="w-5 h-5" />
            </button>

            {showMenu && (
              <div className="absolute right-0 top-10 w-48 bg-[#0B1120] border border-[#1E293B] rounded-xl shadow-2xl p-1.5 z-50 animate-fade-in text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false);
                    onViewStory?.(story.id);
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg text-white hover:bg-[#1E293B] flex items-center gap-2"
                >
                  <Maximize2 className="w-4 h-4 text-[#38BDF8]" />
                  Watch in Story Viewer
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false);
                    onShare?.(story);
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg text-white hover:bg-[#1E293B] flex items-center gap-2"
                >
                  <Share2 className="w-4 h-4 text-emerald-400" />
                  Share Story
                </button>
                {isAuthor && onDeleteStory && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="w-full text-left px-3 py-2 rounded-lg text-rose-400 hover:bg-rose-500/10 flex items-center gap-2 border-t border-[#1E293B] mt-1"
                  >
                    <Trash2 className="w-4 h-4" />
                    {isDeleting ? 'Deleting...' : 'Delete Story'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Music Banner (if story has audio) */}
      {(story.music_title || story.musicTitle || story.music_url) && (
        <div className="px-4 py-2 bg-gradient-to-r from-indigo-950/40 via-[#0B1120] to-blue-950/40 border-b border-[#1E293B]/40 flex items-center justify-between text-xs text-[#38BDF8]">
          <div className="flex items-center gap-2 truncate">
            <div className="w-5 h-5 rounded-full bg-blue-500/20 text-[#38BDF8] flex items-center justify-center animate-spin" style={{ animationDuration: '4s' }}>
              <Music className="w-3 h-3" />
            </div>
            <span className="font-semibold truncate">
              {story.music_title || story.musicTitle || 'Original Audio'}
            </span>
          </div>
          <span className="text-[10px] text-[#64748B] uppercase font-bold tracking-wider">
            Audio Track
          </span>
        </div>
      )}

      {/* Media Canvas Body */}
      <div className="relative w-full bg-[#050B18] overflow-hidden flex items-center justify-center select-none">
        {/* 1. TEXT STORY */}
        {isText && (
          <div
            onClick={() => onViewStory?.(story.id)}
            className="w-full min-h-[360px] sm:min-h-[440px] flex flex-col items-center justify-center p-8 sm:p-12 text-center cursor-pointer transition-transform relative group"
            style={{
              background:
                story.background_style ||
                story.backgroundStyle ||
                'linear-gradient(135deg, #1e1b4b 0%, #311042 50%, #0f172a 100%)',
            }}
          >
            {/* Subtle background particles / overlay */}
            <div className="absolute inset-0 bg-black/20 pointer-events-none" />

            <div className="relative z-10 max-w-lg mx-auto">
              <span className="text-3xl sm:text-4xl text-white/40 block mb-2 font-serif">
                “
              </span>
              <p className="text-xl sm:text-2xl md:text-3xl font-black text-white leading-relaxed drop-shadow-[0_2px_8px_rgba(0,0,0,0.7)] whitespace-pre-wrap">
                {story.text_content || story.text || 'My Story'}
              </p>
              <span className="text-3xl sm:text-4xl text-white/40 block mt-2 font-serif">
                ”
              </span>
            </div>

            <div className="absolute bottom-4 right-4 z-10 opacity-80 group-hover:opacity-100 transition-opacity">
              <span className="px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-md text-white text-xs font-semibold flex items-center gap-1.5 border border-white/10">
                <Maximize2 className="w-3 h-3" />
                Tap to view
              </span>
            </div>
          </div>
        )}

        {/* 2. IMAGE STORY */}
        {isImage && mediaUrl && (
          <div
            onClick={() => onViewStory?.(story.id)}
            className="w-full relative min-h-[380px] sm:min-h-[480px] max-h-[640px] bg-black flex items-center justify-center cursor-pointer group"
          >
            <img
              src={mediaUrl}
              alt="Story"
              className="w-full h-full max-h-[640px] object-contain group-hover:scale-[1.01] transition-transform duration-300"
              loading="lazy"
            />

            {/* Optional text caption overlay */}
            {(story.text_content || story.text) && (
              <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/90 via-black/40 to-transparent text-white text-sm sm:text-base font-medium">
                <p className="line-clamp-3 drop-shadow-md">
                  {story.text_content || story.text}
                </p>
              </div>
            )}

            <div className="absolute top-4 right-4 opacity-80 group-hover:opacity-100 transition-opacity">
              <span className="px-3 py-1.5 rounded-full bg-black/50 backdrop-blur-md text-white text-xs font-bold flex items-center gap-1.5 border border-white/20">
                <Maximize2 className="w-3 h-3" />
                Full Viewer
              </span>
            </div>
          </div>
        )}

        {/* 3. VIDEO STORY */}
        {isVideo && mediaUrl && (
          <div className="w-full relative min-h-[380px] sm:min-h-[480px] max-h-[640px] bg-black flex items-center justify-center group">
            <video
              ref={videoRef}
              src={mediaUrl}
              className="w-full h-full max-h-[640px] object-contain"
              playsInline
              loop
              muted={isMuted}
              onTimeUpdate={handleVideoTimeUpdate}
              onClick={handleTogglePlay}
            />

            {/* Play/Pause Center Overlay (when paused) */}
            {!isPlaying && (
              <button
                type="button"
                onClick={handleTogglePlay}
                aria-label="Play video"
                className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-[#1877F2]/90 hover:bg-[#1877F2] text-white flex items-center justify-center shadow-2xl backdrop-blur-sm transition-transform hover:scale-110 z-10"
              >
                <Play className="w-8 h-8 fill-white translate-x-0.5" />
              </button>
            )}

            {/* Video Controls Bar */}
            <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black/80 via-black/30 to-transparent flex items-center justify-between gap-3 z-10">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleTogglePlay}
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                  className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center backdrop-blur-md"
                >
                  {isPlaying ? (
                    <Pause className="w-4 h-4 fill-white" />
                  ) : (
                    <Play className="w-4 h-4 fill-white translate-x-0.5" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleToggleMute}
                  aria-label={isMuted ? 'Unmute' : 'Mute'}
                  className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center backdrop-blur-md"
                >
                  {isMuted ? (
                    <VolumeX className="w-4 h-4" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                </button>
              </div>

              {/* Video Progress Bar */}
              <div className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden mx-2">
                <div
                  className="h-full bg-[#1877F2] transition-all duration-100"
                  style={{ width: `${videoProgress}%` }}
                />
              </div>

              <button
                type="button"
                onClick={() => onViewStory?.(story.id)}
                className="px-3 py-1 rounded-full bg-white/20 hover:bg-white/30 text-white text-xs font-bold backdrop-blur-md flex items-center gap-1"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                Fullscreen
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Social Feedback Bar (Reactions & Discussions Counts) */}
      <div className="px-4 py-2.5 flex items-center justify-between text-xs sm:text-sm text-[#94A3B8] border-t border-[#1E293B]">
        <div className="flex items-center gap-2">
          {reactionCount > 0 ? (
            <div className="flex items-center gap-1.5 cursor-pointer hover:opacity-80">
              <div className="flex -space-x-1.5">
                <span className="w-6 h-6 rounded-full bg-[#1E293B] border border-[#0B1120] flex items-center justify-center text-xs">
                  {currentReaction && REACTION_ICONS[currentReaction]
                    ? REACTION_ICONS[currentReaction].emoji
                    : '❤️'}
                </span>
                <span className="w-6 h-6 rounded-full bg-[#1E293B] border border-[#0B1120] flex items-center justify-center text-xs">
                  🔥
                </span>
              </div>
              <span className="font-semibold text-white">
                {reactionCount} {reactionCount === 1 ? 'reaction' : 'reactions'}
              </span>
            </div>
          ) : (
            <span className="text-[#64748B]">Be the first to react</span>
          )}
        </div>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => onComment?.(story.id)}
            className="hover:text-white transition-colors cursor-pointer flex items-center gap-1"
          >
            <MessageCircle className="w-4 h-4" />
            <span>Discussions</span>
          </button>

          <div className="flex items-center gap-1 text-[#64748B]">
            <Eye className="w-4 h-4" />
            <span>{story.views_count || story.views || 1} views</span>
          </div>
        </div>
      </div>

      {/* Main Action Buttons (Like, Comment, Share, Watch) */}
      <div className="px-3 py-2 border-t border-[#1E293B] flex items-center justify-between relative bg-[#0B1120]/40">
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Reaction Button with Floating Drawer */}
          <div
            className="relative"
            onMouseEnter={() => setShowReactionPicker(true)}
            onMouseLeave={() => setShowReactionPicker(false)}
          >
            <button
              type="button"
              onClick={() => handleSelectReaction(currentReaction || 'like')}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                currentReaction
                  ? 'text-[#38BDF8] bg-blue-500/10'
                  : 'text-[#94A3B8] hover:text-white hover:bg-[#1E293B]'
              }`}
            >
              {currentReaction && REACTION_ICONS[currentReaction] ? (
                <span className="text-base">{REACTION_ICONS[currentReaction].emoji}</span>
              ) : (
                <Heart className="w-4 h-4" />
              )}
              <span>{currentReaction ? REACTION_ICONS[currentReaction]?.label || 'Reacted' : 'React'}</span>
            </button>

            {/* Floating Quick Reaction Drawer */}
            {showReactionPicker && (
              <div className="absolute bottom-11 left-0 z-50 bg-[#0B1120] border border-[#1E293B] rounded-full p-1.5 shadow-2xl flex items-center gap-1 animate-fade-in backdrop-blur-md">
                {Object.entries(REACTION_ICONS).map(([key, item]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleSelectReaction(key)}
                    className="w-8 h-8 sm:w-9 sm:h-9 rounded-full hover:scale-125 transition-transform flex items-center justify-center text-lg sm:text-xl hover:bg-[#1E293B]"
                    title={item.label}
                  >
                    {item.emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => onComment?.(story.id)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold text-[#94A3B8] hover:text-white hover:bg-[#1E293B] transition-colors"
          >
            <MessageCircle className="w-4 h-4" />
            <span>Comment</span>
          </button>

          <button
            type="button"
            onClick={() => onShare?.(story)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold text-[#94A3B8] hover:text-white hover:bg-[#1E293B] transition-colors"
          >
            <Share2 className="w-4 h-4" />
            <span>Share</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => onViewStory?.(story.id)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-md transition-all active:scale-95"
        >
          <Play className="w-3.5 h-3.5 fill-white" />
          <span>Watch Story</span>
        </button>
      </div>

      {/* Quick Reply & Emoji Reaction Bar */}
      <div className="px-3.5 py-3 border-t border-[#1E293B]/60 bg-[#0B1120]/60 space-y-2">
        {/* Fast 1-tap emojis */}
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] font-semibold text-[#64748B]">
            Quick reaction to {authorName.split(' ')[0]}:
          </span>
          <div className="flex items-center gap-2">
            {['❤️', '🔥', '👏', '😂', '😮', '😍'].map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => handleQuickEmoji(emoji)}
                className="hover:scale-130 active:scale-95 transition-transform text-sm sm:text-base cursor-pointer"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        {/* Input box */}
        <form onSubmit={handleSendReply} className="flex items-center gap-2">
          <input
            type="text"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder={`Reply to ${authorName}...`}
            className="flex-1 bg-[#050B18] border border-[#1E293B] rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white placeholder-[#64748B] focus:outline-none focus:border-[#1877F2] transition-colors"
          />
          <button
            type="submit"
            disabled={!replyText.trim() || isReplying}
            className="px-3.5 py-2 rounded-xl bg-[#1877F2] hover:bg-[#166FE5] disabled:opacity-40 disabled:hover:bg-[#1877F2] text-white text-xs font-bold transition-all flex items-center gap-1 flex-shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">Send</span>
          </button>
        </form>

        {replySuccess && (
          <p className="text-xs text-emerald-400 font-semibold px-1 animate-fade-in">
            ✓ Reply sent to {authorName}!
          </p>
        )}
      </div>
    </article>
  );
}

/**
 * StoryGridCard: Compact bento card for Grid View
 */
interface StoryGridCardProps {
  key?: React.Key;
  story: Story;
  currentUser: User | null;
  users?: User[];
  onViewStory?: (storyId: number) => void;
  onProfileClick?: (id: number) => void;
  onReact?: (storyId: number, type: string) => void | Promise<void>;
}

function StoryGridCard({
  story,
  users = [],
  onViewStory,
  onProfileClick,
}: StoryGridCardProps) {
  const authorId = Number(story.user_id || story.user?.id || 0);
  const matchedUser = users.find((u) => Number(u.id) === authorId);

  const authorName =
    story.author_name || story.user?.name || matchedUser?.name || 'Creator';
  const authorImage =
    story.author_image ||
    story.user?.profile_image_url ||
    matchedUser?.profile_image_url ||
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80';

  const storyType = story.type || 'text';
  const isVideo = storyType === 'video' || !!(story.media_url && story.media_url.endsWith('.mp4'));
  const isImage = storyType === 'image';
  const isText = storyType === 'text';

  const mediaUrl =
    story.media_url ||
    (story.media_urls && story.media_urls[0]) ||
    story.mediaUrl ||
    '';

  return (
    <div
      onClick={() => onViewStory?.(story.id)}
      className="group relative rounded-2xl overflow-hidden bg-[#0F172A] border border-[#1E293B] aspect-[9/16] cursor-pointer shadow-lg hover:border-[#1877F2]/60 hover:shadow-blue-500/10 transition-all flex flex-col justify-between p-3"
    >
      {/* Background Media */}
      <div className="absolute inset-0 z-0 overflow-hidden bg-black">
        {isText ? (
          <div
            className="w-full h-full flex items-center justify-center p-4 text-center"
            style={{
              background:
                story.background_style ||
                story.backgroundStyle ||
                'linear-gradient(135deg, #1e1b4b 0%, #311042 50%, #0f172a 100%)',
            }}
          >
            <p className="text-white font-bold text-sm sm:text-base line-clamp-6 drop-shadow-md">
              {story.text_content || story.text}
            </p>
          </div>
        ) : isVideo ? (
          <div className="relative w-full h-full bg-black flex items-center justify-center">
            <video
              src={mediaUrl}
              className="w-full h-full object-cover opacity-85 group-hover:scale-105 transition-transform duration-300"
              muted
              playsInline
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <div className="w-10 h-10 rounded-full bg-[#1877F2]/90 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                <Play className="w-5 h-5 fill-white translate-x-0.5" />
              </div>
            </div>
          </div>
        ) : (
          <img
            src={mediaUrl}
            alt="Story"
            className="w-full h-full object-cover opacity-90 group-hover:scale-105 transition-transform duration-300"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/90 pointer-events-none" />
      </div>

      {/* Top Badges */}
      <div className="relative z-10 flex items-center justify-between">
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-black/60 backdrop-blur-md text-white border border-white/10">
          {isVideo ? '🎬 Video' : isImage ? '📷 Photo' : '✍️ Text'}
        </span>

        <span className="text-[10px] text-white/80 font-medium">
          {formatTimeAgo(story.created_at || (story as any).createdAt)}
        </span>
      </div>

      {/* Bottom Creator Info */}
      <div className="relative z-10 flex items-center gap-2">
        <div
          onClick={(e) => {
            e.stopPropagation();
            onProfileClick?.(authorId);
          }}
          className="w-8 h-8 rounded-full p-[1.5px] bg-gradient-to-tr from-blue-500 to-cyan-400 flex-shrink-0"
        >
          <img
            src={authorImage}
            alt={authorName}
            className="w-full h-full rounded-full object-cover border border-black"
          />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-white text-xs font-bold truncate">
            {authorName}
          </span>
          <span className="text-[10px] text-white/70 truncate">
            {story.reactions_count || 0} reactions
          </span>
        </div>
      </div>
    </div>
  );
}
