import React, { useState, useEffect, useRef } from 'react';
import { Book, ReadingCategory, Difficulty } from '../types';
import { verifyBookCoverMatch } from '../services/geminiService';

interface BookCardProps {
  book: Book;
  index: number;
  variant?: 'default' | 'compact' | 'pokemon';
  overrideUrl?: string;
  onUpdateCover?: (bookId: string, url: string) => void;
}

const coverCache = new Map<string, string>();
const promiseCache = new Map<string, Promise<string | null>>();

const BookCard: React.FC<BookCardProps> = ({ book, index, variant = 'default', overrideUrl, onUpdateCover }) => {
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [isLoadingImage, setIsLoadingImage] = useState<boolean>(true);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getProxiedUrl = (url: string) => {
    if (url.startsWith('data:')) return url;
    const cleanUrl = url.replace(/^https?:\/\//, '');
    return `https://wsrv.nl/?url=${encodeURIComponent(cleanUrl)}&w=400&output=webp`;
  };

  useEffect(() => {
    if (overrideUrl) {
      setCoverUrl(overrideUrl);
      setIsLoadingImage(false);
      return;
    }

    let isMounted = true;
    const cacheKey = `${book.title}-${book.author}`;

    if (coverCache.has(cacheKey)) {
      setCoverUrl(coverCache.get(cacheKey)!);
      setIsLoadingImage(false);
      return;
    }

    const fetchOpenLibrary = async (): Promise<string | null> => {
      try {
        const query = `title=${encodeURIComponent(book.title)}&author=${encodeURIComponent(book.author)}`;
        const response = await fetch(`https://openlibrary.org/search.json?${query}&limit=1`);
        const data = await response.json();
        if (data.docs && data.docs.length > 0 && data.docs[0].cover_i) {
          return `https://covers.openlibrary.org/b/id/${data.docs[0].cover_i}-L.jpg`;
        }
      } catch (e) {}
      throw new Error("OL no cover");
    };

    const fetchGoogleBooks = async (): Promise<string | null> => {
      try {
        const query = `intitle:${encodeURIComponent(book.title)} inauthor:${encodeURIComponent(book.author)}`;
        const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${query}&maxResults=1`);
        const data = await response.json();
        if (data.items && data.items.length > 0) {
           const imgLinks = data.items[0].volumeInfo.imageLinks;
           if (imgLinks) {
             let url = imgLinks.thumbnail || imgLinks.smallThumbnail;
             if (url) return url.replace('http://', 'https://').replace('&zoom=1', '&zoom=0');
           }
        }
      } catch (e) {}
      throw new Error("GB no cover");
    };

    const loadCover = async () => {
      if (!promiseCache.has(cacheKey)) {
        const racePromise = new Promise<string | null>((resolve) => {
           let failures = 0;
           const checkFailure = () => {
             failures++;
             if (failures === 2) resolve(null);
           };

           fetchGoogleBooks().then(url => {
             if (url) resolve(getProxiedUrl(url));
             else checkFailure();
           }).catch(checkFailure);

           fetchOpenLibrary().then(url => {
             if (url) resolve(getProxiedUrl(url));
             else checkFailure();
           }).catch(checkFailure);
        });

        promiseCache.set(cacheKey, racePromise);
      }

      try {
        const url = await promiseCache.get(cacheKey);
        if (isMounted) {
          if (url) {
            coverCache.set(cacheKey, url);
            setCoverUrl(url);
          }
          setIsLoadingImage(false);
        }
      } catch (error) {
        if (isMounted) setIsLoadingImage(false);
      }
    };

    loadCover();

    return () => {
      isMounted = false;
    };
  }, [book.title, book.author, overrideUrl]);

  const fallbackUrl = `https://placehold.co/300x450/f1f5f9/475569?text=${encodeURIComponent(book.title.substring(0, 20) + '...')}`;
  const displayUrl = coverUrl || fallbackUrl;

  const handleEditClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onUpdateCover) {
      setIsVerifying(true);
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        try {
          const result = await verifyBookCoverMatch(base64String, book.title, book.author);
          if (result.isMatch) {
            onUpdateCover(book.id, base64String);
            setCoverUrl(base64String);
          } else {
            alert(`Verification Failed: ${result.reason || "The uploaded image does not appear to match the book title and author."}`);
          }
        } catch (err) {
          console.error(err);
          alert("Verification service encountered an error. Please check your API key.");
        } finally {
          setIsVerifying(false);
          if (fileInputRef.current) fileInputRef.current.value = "";
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const difficultyColor = {
    [Difficulty.Beginner]: "bg-green-100 text-green-800",
    [Difficulty.Intermediate]: "bg-yellow-100 text-yellow-800",
    [Difficulty.Advanced]: "bg-red-100 text-red-800",
  };

  const categoryColor = book.category === ReadingCategory.MustRead 
    ? "border-l-8 border-purple-500" 
    : "border-l-8 border-indigo-400";

  // --- RENDER VARIANT: POKEMON (Used exclusively for PDF Export) ---
  if (variant === 'pokemon') {
    const cardBorderColor = book.category === ReadingCategory.MustRead ? "border-amber-400" : "border-slate-400";
    const cardBg = book.category === ReadingCategory.MustRead ? "bg-amber-50" : "bg-white";
    
    return (
      <div className={`relative ${cardBg} border-[3px] ${cardBorderColor} rounded-xl p-3 flex flex-col w-[182px] h-[440px] shadow-sm break-inside-avoid box-sizing-border-box overflow-hidden flex-shrink-0`}>
        {/* Header Strip */}
        <div className="flex justify-between items-center mb-1.5 px-0.5">
          <h3 className="font-black text-slate-900 text-[10px] leading-none truncate w-[75%] uppercase tracking-tighter" title={book.title}>
            {book.title}
          </h3>
          <div className="flex items-center gap-0.5 text-red-700 font-black text-[9px] shrink-0">
            <span className="text-[7px] text-slate-400 mr-0.5 font-bold">#</span>
            {book.id}
          </div>
        </div>

        {/* Central Image */}
        <div className="border-[2px] border-slate-900 bg-white h-[130px] w-full mb-2 relative overflow-hidden flex items-center justify-center rounded-lg shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)]">
            {isLoadingImage && !coverUrl ? (
                <div className="w-full h-full bg-slate-50 flex flex-col items-center justify-center">
                   <div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-1"></div>
                </div>
            ) : (
                <img 
                  src={displayUrl} 
                  alt={book.title}
                  crossOrigin="anonymous"
                  className="max-w-[94%] max-h-[94%] w-auto h-auto block m-auto"
                  style={{ objectFit: 'contain' }}
                />
            )}
             <div className="absolute top-1.5 right-1.5 bg-slate-900 text-white text-[7px] font-black px-1.5 py-0.5 rounded-full shadow-md uppercase tracking-widest">
               {book.difficulty}
             </div>
        </div>

        {/* Info Content */}
        <div className="flex-grow flex flex-col gap-1.5 px-0.5 overflow-hidden">
          <div className={`text-white text-[8px] font-black px-2 py-1.5 rounded-md text-center uppercase tracking-widest shadow-sm ${book.category === ReadingCategory.MustRead ? 'bg-purple-700' : 'bg-indigo-700'}`}>
            {book.category.split(' ')[0]}
          </div>

          <div className="flex justify-between items-center border-b border-slate-900/20 pb-0.5">
             <span className="text-[7px] font-black text-slate-400 uppercase tracking-tighter">Author</span>
             <span className="text-[8px] font-black text-slate-900 truncate ml-2">{book.author}</span>
          </div>

          <div className="bg-slate-50 p-2 rounded-lg border border-slate-200/50 flex-grow overflow-hidden">
             <p className="text-[8px] text-slate-700 leading-tight font-bold italic text-center line-clamp-[10]">
               "{book.summary}"
             </p>
          </div>
        </div>

        {/* Data Grid Footer */}
        <div className="mt-2 border-t border-slate-900/20 pt-2 flex flex-col gap-1 text-[7px] text-slate-900 font-black uppercase tracking-tight">
            <div className="flex justify-between items-center px-0.5">
              <div className="truncate w-[70%]"><span className="text-slate-400 font-bold">GEN:</span> {book.genre1}</div>
              <div className="bg-slate-900 text-white px-1 py-0.5 rounded leading-none text-[6px]">{book.code}</div>
            </div>
            <div className="flex justify-between items-center bg-slate-900 text-white px-1.5 py-1.5 rounded-md">
              <div className="flex items-center gap-1">
                <span className="text-amber-400 text-[6px]">LEX</span>
                <span className="text-[8px]">{book.lexile}</span>
              </div>
              <div className="h-2 w-px bg-slate-600"></div>
              <div className="flex items-center gap-1">
                <span className="text-amber-400 text-[6px]">BL</span>
                <span className="text-[8px]">{book.bl}</span>
              </div>
            </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`group relative bg-white rounded-3xl shadow-lg shadow-slate-200/50 overflow-hidden flex flex-col sm:flex-row h-full min-h-[240px] transition-all hover:shadow-xl hover:-translate-y-1 ${categoryColor} no-print`}>
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept="image/*" 
        onChange={handleFileChange} 
      />
      
      <button 
        onClick={handleEditClick}
        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 p-2 rounded-xl shadow-lg text-indigo-600 z-10 no-print hover:scale-110 active:scale-95 flex items-center justify-center min-w-[36px]"
        title="Upload New Cover"
        disabled={isVerifying}
      >
        {isVerifying ? (
          <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        ) : '📷'}
      </button>

      <div className="relative h-48 sm:h-auto sm:w-40 shrink-0 group bg-slate-100 flex items-center justify-center overflow-hidden">
        {isLoadingImage && !coverUrl ? (
          <div className="animate-pulse bg-slate-200 h-32 w-20 rounded-lg"></div>
        ) : (
          <img 
            src={displayUrl} 
            alt={`Cover of ${book.title}`}
            crossOrigin="anonymous"
            loading="lazy"
            className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 ${!coverUrl ? 'opacity-50 p-4 object-contain' : ''}`}
          />
        )}
        <div className="absolute top-3 left-3 px-2 py-1 rounded-lg bg-white/95 text-indigo-900 text-[10px] font-black shadow-sm backdrop-blur-sm">
          {book.code}
        </div>
      </div>
      
      <div className="p-6 flex-grow flex flex-col justify-between bg-white">
        <div className="flex-grow">
          <div className="flex justify-between items-start mb-2">
            <span className={`text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-widest ${difficultyColor[book.difficulty]}`}>
              {book.difficulty}
            </span>
            <div className="flex flex-col items-end text-right">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Level {book.bl}</span>
              <span className="text-[10px] font-bold text-indigo-300 font-mono">LEX: {book.lexile}</span>
            </div>
          </div>

          <h3 className="text-xl font-black text-slate-800 leading-tight mb-1 line-clamp-2 uppercase tracking-tight">{book.title}</h3>
          <p className="text-sm font-bold text-indigo-500 italic mb-3">{book.author}</p>
          
          <div className="flex flex-wrap gap-2 mb-4">
            <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-bold rounded-lg uppercase tracking-wider">{book.genre1}</span>
            {book.videoUrl && (
              <a 
                href={book.videoUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 hover:bg-red-100 text-red-600 text-[10px] font-black rounded-lg uppercase tracking-wider transition-colors no-underline border border-red-100"
              >
                <span>▶ Watch Story</span>
              </a>
            )}
          </div>

          <p className="text-xs text-slate-600 leading-relaxed line-clamp-3 font-medium">
            {book.summary}
          </p>
        </div>

        <div className="pt-4 mt-4 border-t border-slate-50 flex justify-between items-center">
           <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">ID: {book.id}</span>
           <span className="text-[10px] font-black text-slate-400 truncate max-w-[140px]" title={book.theme}>{book.theme}</span>
        </div>
      </div>
    </div>
  );
};

export default BookCard;