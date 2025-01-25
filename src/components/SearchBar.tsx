import { useState, useEffect, useRef } from 'react';
import { database } from '../lib/firebase/config';
import { ref, get } from 'firebase/database';
import { BsSearch } from 'react-icons/bs';
import debounce from 'lodash/debounce';
import Image from 'next/image';
import Link from 'next/link';

interface SearchResult {
  id: string;
  title: string;
  videoUrl: string;
  thumbnailUrl: string;
  userId: string;
  username: string;
}

interface SearchBarProps {
  onResultsFound?: (results: SearchResult[]) => void;
}

export default function SearchBar({ onResultsFound }: SearchBarProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const debouncedSearch = debounce(async (term: string) => {
    if (!term.trim()) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    setIsSearching(true);
    try {
      const videosRef = ref(database, 'videos');
      const snapshot = await get(videosRef);
      
      if (snapshot.exists()) {
        const videos = snapshot.val();
        const searchResults: SearchResult[] = [];
        
        for (const [videoId, video] of Object.entries(videos)) {
          const videoData = video as any;
          if (videoData.title.toLowerCase().includes(term.toLowerCase())) {
            const userRef = ref(database, `users/${videoData.userId}/profile`);
            const userSnapshot = await get(userRef);
            const userData = userSnapshot.val();
            
            searchResults.push({
              id: videoId,
              title: videoData.title,
              videoUrl: videoData.videoUrl,
              thumbnailUrl: videoData.thumbnailUrl,
              userId: videoData.userId,
              username: userData?.name || 'Anonymous'
            });
          }
        }
        
        setResults(searchResults);
        setShowDropdown(true);
      }
    } catch (error) {
      console.error('Error searching videos:', error);
    } finally {
      setIsSearching(false);
    }
  }, 300);

  useEffect(() => {
    return () => {
      debouncedSearch.cancel();
    };
  }, []);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    debouncedSearch(value);
  };

  return (
    <div className="w-full max-w-3xl mx-auto mb-6 relative" ref={searchRef}>
      <div className="relative">
        <input
          type="text"
          value={searchTerm}
          onChange={handleSearch}
          onFocus={() => searchTerm.trim() && setShowDropdown(true)}
          placeholder="Search videos..."
          className="w-full px-4 py-3 pl-12 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
        />
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
          {isSearching ? (
            <div className="w-4 h-4 border-2 border-gray-400 border-t-indigo-600 rounded-full animate-spin" />
          ) : (
            <BsSearch className="w-4 h-4" />
          )}
        </div>
      </div>

      {/* Search Results Dropdown */}
      {showDropdown && results.length > 0 && (
        <div className="absolute w-full mt-2 bg-white rounded-xl shadow-lg border border-gray-200 max-h-[70vh] overflow-y-auto z-50">
          {results.map((result) => (
            <Link
              key={result.id}
              href={`/video/${result.id}`}
              className="flex items-center p-3 hover:bg-gray-50 transition-colors border-b last:border-b-0"
              onClick={() => setShowDropdown(false)}
            >
              <div className="relative w-20 h-12 flex-shrink-0">
                <Image
                  src={result.thumbnailUrl}
                  alt={result.title}
                  fill
                  className="rounded object-cover"
                  sizes="80px"
                />
              </div>
              <div className="ml-3 flex-1 min-w-0">
                <h3 className="text-sm font-medium text-gray-900 truncate">{result.title}</h3>
                <p className="text-xs text-gray-500 mt-1">
                  by {result.username}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
} 