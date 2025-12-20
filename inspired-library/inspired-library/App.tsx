import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Book as BookType, GradeLevel, Month, ReadingCategory, Difficulty } from './types.ts';
import { GRADES, MONTHS, THEMES } from './constants.ts';
import { generateBookRecommendations, ALL_BOOKS_DATABASE } from './services/geminiService.ts';
import BookCard from './components/BookCard.tsx';
import StatsChart from './components/StatsChart.tsx';
import { 
  Library, 
  Sparkles, 
  BookOpen, 
  Download, 
  FileJson, 
  History, 
  Loader2, 
  AlertCircle,
  GraduationCap,
  Calendar,
  Layers,
  Search,
  X,
  ArrowLeft,
  ChevronRight,
  ListFilter,
  SortAsc,
  SortDesc,
  Filter,
  ArrowUpDown,
  BookMarked,
  Hash
} from 'lucide-react';

type View = 'landing' | 'search' | 'monthly';
type SortField = 'lexile' | 'bl' | 'theme' | 'series' | 'title';
type SortDirection = 'asc' | 'desc';

const App: React.FC = () => {
  // Detect embed mode via URL parameter
  const isEmbed = useMemo(() => {
    return new URLSearchParams(window.location.search).get('embed') === 'true';
  }, []);

  const [view, setView] = useState<View>(isEmbed ? 'monthly' : 'landing');
  const [selectedGrade, setSelectedGrade] = useState<GradeLevel>(GradeLevel.First);
  const [catalogGradeFilter, setCatalogGradeFilter] = useState<GradeLevel | 'All'>('All');
  
  const [selectedMonth, setSelectedMonth] = useState<Month>(() => {
    const currentMonthIndex = new Date().getMonth();
    return MONTHS[currentMonthIndex] as Month;
  });

  const [selectedTheme, setSelectedTheme] = useState<string>("All Themes");
  const [recLimit, setRecLimit] = useState<number>(10);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeSearch, setActiveSearch] = useState<string>("");
  const [books, setBooks] = useState<BookType[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfGenerating, setPdfGenerating] = useState<boolean>(false);
  const [visibleCount, setVisibleCount] = useState<number>(50);
  const [sortField, setSortField] = useState<SortField>('lexile');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  
  const [coverOverrides, setCoverOverrides] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('inspired_cover_overrides_v1');
    return saved ? JSON.parse(saved) : {};
  });

  const pdfContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('inspired_cover_overrides_v1', JSON.stringify(coverOverrides));
  }, [coverOverrides]);

  const handleUpdateCover = (bookId: string, newUrl: string) => {
    setCoverOverrides(prev => ({ ...prev, [bookId]: newUrl }));
  };

  const handleFetchBooks = async (queryOverride?: string) => {
    if (view === 'search') return;

    setLoading(true);
    setError(null);
    try {
      const queryToUse = queryOverride !== undefined ? queryOverride : activeSearch;
      const data = await generateBookRecommendations(selectedGrade, selectedMonth, selectedTheme, recLimit, queryToUse);
      if (data && data.books) {
        setBooks(data.books);
      } else {
        setBooks([]);
        setError("No books found matching your criteria.");
      }
    } catch (err) {
      setError("Failed to generate recommendations. Please check your API key.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (view === 'monthly') {
      handleFetchBooks();
    }
  }, [selectedGrade, selectedMonth, selectedTheme, recLimit, activeSearch, view]);

  const getLexileValue = (l: string): number => {
    const numeric = l.replace(/[^0-9]/g, '');
    return numeric ? parseInt(numeric, 10) : 0;
  };

  const getDifficultyFromBl = (bl: number): Difficulty => {
    if (bl < 3.0) return Difficulty.Beginner;
    if (bl < 5.0) return Difficulty.Intermediate;
    return Difficulty.Advanced;
  };

  const getBlRangeForGrade = (grade: GradeLevel): { min: number, max: number } => {
    switch (grade) {
      case GradeLevel.First: return { min: 0.1, max: 1.3 };
      case GradeLevel.Second: return { min: 1.1, max: 2.5 };
      case GradeLevel.Third: return { min: 2.1, max: 3.5 };
      case GradeLevel.Fourth: return { min: 3.1, max: 4.5 };
      case GradeLevel.Fifth: return { min: 3.5, max: 20.0 };
      case GradeLevel.Sixth: return { min: 3.5, max: 20.0 };
      default: return { min: 0, max: 20 };
    }
  };

  const catalogBooks = useMemo(() => {
    if (view !== 'search') return [];

    let list: BookType[] = ALL_BOOKS_DATABASE.map(raw => ({
      id: raw.id,
      code: raw.code,
      title: raw.title,
      series: raw.series,
      author: raw.author,
      lexile: raw.lexile,
      bl: raw.bl.toString(),
      genre1: raw.genre,
      genre2: "",
      theme: raw.theme,
      summary: raw.summary,
      difficulty: getDifficultyFromBl(raw.bl),
      category: ReadingCategory.Recommended,
      coverUrl: "",
      videoUrl: ""
    }));

    if (catalogGradeFilter !== 'All') {
      const { min, max } = getBlRangeForGrade(catalogGradeFilter as GradeLevel);
      list = list.filter(b => {
        const bl = parseFloat(b.bl);
        return bl >= min && bl <= max;
      });
    }

    list.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'lexile':
          comparison = getLexileValue(a.lexile) - getLexileValue(b.lexile);
          break;
        case 'bl':
          comparison = parseFloat(a.bl) - parseFloat(b.bl);
          break;
        case 'theme':
          comparison = (a.theme || "").localeCompare(b.theme || "");
          break;
        case 'series':
          if (!a.series && !b.series) comparison = a.title.localeCompare(b.title);
          else if (!a.series) comparison = 1;
          else if (!b.series) comparison = -1;
          else comparison = a.series.localeCompare(b.series) || a.title.localeCompare(b.title);
          break;
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        default:
          comparison = 0;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(b => 
        b.title.toLowerCase().includes(q) || 
        b.author.toLowerCase().includes(q) || 
        b.summary.toLowerCase().includes(q) ||
        b.theme.toLowerCase().includes(q) ||
        b.genre1.toLowerCase().includes(q)
      );
    }

    return list;
  }, [view, searchQuery, sortField, sortDirection, catalogGradeFilter]);

  const displayBooks = view === 'search' ? catalogBooks.slice(0, visibleCount) : books;

  const toggleSortDirection = () => {
    setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    setVisibleCount(50);
  };

  const clearSearch = () => {
    setSearchQuery("");
    setActiveSearch("");
    setVisibleCount(50);
    setCatalogGradeFilter('All');
    setSortField('lexile');
    setSortDirection('asc');
    setSelectedTheme("All Themes");
    setRecLimit(10);
  };

  const handleExportXml = () => {
    if (displayBooks.length === 0) return;
    const escapeXml = (unsafe: string) => unsafe.replace(/[<>&'"]/g, (c) => {
      switch (c) {
        case '<': return '&lt;'; case '>': return '&gt;'; case '&': return '&amp;';
        case '\'': return '&apos;'; case '"': return '&quot;'; default: return c;
      }
    });
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += `<ReadingList grade="${selectedGrade}" theme="${selectedTheme}" month="${selectedMonth}" year="${new Date().getFullYear()}">\n`;
    displayBooks.forEach(book => {
      xml += `  <Book id="${book.id}">\n    <Title>${escapeXml(book.title)}</Title>\n    <Author>${escapeXml(book.author)}</Author>\n    <Lexile>${book.lexile}</Lexile>\n    <BookLevel>${book.bl}</BookLevel>\n    <Difficulty>${book.difficulty}</Difficulty>\n  </Book>\n`;
    });
    xml += '</ReadingList>';
    const blob = new Blob([xml], { type: 'text/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Inspired-Library-Export-${selectedTheme.replace(/\s+/g, '-')}.xml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadPdf = async () => {
    if (!pdfContentRef.current) return;
    setPdfGenerating(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    // @ts-ignore
    if (typeof window.html2pdf !== 'undefined') {
      const opt = {
        margin: 0,
        filename: `Inspired-Reading-Deck-${selectedTheme.replace(/\s+/g, '-')}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
          scale: 2, 
          useCORS: true, 
          scrollY: 0, 
          windowWidth: 1056,
          x: 0,
          y: 0
        },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'landscape' },
        pagebreak: { mode: 'css', after: '.html2pdf__page-break' }
      };
      try {
        // @ts-ignore
        await window.html2pdf().set(opt).from(pdfContentRef.current).save();
      } catch (err) {
        console.error(err);
        alert("PDF export failed. Please try again.");
      } finally {
        setPdfGenerating(false);
      }
    } else {
      setPdfGenerating(false);
    }
  };

  const getCustomChunks = (allBooks: BookType[]): BookType[][] => {
    const result: BookType[][] = [];
    for (let i = 0; i < allBooks.length; i += 5) {
      result.push(allBooks.slice(i, i + 5));
    }
    return result;
  };

  const bookChunks = getCustomChunks(displayBooks);
  const mustReadBooks = view === 'monthly' ? displayBooks.filter(b => b.category === ReadingCategory.MustRead) : [];
  const recommendedBooks = view === 'monthly' ? displayBooks.filter(b => b.category === ReadingCategory.Recommended) : displayBooks;

  if (view === 'landing' && !isEmbed) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 font-nunito">
        <div className="max-w-4xl w-full text-center space-y-12">
          <div className="flex flex-col items-center gap-6">
            <div className="p-5 bg-indigo-600 rounded-[2.5rem] shadow-2xl shadow-indigo-200 animate-bounce">
              <Library className="w-16 h-16 text-white" />
            </div>
            <div>
              <h1 className="text-5xl md:text-6xl font-black text-slate-900 tracking-tight uppercase font-fredoka">
                Inspired <span className="text-indigo-600">Library</span>
              </h1>
              <p className="text-lg md:text-xl text-slate-500 font-bold mt-4 max-w-lg mx-auto leading-relaxed">
                Welcome to your intelligent Elementary Book Engine. Choose your path below.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <button onClick={() => { clearSearch(); setView('search'); }} className="group bg-white p-8 rounded-[2rem] border-2 border-slate-100 shadow-xl shadow-slate-200/50 text-left transition-all hover:border-indigo-400 hover:-translate-y-2 active:scale-95">
              <div className="p-4 bg-indigo-50 rounded-2xl w-fit mb-6 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                <Search className="w-8 h-8 text-indigo-600 group-hover:text-white" />
              </div>
              <h3 className="text-2xl font-black text-slate-800 uppercase font-fredoka mb-2">Search Catalog</h3>
              <p className="text-slate-500 font-bold leading-relaxed mb-6">Explore our exhaustive list of elementary titles with advanced sorting and grade filtering.</p>
              <div className="flex items-center text-indigo-600 font-black uppercase tracking-widest text-sm">Open Catalog <ChevronRight className="w-4 h-4 ml-2" /></div>
            </button>
            <button onClick={() => { clearSearch(); setView('monthly'); }} className="group bg-white p-8 rounded-[2rem] border-2 border-slate-100 shadow-xl shadow-slate-200/50 text-left transition-all hover:border-purple-400 hover:-translate-y-2 active:scale-95">
              <div className="p-4 bg-purple-50 rounded-2xl w-fit mb-6 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                <Calendar className="w-8 h-8 text-purple-600 group-hover:text-white" />
              </div>
              <h3 className="text-2xl font-black text-slate-800 uppercase font-fredoka mb-2">Monthly Picker</h3>
              <p className="text-slate-500 font-bold leading-relaxed mb-6">Get thematic AI recommendations for specific grades and seasons. Discover new topics effortlessly.</p>
              <div className="flex items-center text-purple-600 font-black uppercase tracking-widest text-sm">Get Suggestions <ChevronRight className="w-4 h-4 ml-2" /></div>
            </button>
          </div>
          <footer className="pt-8">
            <p className="text-[11px] font-black text-slate-300 uppercase tracking-[0.4em]">Powered by Inspired AI Engine • v1.11.0</p>
          </footer>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex flex-col relative bg-slate-50 z-0 font-nunito ${isEmbed ? 'p-0' : ''}`}>
      {/* PDF Generation Context */}
      <div className="pdf-export-root">
        <div ref={pdfContentRef}>
          {bookChunks.map((chunk, chunkIdx) => (
            <React.Fragment key={`pdf-pg-frag-${chunkIdx}`}>
              <div className="pdf-page-wrapper">
                <div className="flex justify-between items-end border-b-2 border-slate-900 pb-2 mt-10 w-full max-w-[960px] box-border">
                  <div>
                    <h1 className="text-xl font-black text-slate-900 uppercase tracking-tighter leading-none">Inspired Reading Deck</h1>
                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">
                      {view === 'search' ? (catalogGradeFilter === 'All' ? 'Full Catalog' : catalogGradeFilter) : selectedGrade} • {selectedTheme}
                    </p>
                  </div>
                  <p className="text-[9px] text-slate-400 font-black uppercase">Page {chunkIdx + 1}</p>
                </div>
                
                <div className="flex flex-row justify-center items-center gap-4 w-full py-4 flex-grow overflow-hidden box-border">
                  {chunk.map((book, idx) => (
                    <div key={`pdf-card-${book.id}`} className="shrink-0">
                      <BookCard book={book} index={idx} variant="pokemon" overrideUrl={coverOverrides[book.id]} />
                    </div>
                  ))}
                </div>

                <div className="border-t border-slate-200 pt-2 mb-10 text-center w-full max-w-[960px] box-border">
                  <p className="text-slate-300 font-black uppercase tracking-[0.4em] text-[7px]">Inspired AI Librarian • Professional Curation Engine</p>
                </div>
              </div>
              {chunkIdx < bookChunks.length - 1 && <div className="html2pdf__page-break"></div>}
            </React.Fragment>
          ))}
        </div>
      </div>

      {!isEmbed && (
        <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-md no-print">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex flex-col lg:flex-row justify-between items-center gap-6">
              <div className="flex items-center gap-4">
                <button onClick={() => setView('landing')} className="p-2 hover:bg-slate-100 rounded-xl transition-colors mr-2" title="Back to Home"><ArrowLeft className="w-6 h-6 text-slate-400" /></button>
                <div className="p-2 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-100"><Library className="w-6 h-6 text-white" /></div>
                <div>
                  <h1 className="text-lg font-black text-indigo-700 tracking-tight leading-none uppercase font-fredoka">Inspired Library</h1>
                  <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{view === 'search' ? 'Library Catalog' : 'Monthly Picker'}</p>
                </div>
              </div>

              {view === 'search' ? (
                <div className="flex flex-grow max-w-2xl w-full items-center gap-4">
                  <div className="relative flex-grow">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input type="text" placeholder="Search catalog..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-11 pr-12 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold text-slate-700 focus:outline-none focus:border-indigo-400 focus:bg-white transition-all shadow-inner" />
                    {searchQuery && <button onClick={() => setSearchQuery("")} className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-200 rounded-full transition-colors"><X className="w-3.5 h-3.5 text-slate-500" /></button>}
                  </div>
                  <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-2xl border border-slate-100 shadow-sm shrink-0">
                    <GraduationCap className="w-4 h-4 text-indigo-400" />
                    <select value={catalogGradeFilter} onChange={e => { setCatalogGradeFilter(e.target.value as any); setVisibleCount(50); }} className="text-xs font-black text-slate-700 focus:outline-none bg-transparent min-w-[90px] uppercase cursor-pointer">
                      <option value="All">All Grades</option>
                      {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2 items-center bg-slate-50 p-2 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-100 shadow-sm">
                    <GraduationCap className="w-4 h-4 text-indigo-400" />
                    <select value={selectedGrade} onChange={e => setSelectedGrade(e.target.value as GradeLevel)} className="text-xs font-black text-slate-700 focus:outline-none bg-transparent min-w-[70px] cursor-pointer">
                      {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                  <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-100 shadow-sm">
                    <ListFilter className="w-4 h-4 text-indigo-400" />
                    <select value={selectedTheme} onChange={e => setSelectedTheme(e.target.value)} className="text-xs font-black text-slate-700 focus:outline-none bg-transparent min-w-[130px] cursor-pointer">
                      {THEMES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-100 shadow-sm">
                    <Calendar className="w-4 h-4 text-indigo-400" />
                    <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value as Month)} className="text-xs font-black text-slate-700 focus:outline-none bg-transparent min-w-[80px] cursor-pointer">
                      {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-100 shadow-sm" title="Recommendation Count">
                    <Hash className="w-4 h-4 text-indigo-400" />
                    <select 
                      value={recLimit} 
                      onChange={e => setRecLimit(parseInt(e.target.value, 10))} 
                      className="text-xs font-black text-slate-700 focus:outline-none bg-transparent min-w-[50px] cursor-pointer"
                    >
                      {[10, 15, 20, 25, 30].map(val => <option key={val} value={val}>{val}</option>)}
                    </select>
                  </div>
                </div>
              )}

              <div className="flex gap-2 shrink-0">
                <button onClick={handleExportXml} disabled={displayBooks.length === 0} className="p-2 text-indigo-600 bg-white border border-indigo-100 rounded-xl hover:bg-indigo-50 transition-all shadow-sm" title="Export XML"><FileJson className="w-5 h-5" /></button>
                <button onClick={handleDownloadPdf} disabled={pdfGenerating || displayBooks.length === 0} className="flex items-center gap-2 px-6 py-2 text-xs font-black rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 transition-all shadow-lg active:scale-95 disabled:opacity-50">
                  {pdfGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  <span className="hidden sm:inline uppercase tracking-widest">Download PDF</span>
                </button>
              </div>
            </div>
          </div>
        </header>
      )}

      <main className={`flex-grow ${isEmbed ? 'p-2' : 'p-6'} max-w-7xl mx-auto w-full no-print`}>
        {error && (
          <div className="p-4 mb-6 bg-red-50 text-red-700 font-bold rounded-xl border-l-4 border-red-500 flex items-center gap-3">
            <AlertCircle className="w-5 h-5" /> {error}
          </div>
        )}

        {isEmbed && view === 'monthly' && (
           <div className="mb-4 flex flex-wrap gap-2 items-center bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
             <div className="flex items-center gap-2 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
               <GraduationCap className="w-3 h-3 text-indigo-400" />
               <select value={selectedGrade} onChange={e => setSelectedGrade(e.target.value as GradeLevel)} className="text-[10px] font-black text-slate-700 focus:outline-none bg-transparent cursor-pointer">
                 {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
               </select>
             </div>
             <div className="flex items-center gap-2 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
               <ListFilter className="w-3 h-3 text-indigo-400" />
               <select value={selectedTheme} onChange={e => setSelectedTheme(e.target.value)} className="text-[10px] font-black text-slate-700 focus:outline-none bg-transparent cursor-pointer">
                 {THEMES.map(t => <option key={t} value={t}>{t}</option>)}
               </select>
             </div>
             <button onClick={() => setView('search')} className="ml-auto text-[10px] font-black text-indigo-600 uppercase underline">Catalog View</button>
           </div>
        )}

        {view === 'search' && !isEmbed && (
          <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-indigo-50 rounded-2xl"><Filter className="w-6 h-6 text-indigo-600" /></div>
              <div>
                <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight font-fredoka">Catalog View</h2>
                <p className="text-sm font-bold text-slate-400 mt-1">Sorted by <span className="text-indigo-600">{sortField.toUpperCase()} ({sortDirection.toUpperCase()})</span></p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-[1.2rem] border border-slate-100">
              <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-xl border border-slate-100 shadow-sm">
                <ArrowUpDown className="w-4 h-4 text-indigo-400" />
                <select value={sortField} onChange={(e) => { setSortField(e.target.value as SortField); setVisibleCount(50); }} className="bg-transparent text-xs font-black text-indigo-700 focus:outline-none cursor-pointer uppercase">
                  <option value="lexile">Lexile</option>
                  <option value="bl">Book Level</option>
                  <option value="theme">Theme</option>
                  <option value="series">Series</option>
                  <option value="title">A-Z</option>
                </select>
              </div>
              <button onClick={toggleSortDirection} className="p-2 bg-white rounded-xl border border-slate-100 shadow-sm text-indigo-600 hover:bg-indigo-50 transition-colors">
                {sortDirection === 'asc' ? <SortAsc className="w-5 h-5" /> : <SortDesc className="w-5 h-5" />}
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-40">
            <div className="relative">
              <div className="w-20 h-20 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
              <Sparkles className="w-8 h-8 text-indigo-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
            </div>
            <p className="mt-6 font-black text-indigo-900 uppercase tracking-[0.2em] animate-pulse">Curation Engine Working...</p>
          </div>
        ) : (
          <div className={`grid grid-cols-1 ${isEmbed ? 'lg:grid-cols-1' : 'lg:grid-cols-4'} gap-8`}>
            {!isEmbed && (
              <aside className="lg:col-span-1 space-y-6">
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                  <div className="flex items-center gap-2 mb-6 text-slate-800">
                    <History className="w-5 h-5 text-indigo-500" />
                    <h3 className="font-black uppercase tracking-widest text-xs">Curated Results</h3>
                  </div>
                  <div className="mb-6"><StatsChart books={displayBooks} /></div>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Theme Filter</p>
                    <p className="text-sm font-black text-indigo-700 uppercase">{selectedTheme}</p>
                  </div>
                </div>
                <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 p-6 rounded-3xl shadow-xl text-white">
                  <Sparkles className="w-8 h-8 mb-4 opacity-50" />
                  <h3 className="text-lg font-black uppercase tracking-tight mb-2">Thematic Discovery</h3>
                  <p className="text-xs font-bold leading-relaxed opacity-90">The AI curator selects a balanced mix of reading levels specifically for the topic.</p>
                </div>
              </aside>
            )}

            <div className={`${isEmbed ? 'lg:col-span-1' : 'lg:col-span-3'} space-y-12`}>
              {view === 'monthly' && mustReadBooks.length > 0 && (
                <section>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-purple-600 rounded-lg shadow-lg shadow-purple-100"><Sparkles className="w-4 h-4 text-white" /></div>
                    <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight font-fredoka">Thematic "Must Reads"</h2>
                  </div>
                  <div className={`grid grid-cols-1 ${isEmbed ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-6`}>
                    {mustReadBooks.map((book, idx) => (
                      <BookCard key={book.id} book={book} index={idx} onUpdateCover={handleUpdateCover} overrideUrl={coverOverrides[book.id]} />
                    ))}
                  </div>
                </section>
              )}

              <section>
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-indigo-600 rounded-lg shadow-lg shadow-indigo-100"><BookOpen className="w-4 h-4 text-white" /></div>
                  <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight font-fredoka">
                    {view === 'search' ? 'Discovery Catalog' : 'Recommended Titles'}
                  </h2>
                </div>
                {recommendedBooks.length === 0 && mustReadBooks.length === 0 ? (
                  <div className="text-center py-24 bg-white rounded-[2rem] border-2 border-dashed border-slate-200">
                    <BookMarked className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No matching books for this theme/grade combo</p>
                    <button onClick={clearSearch} className="mt-4 text-xs font-black text-indigo-600 uppercase underline">Reset Filters</button>
                  </div>
                ) : (
                  <div className={`grid grid-cols-1 ${isEmbed ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-6`}>
                    {recommendedBooks.map((book, idx) => (
                      <BookCard key={book.id} book={book} index={idx} onUpdateCover={handleUpdateCover} overrideUrl={coverOverrides[book.id]} />
                    ))}
                  </div>
                )}
                {view === 'search' && catalogBooks.length > visibleCount && (
                  <button onClick={() => setVisibleCount(prev => prev + 50)} className="mt-12 w-full py-5 bg-white border-2 border-slate-100 rounded-[2rem] font-black text-indigo-600 hover:border-indigo-400 hover:bg-slate-50 transition-all uppercase tracking-[0.2em] shadow-sm flex items-center justify-center gap-2">
                    Browse More Titles <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </section>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
