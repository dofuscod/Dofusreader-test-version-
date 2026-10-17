import { useState, useEffect } from 'preact/hooks';
import { db, Book, Chapter } from './db/database';
import JSZip from 'jszip';

export function App() {
  const [books, setBooks] = useState<Book[]>([]);
  const [currentBook, setCurrentBook] = useState<Book | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [activeChapter, setActiveChapter] = useState<Chapter | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadBooks();
  }, []);

  async function loadBooks() {
    const allBooks = await db.books.toArray();
    setBooks(allBooks);
  }

  async function handleFileUpload(e: Event) {
    const fileInput = e.target as HTMLInputElement;
    if (!fileInput.files || fileInput.files.length === 0) return;
    const file = fileInput.files[0];
    setLoading(true);

    try {
      const zip = new JSZip();
      const zipContent = await zip.loadAsync(file);
      
      const containerFile = zipContent.file('META-INF/container.xml');
      if (!containerFile) throw new Error('Некорректный EPUB файл');

      const containerXml = await containerFile.async('text');
      const parser = new DOMParser();
      const containerDoc = parser.parseFromString(containerXml, 'text/xml');
      const opfPath = containerDoc.querySelector('rootfile')?.getAttribute('full-path');
      
      if (!opfPath) throw new Error('OPF файл не найден в архиве');

      const opfFolder = opfPath.substring(0, opfPath.lastIndexOf('/') + 1);
      const opfText = await zipContent.file(opfPath)!.async('text');
      const opfDoc = parser.parseFromString(opfText, 'text/xml');

      const titleElement = opfDoc.querySelector('metadata > dc\\:title, title');
      const title = titleElement?.textContent || file.name;

      const bookId = await db.books.add({
        title,
        createdAt: Date.now()
      });

      const items = Array.from(opfDoc.querySelectorAll('manifest > item'));
      const spine = Array.from(opfDoc.querySelectorAll('spine > itemref')).map(r => r.getAttribute('idref'));

      let order = 0;
      for (const idref of spine) {
        const item = items.find(i => i.getAttribute('id') === idref);
        if (!item) continue;
        
        const href = item.getAttribute('href');
        const htmlFile = zipContent.file(opfFolder + href);
        if (!htmlFile) continue;

        const htmlContent = await htmlFile.async('text');
        
        await db.chapters.add({
          bookId: bookId as number,
          order: order++,
          title: `Глава ${order}`,
          htmlContent
        });
      }

      await loadBooks();
    } catch (err) {
      alert('Ошибка импорта: ' + err);
    } finally {
      setLoading(false);
    }
  }

  async function openBook(book: Book) {
    setCurrentBook(book);
    const bookChapters = await db.chapters.where('bookId').equals(book.id!).sortBy('order');
    setChapters(bookChapters);
    if (bookChapters.length > 0) {
      setActiveChapter(bookChapters[0]);
    }
  }

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', minHeight: '100vh' }}>
      <h1>Dofus Reader (MVP)</h1>

      {!currentBook ? (
        <div>
          <div style={{ marginBottom: '20px', padding: '15px', background: '#1e1e1e', borderRadius: '8px' }}>
            <h3>Загрузить книгу (EPUB)</h3>
            <input type="file" accept=".epub" onChange={handleFileUpload} disabled={loading} />
            {loading && <p>Импорт и распаковка книги...</p>}
          </div>

          <h3>Ваша библиотека</h3>
          {books.length === 0 ? (
            <p>Пока нет добавленных книг.</p>
          ) : (
            <ul>
              {books.map(b => (
                <li key={b.id} style={{ marginBottom: '10px' }}>
                  <button onClick={() => openBook(b)} style={{ padding: '8px 12px', cursor: 'pointer', background: '#333', color: '#fff', border: 'none', borderRadius: '4px' }}>
                    {b.title}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div>
          <button onClick={() => { setCurrentBook(null); setActiveChapter(null); }} style={{ marginBottom: '20px', padding: '6px 12px', cursor: 'pointer', background: '#333', color: '#fff', border: 'none', borderRadius: '4px' }}>
            ← Назад к библиотеке
          </button>
          <h2>{currentBook.title}</h2>

          <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', marginBottom: '20px', paddingBottom: '5px' }}>
            {chapters.map(ch => (
              <button 
                key={ch.id} 
                onClick={() => setActiveChapter(ch)}
                style={{ 
                  background: activeChapter?.id === ch.id ? '#444' : '#222', 
                  color: '#fff', 
                  border: '1px solid #444', 
                  padding: '6px 12px',
                  cursor: 'pointer',
                  borderRadius: '4px',
                  whiteSpace: 'nowrap'
                }}
              >
                {ch.title}
              </button>
            ))}
          </div>

          <div 
            style={{ background: '#181818', padding: '20px', borderRadius: '8px', lineHeight: '1.6' }}
            dangerouslySetInnerHTML={{ __html: activeChapter?.htmlContent || 'Выберите главу' }}
          />
        </div>
      )}
    </div>
  );
}
